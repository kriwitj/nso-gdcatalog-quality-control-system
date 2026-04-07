"""
ckan_collector.py
Pulls all packages and resources from CKAN and upserts into PostgreSQL.
"""
import os, logging, requests
from datetime import datetime
from db import get_conn, release_conn

log = logging.getLogger("ckan_collector")

CKAN_BASE_URL = os.environ.get("CKAN_BASE_URL", "https://saraburi.gdcatalog.go.th")
CKAN_API_KEY  = os.environ.get("CKAN_API_KEY", "")
PAGE_SIZE = 100

HEADERS = {"User-Agent": "OGD-Quality-System/1.0"}
if CKAN_API_KEY:
    HEADERS["Authorization"] = CKAN_API_KEY


def _fetch_all_packages() -> list[dict]:
    all_pkgs = []
    start = 0
    while True:
        resp = requests.get(
            f"{CKAN_BASE_URL}/api/3/action/package_search",
            params={"rows": PAGE_SIZE, "start": start},
            headers=HEADERS,
            timeout=30,
        )
        resp.raise_for_status()
        result = resp.json()["result"]
        pkgs = result.get("results", [])
        all_pkgs.extend(pkgs)
        log.info(f"Fetched {len(all_pkgs)} / {result['count']}")
        if len(all_pkgs) >= result["count"] or not pkgs:
            break
        start += PAGE_SIZE
    return all_pkgs


def _upsert_package(cur, pkg: dict) -> str:
    """Upsert organization, then dataset, then resources. Returns dataset UUID."""

    org = pkg.get("organization")
    org_id = None
    if org:
        cur.execute("""
            INSERT INTO organizations (id, ckan_id, name, title, description, image_url, created_at, updated_at)
            VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, NOW(), NOW())
            ON CONFLICT (ckan_id) DO UPDATE SET name=%s, title=%s, description=%s, updated_at=NOW()
            RETURNING id
        """, (
            org["id"], org["name"], org.get("title"), org.get("description"), org.get("image_url"),
            org["name"], org.get("title"), org.get("description"),
        ))
        org_id = cur.fetchone()[0]

    tags   = [t["name"] for t in pkg.get("tags", [])]
    groups = [g["name"] for g in pkg.get("groups", [])]

    def _dt(s):
        return datetime.fromisoformat(s.replace("Z", "+00:00")) if s else None

    # Metadata completeness score
    score = 0
    if pkg.get("title"):           score += 20
    if pkg.get("notes"):           score += 20
    if tags:                       score += 15
    if pkg.get("license_title"):   score += 15
    if org:                        score += 15
    if pkg.get("update_frequency"): score += 15

    cur.execute("""
        INSERT INTO datasets (
            id, ckan_id, organization_id, name, title, notes, license,
            tags, groups, update_frequency, metadata_created, metadata_modified,
            resource_count, is_open, completeness_score, last_scan_status,
            created_at, updated_at
        ) VALUES (
            gen_random_uuid(), %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s,
            %s, %s, %s, 'pending',
            NOW(), NOW()
        )
        ON CONFLICT (ckan_id) DO UPDATE SET
            organization_id=%s, title=%s, notes=%s, license=%s,
            tags=%s, groups=%s, update_frequency=%s, metadata_modified=%s,
            resource_count=%s, is_open=%s, completeness_score=%s, updated_at=NOW()
        RETURNING id
    """, (
        pkg["id"], org_id, pkg["name"], pkg.get("title"), pkg.get("notes"), pkg.get("license_title"),
        tags, groups, pkg.get("update_frequency"), _dt(pkg.get("metadata_created")),
        _dt(pkg.get("metadata_modified")), pkg.get("num_resources", 0), pkg.get("isopen", False), score,
        # ON CONFLICT
        org_id, pkg.get("title"), pkg.get("notes"), pkg.get("license_title"),
        tags, groups, pkg.get("update_frequency"), _dt(pkg.get("metadata_modified")),
        pkg.get("num_resources", 0), pkg.get("isopen", False), score,
    ))
    dataset_id = cur.fetchone()[0]

    for res in pkg.get("resources", []):
        cur.execute("""
            INSERT INTO resources (
                id, ckan_id, package_id, name, description, format, url,
                size, mime_type, hash, metadata_modified, created_at, updated_at
            ) VALUES (
                gen_random_uuid(), %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, NOW(), NOW()
            )
            ON CONFLICT (ckan_id) DO UPDATE SET
                name=%s, description=%s, format=%s, url=%s,
                size=%s, mime_type=%s, metadata_modified=%s, updated_at=NOW()
        """, (
            res["id"], dataset_id, res.get("name"), res.get("description"),
            (res.get("format") or "").upper() or None, res.get("url"),
            res.get("size"), res.get("mimetype"), res.get("hash"),
            _dt(res.get("metadata_modified")),
            # ON CONFLICT
            res.get("name"), res.get("description"),
            (res.get("format") or "").upper() or None, res.get("url"),
            res.get("size"), res.get("mimetype"), _dt(res.get("metadata_modified")),
        ))

    return dataset_id


def sync_catalog():
    log.info("Starting CKAN catalog sync...")
    conn = get_conn()
    try:
        packages = _fetch_all_packages()
        log.info(f"Total packages: {len(packages)}")

        synced = 0
        for pkg in packages:
            try:
                with conn.cursor() as cur:
                    _upsert_package(cur, pkg)
                conn.commit()
                synced += 1
                if synced % 50 == 0:
                    log.info(f"Synced {synced}/{len(packages)}")
            except Exception as e:
                log.error(f"Failed to upsert {pkg.get('id')}: {e}")
                conn.rollback()

        log.info(f"Sync complete: {synced}/{len(packages)} packages")
    finally:
        release_conn(conn)
