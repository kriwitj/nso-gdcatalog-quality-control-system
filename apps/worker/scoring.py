"""
scoring.py
Recalculates quality scores for a dataset based on its latest resource checks.

Weights:
  Metadata completeness  20%
  Timeliness             20%
  Accessibility          15%
  Machine readable       20%
  Validity               25%
"""
import logging
from db import get_conn, release_conn

log = logging.getLogger("scoring")

W_META    = 0.20
W_TIME    = 0.20
W_ACCESS  = 0.15
W_MACHINE = 0.20
W_VALID   = 0.25


def grade_from_score(score: float) -> str:
    if score >= 90: return "A"
    if score >= 75: return "B"
    if score >= 60: return "C"
    if score >= 40: return "D"
    return "F"


def recalculate_dataset_score(dataset_id: str, job_id: str):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # ── Metadata completeness (already computed at sync time) ──
            cur.execute("""
                SELECT completeness_score, update_frequency,
                       metadata_modified, resource_count
                FROM datasets WHERE id = %s
            """, (dataset_id,))
            row = cur.fetchone()
            if not row:
                log.warning(f"Dataset not found: {dataset_id}")
                return
            completeness_score, update_freq, meta_mod, resource_count = row
            completeness_score = float(completeness_score or 0)

            # ── Latest check per resource ──────────────────────────────
            cur.execute("""
                SELECT DISTINCT ON (rc.resource_id)
                    rc.resource_id,
                    rc.http_status,
                    rc.downloadable,
                    rc.timeliness_status,
                    rc.is_machine_readable,
                    rc.is_valid,
                    rc.error_count
                FROM resource_checks rc
                JOIN resources r ON r.id = rc.resource_id
                WHERE r.package_id = %s
                ORDER BY rc.resource_id, rc.checked_at DESC
            """, (dataset_id,))
            checks = cur.fetchall()

        if not checks:
            log.info(f"No checks yet for dataset {dataset_id}")
            return

        total = len(checks)

        # ── Accessibility score ────────────────────────────────────────
        downloadable = sum(1 for c in checks if c[2] is True)
        accessibility_score = (downloadable / total) * 100 if total > 0 else 0

        # ── Timeliness score ───────────────────────────────────────────
        TIMELINESS_SCORES = {"up_to_date": 100, "warning": 60, "outdated": 20, "unknown": 40}
        timeliness_vals = [TIMELINESS_SCORES.get(c[3] or "unknown", 40) for c in checks]
        timeliness_score = sum(timeliness_vals) / len(timeliness_vals) if timeliness_vals else 40

        # ── Machine readable score ─────────────────────────────────────
        machine_readable = sum(1 for c in checks if c[4] is True)
        machine_readable_score = (machine_readable / total) * 100 if total > 0 else 0

        # ── Validity score ─────────────────────────────────────────────
        # Only for resources that were actually validated (have is_valid)
        validated = [c for c in checks if c[5] is not None]
        if validated:
            valid_count = sum(1 for c in validated if c[5] is True)
            # Penalize by error count
            validity_score = (valid_count / len(validated)) * 100
            # Deduct for high error counts
            avg_errors = sum(c[6] or 0 for c in validated) / len(validated)
            if avg_errors > 100:
                validity_score = max(0, validity_score - 20)
            elif avg_errors > 10:
                validity_score = max(0, validity_score - 10)
        else:
            # Non-tabular resources: give partial credit if accessible
            validity_score = accessibility_score * 0.7

        # ── Overall score ──────────────────────────────────────────────
        overall_score = round(
            completeness_score    * W_META    +
            timeliness_score      * W_TIME    +
            accessibility_score   * W_ACCESS  +
            machine_readable_score * W_MACHINE +
            validity_score        * W_VALID,
            2
        )

        # ── Machine readable status ────────────────────────────────────
        if machine_readable == total:
            mr_status = "fully_machine_readable"
        elif machine_readable > 0:
            mr_status = "partially_machine_readable"
        else:
            mr_status = "not_machine_readable"

        # ── Timeliness status (dataset level) ─────────────────────────
        tl_counts = {"up_to_date": 0, "warning": 0, "outdated": 0, "unknown": 0}
        for c in checks:
            tl_counts[c[3] or "unknown"] = tl_counts.get(c[3] or "unknown", 0) + 1
        if tl_counts["outdated"] / total > 0.5:
            tl_status = "outdated"
        elif tl_counts["warning"] / total > 0.3:
            tl_status = "warning"
        elif tl_counts["up_to_date"] / total >= 0.5:
            tl_status = "up_to_date"
        else:
            tl_status = "unknown"

        quality_grade = grade_from_score(overall_score)

        conn2 = get_conn()
        try:
            with conn2.cursor() as cur:
                cur.execute("""
                    UPDATE datasets SET
                        completeness_score    = %s,
                        timeliness_score      = %s,
                        accessibility_score   = %s,
                        machine_readable_score = %s,
                        validity_score        = %s,
                        overall_score         = %s,
                        quality_grade         = %s,
                        machine_readable_status = %s,
                        timeliness_status     = %s,
                        last_scan_at          = NOW(),
                        last_scan_status      = 'done',
                        updated_at            = NOW()
                    WHERE id = %s
                """, (
                    round(completeness_score, 2),
                    round(timeliness_score, 2),
                    round(accessibility_score, 2),
                    round(machine_readable_score, 2),
                    round(validity_score, 2),
                    overall_score,
                    quality_grade,
                    mr_status,
                    tl_status,
                    dataset_id,
                ))

                # Insert history record
                cur.execute("""
                    INSERT INTO quality_score_history (
                        id, dataset_id, recorded_at,
                        completeness_score, timeliness_score, accessibility_score,
                        machine_readable_score, validity_score, overall_score, quality_grade
                    ) VALUES (
                        gen_random_uuid(), %s, NOW(),
                        %s, %s, %s, %s, %s, %s, %s
                    )
                """, (
                    dataset_id,
                    round(completeness_score, 2), round(timeliness_score, 2),
                    round(accessibility_score, 2), round(machine_readable_score, 2),
                    round(validity_score, 2), overall_score, quality_grade,
                ))

            conn2.commit()
            log.info(f"[score] {dataset_id} → {overall_score:.1f} ({quality_grade})")
        finally:
            release_conn(conn2)

    except Exception as e:
        log.error(f"Score calc failed for {dataset_id}: {e}")
        raise
    finally:
        release_conn(conn)
