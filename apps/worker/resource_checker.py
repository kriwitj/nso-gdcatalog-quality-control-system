"""
resource_checker.py
Downloads and inspects each resource URL, determines:
  - HTTP status / downloadability
  - Format / structured status / machine readability
  - Timeliness status
  - Invokes tabular_validator for CSV/XLSX/JSON/XML
"""
import os, time, logging, tempfile, mimetypes
from datetime import datetime, timezone, timedelta
from typing import Optional
import requests

from tabular_validator import validate_tabular

log = logging.getLogger("resource_checker")

MAX_FILE_SIZE   = int(os.getenv("MAX_FILE_SIZE_MB", "100")) * 1024 * 1024  # bytes
DOWNLOAD_TIMEOUT = int(os.getenv("DOWNLOAD_TIMEOUT", "60"))

# ─── Format classification ────────────────────────────────────────
MACHINE_READABLE_FORMATS = {
    "csv", "tsv", "json", "jsonl", "geojson", "xml", "xlsx", "xls",
    "ods", "parquet", "avro", "ndjson",
}
STRUCTURED_FORMATS = MACHINE_READABLE_FORMATS | {"kml", "gpkg", "gml"}
UNSTRUCTURED_FORMATS = {"pdf", "doc", "docx", "ppt", "pptx", "jpg", "jpeg", "png", "gif", "mp4"}
TABULAR_FORMATS = {"csv", "tsv", "xlsx", "xls", "ods"}
TEXT_FORMATS    = {"json", "xml", "geojson"}

# ─── Formats that cannot be meaningfully scanned ─────────────────
# (database connections, OGC services, web pages, API endpoints, etc.)
UNSCANNABLE_FORMATS = {
    "database", "db", "api", "rest", "soap",
    "wms", "wfs", "wcs", "wmts", "csw",
    "sparql", "arcgis", "esri", "ogc",
    "html", "webpage", "web", "link", "url",
    "shapefilezip", "app",
}

CONTENT_TYPE_MAP = {
    "text/csv":                          "csv",
    "application/vnd.ms-excel":          "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/json":                  "json",
    "application/geo+json":              "geojson",
    "text/xml":                          "xml",
    "application/xml":                   "xml",
    "application/pdf":                   "pdf",
    "application/zip":                   "zip",
}

# ─── Timeliness rules (days) ──────────────────────────────────────
TIMELINESS_RULES = {
    "daily":    (2,   7),
    "รายวัน":  (2,   7),
    "weekly":   (10,  21),
    "รายสัปดาห์": (10, 21),
    "monthly":  (45,  90),
    "รายเดือน": (45, 90),
    "quarterly":(100, 120),
    "รายไตรมาส":(100, 120),
    "yearly":   (400, 550),
    "รายปี":   (400, 550),
}


def detect_format_from_url(url: str) -> Optional[str]:
    path = url.split("?")[0].split("#")[0]
    ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    return ext or None


def detect_format_from_content_type(ct: str) -> Optional[str]:
    if not ct:
        return None
    ct_base = ct.split(";")[0].strip().lower()
    return CONTENT_TYPE_MAP.get(ct_base)


def classify_structured(fmt: Optional[str]) -> str:
    if not fmt:
        return "unknown"
    f = fmt.lower()
    if f in STRUCTURED_FORMATS:
        return "structured"
    if f == "zip":
        return "semi_structured"
    if f in UNSTRUCTURED_FORMATS:
        return "unstructured"
    return "unknown"


def is_machine_readable_fmt(fmt: Optional[str]) -> bool:
    if not fmt:
        return False
    return fmt.lower() in MACHINE_READABLE_FORMATS


def compute_timeliness(metadata_modified: Optional[str], update_frequency: Optional[str]) -> str:
    if not metadata_modified:
        return "unknown"
    try:
        mod_dt = datetime.fromisoformat(metadata_modified.replace("Z", "+00:00"))
    except Exception:
        return "unknown"

    now = datetime.now(timezone.utc)
    days_since = (now - mod_dt).days

    freq = (update_frequency or "").lower().strip()
    thresholds = TIMELINESS_RULES.get(freq)
    if not thresholds:
        # Try partial match
        for key, val in TIMELINESS_RULES.items():
            if key in freq:
                thresholds = val
                break

    if not thresholds:
        # Default: warn after 180d, outdated after 365d
        thresholds = (180, 365)

    warn_days, outdated_days = thresholds
    if days_since <= warn_days:
        return "up_to_date"
    if days_since <= outdated_days:
        return "warning"
    return "outdated"


def check_resource(
    resource_id: str,
    resource_url: str,
    resource_format: Optional[str],
    metadata_modified: Optional[str],
    update_frequency: Optional[str],
) -> dict:
    t0 = time.time()
    result: dict = {
        "http_status": None, "downloadable": None, "content_type": None,
        "file_size": None, "redirect_url": None, "detected_format": None,
        "is_machine_readable": None, "is_structured": None,
        "structured_status": None, "timeliness_status": None,
        "encoding": None, "row_count": None, "column_count": None,
        "is_valid": None, "error_count": None, "warning_count": None,
        "partial_scan": False, "scan_duration_ms": None, "error_msg": None,
        "validity_report": None,
    }

    # ── 0. Skip unscannable formats (database, API services, etc.) ─
    fmt_declared = (resource_format or "").lower().strip()
    if fmt_declared in UNSCANNABLE_FORMATS:
        result["detected_format"]    = resource_format
        result["structured_status"]  = "unknown"
        result["is_machine_readable"] = False
        result["is_structured"]      = False
        result["timeliness_status"]  = compute_timeliness(metadata_modified, update_frequency)
        result["error_msg"]          = f"Skipped: unscannable format '{resource_format}'"
        result["scan_duration_ms"]   = 0
        return result

    # ── 1. Timeliness ─────────────────────────────────────────────
    result["timeliness_status"] = compute_timeliness(metadata_modified, update_frequency)

    tmp_path = None
    try:
        # ── 2. HTTP HEAD check ────────────────────────────────────
        headers = {"User-Agent": "OGD-Quality-System/1.0 (quality check)"}
        try:
            head = requests.head(resource_url, headers=headers, timeout=15, allow_redirects=True)
            result["http_status"] = head.status_code
            result["content_type"] = head.headers.get("Content-Type", "")
            cl = head.headers.get("Content-Length")
            if cl:
                result["file_size"] = int(cl)
            if head.url != resource_url:
                result["redirect_url"] = head.url
        except requests.exceptions.SSLError:
            head = requests.head(resource_url, headers=headers, timeout=15, allow_redirects=True, verify=False)
            result["http_status"] = head.status_code
        except Exception as e:
            result["downloadable"]        = False
            result["error_msg"]           = f"HEAD failed: {e}"
            result["structured_status"]   = "unknown"
            result["is_machine_readable"] = None
            result["is_structured"]       = None
            result["scan_duration_ms"]    = int((time.time() - t0) * 1000)
            return result

        # ── 3. Format detection ───────────────────────────────────
        detected = (
            detect_format_from_content_type(result["content_type"] or "") or
            detect_format_from_url(resource_url) or
            (resource_format or "").lower() or None
        )
        result["detected_format"] = detected
        result["structured_status"] = classify_structured(detected)
        result["is_machine_readable"] = is_machine_readable_fmt(detected)
        result["is_structured"] = result["is_machine_readable"]

        if result["http_status"] not in (200, 206):
            result["downloadable"]       = False
            result["error_msg"]          = f"HTTP {result['http_status']}"
            # ไม่สามารถตรวจสอบได้จริง → ไม่ทราบโครงสร้าง
            result["structured_status"]  = "unknown"
            result["is_machine_readable"] = None
            result["is_structured"]      = None
            result["scan_duration_ms"]   = int((time.time() - t0) * 1000)
            return result

        result["downloadable"] = True

        # ── 4. Download for tabular/text validation ───────────────
        fmt_lower = (detected or "").lower()
        if fmt_lower not in TABULAR_FORMATS and fmt_lower not in TEXT_FORMATS:
            # Not a format we can validate further
            result["scan_duration_ms"] = int((time.time() - t0) * 1000)
            return result

        # Stream download with size limit
        suffix = f".{fmt_lower}" if fmt_lower else ""
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False, dir="/tmp/ogd_files") as tmp:
            tmp_path = tmp.name

        downloaded = 0
        partial = False
        try:
            get_resp = requests.get(resource_url, headers=headers, timeout=DOWNLOAD_TIMEOUT,
                                    allow_redirects=True, stream=True, verify=False)
            with open(tmp_path, "wb") as f:
                for chunk in get_resp.iter_content(chunk_size=65536):
                    f.write(chunk)
                    downloaded += len(chunk)
                    if downloaded >= MAX_FILE_SIZE:
                        partial = True
                        break
        except Exception as e:
            result["error_msg"] = f"Download failed: {e}"
            result["scan_duration_ms"] = int((time.time() - t0) * 1000)
            return result

        result["file_size"] = downloaded
        result["partial_scan"] = partial

        # ── 5. Tabular validation ─────────────────────────────────
        if fmt_lower in TABULAR_FORMATS:
            vr = validate_tabular(tmp_path, fmt_lower)
            result["encoding"]       = vr.get("encoding")
            result["row_count"]      = vr.get("row_count")
            result["column_count"]   = vr.get("column_count")
            result["is_valid"]       = vr.get("valid")
            result["error_count"]    = vr.get("error_count", 0)
            result["warning_count"]  = vr.get("warning_count", 0)
            result["validity_report"] = vr

    except Exception as e:
        log.error(f"check_resource {resource_id}: {e}")
        result["error_msg"] = str(e)[:500]
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
        result["scan_duration_ms"] = int((time.time() - t0) * 1000)

    return result
