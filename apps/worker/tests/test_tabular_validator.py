"""
Unit tests for tabular_validator.py — pure helper functions (no file I/O or Frictionless).
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import tempfile, csv
from tabular_validator import (
    _is_numeric_fragment,
    _severity,
    _primary_issue,
    _manual_csv_check,
)


class TestIsNumericFragment:
    def test_integer_is_numeric(self):       assert _is_numeric_fragment("123")    is True
    def test_decimal_is_numeric(self):       assert _is_numeric_fragment("12.34")  is True
    def test_comma_number_is_numeric(self):  assert _is_numeric_fragment("1,234")  is True
    def test_percent_is_numeric(self):       assert _is_numeric_fragment("99%")    is True
    def test_empty_string_is_not(self):      assert _is_numeric_fragment("")       is False
    def test_text_is_not_numeric(self):      assert _is_numeric_fragment("hello")  is False
    def test_mixed_text_is_not(self):        assert _is_numeric_fragment("a1b2")   is False
    def test_whitespace_only_is_not(self):   assert _is_numeric_fragment("   ")    is False
    def test_only_comma_is_not(self):        assert _is_numeric_fragment(",")      is False


class TestSeverity:
    def test_valid_report_is_ok(self):
        assert _severity({"valid": True}) == "ok"

    def test_blank_header_is_critical(self):
        assert _severity({"valid": False, "blank-header": 1}) == "critical"

    def test_duplicate_header_is_critical(self):
        assert _severity({"valid": False, "duplicate-header": 2}) == "critical"

    def test_source_error_is_critical(self):
        assert _severity({"valid": False, "source-error": 1}) == "critical"

    def test_encoding_error_is_critical(self):
        assert _severity({"valid": False, "encoding-error": 1}) == "critical"

    def test_many_missing_values_is_high(self):
        assert _severity({"valid": False, "missing-value": 101}) == "high"

    def test_few_missing_values_is_medium(self):
        assert _severity({"valid": False, "missing-value": 5}) == "medium"

    def test_extra_value_only_is_low(self):
        assert _severity({"valid": False, "extra-value": 3}) == "low"

    def test_empty_non_valid_report_is_low(self):
        # no specific errors recorded but valid=False
        assert _severity({"valid": False}) == "low"


class TestPrimaryIssue:
    def test_source_error_priority(self):
        report = {"source-error": 1, "blank-header": 1}
        assert _primary_issue(report) == "source_error"

    def test_blank_header_before_blank_row(self):
        report = {"blank-header": 1, "blank-row": 5}
        assert _primary_issue(report) == "header_error"

    def test_missing_value_issue(self):
        assert _primary_issue({"missing-value": 10}) == "missing_values"

    def test_extra_value_issue(self):
        assert _primary_issue({"extra-value": 2}) == "extra_values"

    def test_no_errors_returns_none(self):
        assert _primary_issue({}) is None

    def test_all_zeros_returns_none(self):
        assert _primary_issue({"blank-header": 0, "extra-value": 0}) is None


class TestManualCsvCheck:
    def _write_csv(self, rows: list[list[str]], sep: str = ",") -> str:
        fd, path = tempfile.mkstemp(suffix=".csv")
        os.close(fd)
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f, delimiter=sep)
            writer.writerows(rows)
        return path

    def test_clean_csv_has_no_errors(self):
        path = self._write_csv([["a","b","c"], ["1","2","3"], ["4","5","6"]])
        result = _manual_csv_check(path, "csv", "utf-8")
        assert result["extra-value"]   == 0
        assert result["blank-row"]     == 0
        assert result["missing-value"] == 0
        os.unlink(path)

    def test_detects_blank_rows(self):
        path = self._write_csv([["a","b"], ["1","2"], ["",""], ["3","4"]])
        result = _manual_csv_check(path, "csv", "utf-8")
        assert result["blank-row"] >= 1
        os.unlink(path)

    def test_detects_missing_values(self):
        path = self._write_csv([["a","b","c"], ["1","2"]])  # row has 2 instead of 3
        result = _manual_csv_check(path, "csv", "utf-8")
        assert result["missing-value"] >= 1
        os.unlink(path)

    def test_detects_extra_values(self):
        # Row has more columns than header and extras are non-numeric text
        path = self._write_csv([["a","b"], ["1","2","EXTRA_TEXT"]])
        result = _manual_csv_check(path, "csv", "utf-8")
        assert result["extra-value"] >= 1
        os.unlink(path)

    def test_numeric_extra_counted_as_format_error_not_extra_value(self):
        # Unquoted numbers with commas look like extra cells but are format errors
        path = self._write_csv([["a","b"], ["1,234","5"]])
        result = _manual_csv_check(path, "csv", "utf-8")
        # The numeric fragment "234" should NOT count as extra-value
        assert result["extra-value"] == 0
        os.unlink(path)

    def test_non_csv_format_returns_zeros(self):
        result = _manual_csv_check("/any/path", "xlsx", "utf-8")
        assert result["extra-value"] == 0
        assert result["blank-row"]   == 0

    def test_tsv_support(self):
        path = self._write_csv([["a","b","c"], ["1","2","3"]], sep="\t")
        result = _manual_csv_check(path, "tsv", "utf-8")
        assert result["extra-value"] == 0
        os.unlink(path)
