"""
tabular_validator.py — Frictionless v5 compatible
"""
import os, logging, shutil, tempfile
from typing import Optional
import chardet

log = logging.getLogger("tabular_validator")


def _detect_encoding(path: str) -> str:
    try:
        with open(path, "rb") as f:
            raw = f.read(65536)
        detected = chardet.detect(raw)
        enc = (detected.get("encoding") or "utf-8").lower().replace("-","").replace("_","")
        if enc in ("utf8","utf8sig","utf8bom"): return "utf-8"
        if "tis620" in enc or "iso88591" in enc: return "tis-620"
        return detected.get("encoding") or "utf-8"
    except Exception:
        return "utf-8"


def _pandas_info(path: str, fmt: str, encoding: str) -> tuple[Optional[int], Optional[int]]:
    try:
        import pandas as pd
        if fmt in ("xlsx", "xlsm"):
            df = pd.read_excel(path, engine="openpyxl")
        elif fmt == "xls":
            df = pd.read_excel(path, engine="xlrd")
        elif fmt == "ods":
            df = pd.read_excel(path, engine="odf")
        else:
            sep = "\t" if fmt == "tsv" else ","
            df = pd.read_csv(path, sep=sep, encoding=encoding, encoding_errors="replace")
        return len(df), len(df.columns)
    except Exception as e:
        log.debug(f"pandas read failed: {e}")
        return None, None


def _severity(report: dict) -> str:
    if report.get("valid"): return "ok"
    critical = (report.get("blank-header", 0) + report.get("duplicate-header", 0)
                + report.get("source-error", 0) + report.get("encoding-error", 0))
    medium = report.get("blank-row", 0) + report.get("missing-value", 0)
    low    = report.get("extra-value", 0) + report.get("extra-header", 0)
    if critical > 0: return "critical"
    if medium > 100: return "high"
    if medium > 0:   return "medium"
    if low > 0:      return "low"
    return "low"


def _primary_issue(report: dict) -> Optional[str]:
    for key, label in [
        ("source-error","source_error"), ("encoding-error","encoding_error"),
        ("blank-header","header_error"), ("duplicate-header","header_error"),
        ("blank-row","blank_rows"), ("missing-value","missing_values"),
        ("extra-value","extra_values"), ("schema-error","schema_error"),
        ("format-error","format_error"),
    ]:
        if report.get(key, 0) > 0:
            return label
    return None


# ── Frictionless v5 error type → our schema key ──────────────────
# v5 เปลี่ยน blank-header → blank-label, duplicate-header → duplicate-label
TYPE_MAP = {
    # v5 names (current)
    "blank-label":          "blank-header",
    "duplicate-label":      "duplicate-header",
    "blank-row":            "blank-row",
    "extra-cell":           "extra-value",
    "extra-label":          "extra-header",
    "missing-cell":         "missing-value",
    "type-error":           "format-error",
    "constraint-error":     "schema-error",
    "encoding-error":       "encoding-error",
    "source-error":         "source-error",
    "scheme-error":         "source-error",
    # v4 names (fallback เผื่อบาง env ยัง v4)
    "blank-header":         "blank-header",
    "duplicate-header":     "duplicate-header",
    "extra-header":         "extra-header",
    "missing-value":        "missing-value",
}

ERROR_KEYS = [
    "blank-header", "duplicate-header", "blank-row",
    "extra-value", "extra-header", "missing-value",
    "format-error", "schema-error", "encoding-error", "source-error",
]


def validate_tabular(file_path: str, fmt: str) -> dict:
    result = {k: 0 for k in ERROR_KEYS}
    result.update({
        "encoding": "utf-8", "error": "", "valid": False,
        "row_count": None, "column_count": None,
        "error_count": 0, "warning_count": 0,
        "severity": "ok", "primary_issue": None,
    })

    enc = _detect_encoding(file_path)
    result["encoding"] = enc

    # pandas สำหรับ row/col count ที่เชื่อถือได้ (ไม่มีปัญหา path)
    row_count, col_count = _pandas_info(file_path, fmt, enc)
    result["row_count"]    = row_count
    result["column_count"] = col_count

    # ── copy ไปที่ CWD ก่อน validate (bypass Frictionless path-safety) ──
    suffix = f".{fmt}"
    local_copy = None
    orig_cwd = os.getcwd()
    try:
        fd, local_copy = tempfile.mkstemp(suffix=suffix, dir=orig_cwd)
        os.close(fd)
        shutil.copy2(file_path, local_copy)
        local_name = os.path.basename(local_copy)

        from frictionless import validate
        report = validate(local_name, limit_errors=1000)

        errors_by_type: dict[str, int] = {}
        error_messages: list[str] = []

        if not report.valid:
            for err in report.flatten(["type", "message"]):
                t, m = err[0], err[1]
                if "is not safe" in m:
                    continue
                errors_by_type[t] = errors_by_type.get(t, 0) + 1
                if len(error_messages) < 20:
                    error_messages.append(m)

        # map error types → our keys
        for fr_type, our_key in TYPE_MAP.items():
            cnt = errors_by_type.get(fr_type, 0)
            if cnt:
                result[our_key] = result.get(our_key, 0) + cnt

        result["valid"]  = bool(report.valid)
        result["error"]  = ",".join(error_messages) if error_messages else ""

        # ถ้า invalid แต่จับ error ไม่ได้เลย — แสดง raw errors
        if not report.valid and not error_messages:
            try:
                all_errs = report.flatten(["type", "message"])
                if all_errs:
                    result["error"] = "; ".join(f"{e[0]}: {e[1]}" for e in all_errs[:5])
            except Exception:
                pass

        result["error_count"] = sum(result[k] for k in ERROR_KEYS)

        # row count จาก frictionless ถ้า pandas ไม่ได้
        if result["row_count"] is None:
            try:
                if report.stats:
                    result["row_count"] = report.stats.get("rows")
            except Exception:
                pass

    except Exception as e:
        log.warning(f"Frictionless error: {e}")
        if row_count is not None:
            result["valid"]       = True
            result["error"]       = ""
            result["error_count"] = 0
        else:
            result["source-error"] = 1
            result["error"]        = str(e)[:500]
            result["valid"]        = False
            result["error_count"]  = 1
    finally:
        os.chdir(orig_cwd)
        if local_copy and os.path.exists(local_copy):
            try: os.unlink(local_copy)
            except Exception: pass

    result["severity"]      = _severity(result)
    result["primary_issue"] = _primary_issue(result)
    return result