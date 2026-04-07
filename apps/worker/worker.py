#!/usr/bin/env python3
"""OGD Quality System — Python Worker"""
import os, json, time, logging, signal, sys, threading
import schedule
import redis as redis_lib
from resource_checker import check_resource
from scoring import recalculate_dataset_score
from ckan_collector import sync_catalog
from db import get_conn, release_conn

REDIS_URL          = os.environ["REDIS_URL"]
WORKER_CONCURRENCY = int(os.getenv("WORKER_CONCURRENCY", "3"))

QUEUE_RESOURCE_CHECK = "ogd:queue:resource_check"
QUEUE_SCORE_CALC     = "ogd:queue:score_calc"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("worker")
_stop_event = threading.Event()

# ─── กัน score_calc trigger ซ้ำในกระบวนการเดียวกัน ───────────────
_triggered_scores: set[str] = set()
_triggered_lock   = threading.Lock()


def get_redis():
    return redis_lib.from_url(REDIS_URL, decode_responses=True)


# ─── Resource check handler ───────────────────────────────────────

def handle_resource_check(payload: dict):
    resource_id   = payload["resourceId"]
    resource_url  = payload["resourceUrl"]
    package_id    = payload["packageId"]
    job_id        = payload["jobId"]
    dataset_total = int(payload.get("datasetResourceCount") or 0)

    log.info(f"[check] {resource_id[:8]}… — {resource_url[:60]}")

    conn = None
    try:
        result = check_resource(
            resource_id=resource_id,
            resource_url=resource_url,
            resource_format=payload.get("resourceFormat"),
            metadata_modified=payload.get("metadataModified"),
            update_frequency=payload.get("updateFrequency"),
        )

        conn = get_conn()
        check_id = _insert_check(conn, resource_id, job_id, result)
        vr = result.get("validity_report")
        if vr:
            _insert_validity_report(conn, check_id, vr)

        done, total = _increment_job(conn, job_id)
        conn.commit()

        log.info(f"[check] done {resource_id[:8]}… job={job_id[:8]}… ({done}/{total})")

        # trigger score_calc ถ้า resource ของ dataset นี้เสร็จครบ
        if dataset_total > 0:
            _maybe_trigger_score_calc(package_id, job_id, dataset_total)

    except Exception as e:
        log.error(f"[check] ERROR {resource_id}: {e}")
        if conn:
            try: conn.rollback()
            except Exception: pass
        # save minimal error record
        try:
            err_conn = get_conn()
            try:
                with err_conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO resource_checks (id, resource_id, scan_job_id, checked_at, error_msg)
                        VALUES (gen_random_uuid(), %s, %s, NOW(), %s)
                    """, (resource_id, job_id, str(e)[:500]))
                    _increment_job_cursor(cur, job_id)
                err_conn.commit()
            finally:
                release_conn(err_conn)
        except Exception as e2:
            log.error(f"[check] error saving error record: {e2}")

        if dataset_total > 0:
            _maybe_trigger_score_calc(package_id, job_id, dataset_total)
    finally:
        if conn:
            release_conn(conn)


def _insert_check(conn, resource_id: str, job_id: str, result: dict) -> str:
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO resource_checks (
                id, resource_id, scan_job_id, checked_at,
                http_status, downloadable, content_type, file_size, redirect_url,
                detected_format, is_machine_readable, is_structured, structured_status,
                timeliness_status, encoding, row_count, column_count,
                is_valid, error_count, warning_count, partial_scan,
                scan_duration_ms, error_msg
            ) VALUES (
                gen_random_uuid(), %s, %s, NOW(),
                %s,%s,%s,%s,%s,
                %s,%s,%s,%s,
                %s,%s,%s,%s,
                %s,%s,%s,%s,
                %s,%s
            ) RETURNING id
        """, (
            resource_id, job_id,
            result.get("http_status"), result.get("downloadable"),
            result.get("content_type"), result.get("file_size"), result.get("redirect_url"),
            result.get("detected_format"), result.get("is_machine_readable"),
            result.get("is_structured"), result.get("structured_status"),
            result.get("timeliness_status"), result.get("encoding"),
            result.get("row_count"), result.get("column_count"),
            result.get("is_valid"), result.get("error_count", 0), result.get("warning_count", 0),
            result.get("partial_scan", False), result.get("scan_duration_ms"), result.get("error_msg"),
        ))
        return cur.fetchone()[0]


def _insert_validity_report(conn, check_id: str, vr: dict):
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO validity_reports (
                id, check_id,
                blank_header, duplicate_header, blank_row,
                extra_value, extra_header, missing_value,
                format_error, schema_error, encoding_error, source_error,
                encoding, error_message, valid, severity, primary_issue, raw_json, created_at
            ) VALUES (
                gen_random_uuid(), %s,
                %s,%s,%s, %s,%s,%s, %s,%s,%s,%s,
                %s,%s,%s,%s,%s,%s, NOW()
            )
        """, (
            check_id,
            vr.get("blank-header", 0), vr.get("duplicate-header", 0), vr.get("blank-row", 0),
            vr.get("extra-value", 0), vr.get("extra-header", 0), vr.get("missing-value", 0),
            vr.get("format-error", 0), vr.get("schema-error", 0),
            vr.get("encoding-error", 0), vr.get("source-error", 0),
            vr.get("encoding"), vr.get("error") or None, vr.get("valid"),
            vr.get("severity"), vr.get("primary_issue"),
            json.dumps(vr, ensure_ascii=False),
        ))


def _increment_job_cursor(cur, job_id: str) -> tuple[int, int]:
    cur.execute("""
        UPDATE scan_jobs SET done_items=done_items+1, updated_at=NOW() WHERE id=%s
        RETURNING done_items, total_items
    """, (job_id,))
    row = cur.fetchone()
    done, total = (row or (0, 0))
    if total > 0 and done >= total:
        cur.execute("""
            UPDATE scan_jobs SET status='done', finished_at=NOW(), updated_at=NOW()
            WHERE id=%s AND status='running'
        """, (job_id,))
    return done, total


def _increment_job(conn, job_id: str) -> tuple[int, int]:
    with conn.cursor() as cur:
        return _increment_job_cursor(cur, job_id)


def _maybe_trigger_score_calc(package_id: str, job_id: str, dataset_total: int):
    """
    นับ checks ที่เสร็จแล้วสำหรับ dataset นี้ใน job นี้
    ถ้าครบ dataset_total → push score_calc เข้า queue (ครั้งเดียวเท่านั้น)
    """
    key = f"{job_id}:{package_id}"

    # เช็ค in-memory ก่อน (fast path)
    with _triggered_lock:
        if key in _triggered_scores:
            return

    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(DISTINCT rc.id)
                FROM resource_checks rc
                JOIN resources r ON r.id = rc.resource_id
                WHERE r.package_id = %s AND rc.scan_job_id = %s
            """, (package_id, job_id))
            checked = cur.fetchone()[0]

        if checked >= dataset_total:
            # atomic: ตรวจและ mark พร้อมกัน
            with _triggered_lock:
                if key in _triggered_scores:
                    return
                _triggered_scores.add(key)

            log.info(f"[score_calc] trigger dataset={package_id[:8]}… ({checked}/{dataset_total})")
            get_redis().lpush(QUEUE_SCORE_CALC, json.dumps({
                "jobId": job_id,
                "datasetId": package_id,
            }))
    except Exception as e:
        log.error(f"[score_trigger] {package_id}: {e}")
    finally:
        if conn:
            release_conn(conn)


# ─── Score calc handler ───────────────────────────────────────────

def handle_score_calc(payload: dict):
    dataset_id = payload["datasetId"]
    job_id     = payload["jobId"]
    log.info(f"[score_calc] {dataset_id[:8]}…")
    try:
        recalculate_dataset_score(dataset_id, job_id)
    except Exception as e:
        log.error(f"[score_calc] ERROR {dataset_id}: {e}")


# ─── Worker loop ──────────────────────────────────────────────────

def worker_loop(queue_name: str, handler, worker_id: int):
    r = get_redis()
    log.info(f"Worker-{worker_id} listening on {queue_name}")
    while not _stop_event.is_set():
        try:
            item = r.brpop(queue_name, timeout=2)
            if item is None:
                continue
            _, raw = item
            payload = json.loads(raw)
            handler(payload)
        except redis_lib.RedisError as e:
            log.warning(f"[Worker-{worker_id}] Redis: {e}")
            time.sleep(2)
        except Exception as e:
            log.error(f"[Worker-{worker_id}] Unhandled: {e}")


# ─── Cron ─────────────────────────────────────────────────────────

def run_scheduler():
    schedule.every().day.at("02:00").do(lambda: _run_safe(sync_catalog, "sync"))
    while not _stop_event.is_set():
        schedule.run_pending()
        time.sleep(30)


def _run_safe(fn, name):
    try: fn()
    except Exception as e: log.error(f"[cron:{name}] {e}")


# ─── Main ─────────────────────────────────────────────────────────

def handle_signal(sig, frame):
    log.info(f"Signal {sig} — stopping...")
    _stop_event.set()


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)

    threads = []
    for i in range(WORKER_CONCURRENCY):
        t = threading.Thread(target=worker_loop, args=(QUEUE_RESOURCE_CHECK, handle_resource_check, i), daemon=True)
        t.start(); threads.append(t)

    t = threading.Thread(target=worker_loop, args=(QUEUE_SCORE_CALC, handle_score_calc, 99), daemon=True)
    t.start(); threads.append(t)

    t = threading.Thread(target=run_scheduler, daemon=True)
    t.start(); threads.append(t)

    log.info(f"OGD Worker started — {WORKER_CONCURRENCY} resource + 1 score + scheduler")
    _stop_event.wait()
    sys.exit(0)