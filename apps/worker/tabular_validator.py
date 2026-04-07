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


def _is_numeric_fragment(s: str) -> bool:
    """ตรวจว่า string นี้เป็นส่วนของตัวเลขที่ถูกตัดด้วย comma ที่ไม่ได้ quote
    เช่น '272.25' หรือ '200' หรือ '663,200' (ยังมี comma อยู่)"""
    s = s.strip()
    if not s:
        return False
    return all(c.isdigit() or c in '.,% -' for c in s) and any(c.isdigit() for c in s)


def _manual_csv_check(path: str, fmt: str, encoding: str) -> dict:
    """ตรวจ extra-cell / blank-row ด้วย Python csv module (ไม่พึ่ง frictionless)
    แยกแยะ extra-value จริง vs ตัวเลขที่มี comma ไม่ใส่ quote"""
    result = {"extra-value": 0, "blank-row": 0, "missing-value": 0, "format-error": 0, "error": ""}
    if fmt not in ("csv", "tsv"):
        return result
    try:
        import csv as _csv
        sep = "\t" if fmt == "tsv" else ","
        # ลอง utf-8-sig ก่อนเพื่อตัด BOM ออก
        enc_try = "utf-8-sig" if encoding.lower().replace("-","") in ("utf8","utf8sig") else encoding
        try:
            with open(path, encoding=enc_try, errors="replace", newline="") as f:
                rows = list(_csv.reader(f, delimiter=sep))
        except Exception:
            with open(path, encoding="utf-8", errors="replace", newline="") as f:
                rows = list(_csv.reader(f, delimiter=sep))
        if not rows:
            return result
        header_count = len(rows[0])
        extra_rows, blank_rows, missing_rows, unquoted_rows = [], [], [], []
        for i, row in enumerate(rows[1:], start=1):
            cell_count = len(row)
            if cell_count == 0 or all(c.strip() == "" for c in row):
                blank_rows.append(i)
            elif cell_count > header_count:
                # ตรวจว่า extra cells (ส่วนที่เกิน) เป็น numeric fragment หรือไม่
                # ถ้าใช่ → น่าจะเป็นตัวเลขที่มี comma ไม่ได้ quote
                extra_cells = row[header_count:]
                if all(_is_numeric_fragment(c) for c in extra_cells):
                    unquoted_rows.append(i)
                else:
                    extra_rows.append(i)
            elif cell_count < header_count:
                missing_rows.append(i)
        result["extra-value"]   = len(extra_rows)
        result["blank-row"]     = len(blank_rows)
        result["missing-value"] = len(missing_rows)
        result["format-error"]  = len(unquoted_rows)
        msgs = []
        if extra_rows:
            msgs.append(f"Extra values found in rows: {extra_rows[:20]}")
        if unquoted_rows:
            msgs.append(f"ตัวเลขที่มี comma ไม่ใส่ quote (unquoted number) ใน rows: {unquoted_rows[:20]}")
        if blank_rows:
            msgs.append(f"Blank rows: {blank_rows[:20]}")
        if missing_rows:
            msgs.append(f"Missing values in rows: {missing_rows[:20]}")
        result["error"] = "; ".join(msgs)
        log.debug(
            f"manual_csv_check: extra={len(extra_rows)} unquoted={len(unquoted_rows)} "
            f"blank={len(blank_rows)} missing={len(missing_rows)}"
        )
    except Exception as e:
        log.debug(f"manual_csv_check failed: {e}")
    return result


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

        # ── รวบรวม errors (frictionless v4/v5) ──────────────────────
        # frictionless v5 จัด extra-cell, extra-label เป็น "warning" ไม่ใช่ error
        # → ต้อง enumerate ทั้ง errors และ warnings เพื่อให้ตรงกับมาตรฐานกลาง

        def _collect_issues(items):
            for err in (items or []):
                try:
                    t = err[0] if isinstance(err, (list, tuple)) else getattr(err, "type", "")
                    m = err[1] if isinstance(err, (list, tuple)) else getattr(err, "message", "")
                except Exception:
                    continue
                if "is not safe" in str(m):
                    continue
                errors_by_type[t] = errors_by_type.get(t, 0) + 1
                if len(error_messages) < 30:
                    error_messages.append(str(m))

        # errors
        try:
            _collect_issues(report.flatten(["type", "message"]))
        except Exception:
            pass

        # warnings — frictionless v5 เก็บใน task.warnings เป็น string list
        # (extra-cell, missing-cell ฯลฯ ที่ v5 ถือว่า "warning" ไม่ fail validation)
        try:
            for task in (report.tasks or []):
                for w in getattr(task, "warnings", []):
                    w_str = str(w)
                    if "is not safe" in w_str:
                        continue
                    # บาง v5 ส่ง Error object; บาง v5 ส่ง string ล้วน
                    t = getattr(w, "type", None)
                    m = getattr(w, "message", None)
                    if not t:
                        # parse type จาก string message
                        w_lower = w_str.lower()
                        if "extra cell" in w_lower:
                            t = "extra-cell"
                        elif "missing cell" in w_lower:
                            t = "missing-cell"
                        elif "blank row" in w_lower:
                            t = "blank-row"
                        elif "blank label" in w_lower or "blank header" in w_lower:
                            t = "blank-label"
                        elif "duplicate label" in w_lower or "duplicate header" in w_lower:
                            t = "duplicate-label"
                        elif "type error" in w_lower:
                            t = "type-error"
                        elif "encoding" in w_lower:
                            t = "encoding-error"
                        else:
                            continue  # ไม่รู้จักประเภท ข้ามไป
                    errors_by_type[t] = errors_by_type.get(t, 0) + 1
                    if len(error_messages) < 30:
                        error_messages.append(m or w_str)
        except Exception:
            pass

        # map error types → our keys
        for fr_type, our_key in TYPE_MAP.items():
            cnt = errors_by_type.get(fr_type, 0)
            if cnt:
                result[our_key] = result.get(our_key, 0) + cnt

        result["error_count"] = sum(result[k] for k in ERROR_KEYS)

        # valid = report.valid AND ไม่มี error ใด ๆ ที่นับได้
        # (ครอบคลุมกรณี frictionless v5 ที่ extra-cell เป็น warning → report.valid=True)
        result["valid"]  = bool(report.valid) and result["error_count"] == 0
        result["error"]  = "; ".join(error_messages) if error_messages else ""

        # row count จาก frictionless ถ้า pandas ไม่ได้
        if result["row_count"] is None:
            try:
                if report.stats:
                    result["row_count"] = report.stats.get("rows")
            except Exception:
                pass

        # ── manual fallback: ตรวจ extra-cell/blank-row ด้วย Python csv ──
        # frictionless v5 อาจ miss extra-cell (เก็บเป็น warning ที่ไม่ถูก map)
        if fmt in ("csv", "tsv"):
            manual = _manual_csv_check(file_path, fmt, enc)
            for key in ("extra-value", "blank-row", "missing-value", "format-error"):
                if manual[key] > result[key]:
                    result[key] = manual[key]
            result["error_count"] = sum(result[k] for k in ERROR_KEYS)
            result["valid"] = result["valid"] and result["error_count"] == 0
            if manual["error"] and not result["error"]:
                result["error"] = manual["error"]

    except Exception as e:
        log.warning(f"Frictionless error: {e}")
        # ไม่สามารถ validate ได้ — ทิ้ง valid=None (is_valid จะเป็น null ใน DB)
        # ไม่ set valid=True แม้ pandas อ่านได้ เพราะยังไม่ได้ตรวจจริง
        result["valid"]       = None
        result["source-error"] = 1
        result["error"]        = f"Validation failed: {str(e)[:300]}"
        result["error_count"]  = 1
    finally:
        os.chdir(orig_cwd)
        if local_copy and os.path.exists(local_copy):
            try: os.unlink(local_copy)
            except Exception: pass

    result["severity"]      = _severity(result)
    result["primary_issue"] = _primary_issue(result)
    return result