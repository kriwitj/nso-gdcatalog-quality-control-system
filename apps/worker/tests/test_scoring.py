"""
Unit tests for scoring.py — grade_from_score (pure function, no DB).
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scoring import grade_from_score


class TestGradeFromScore:
    # ── boundary values ──────────────────────────────────────────────
    def test_90_is_A(self):        assert grade_from_score(90)    == "A"
    def test_100_is_A(self):       assert grade_from_score(100)   == "A"
    def test_75_is_B(self):        assert grade_from_score(75)    == "B"
    def test_89_9_is_B(self):      assert grade_from_score(89.9)  == "B"
    def test_60_is_C(self):        assert grade_from_score(60)    == "C"
    def test_74_9_is_C(self):      assert grade_from_score(74.9)  == "C"
    def test_40_is_D(self):        assert grade_from_score(40)    == "D"
    def test_59_9_is_D(self):      assert grade_from_score(59.9)  == "D"
    def test_39_9_is_F(self):      assert grade_from_score(39.9)  == "F"
    def test_0_is_F(self):         assert grade_from_score(0)     == "F"
    def test_negative_is_F(self):  assert grade_from_score(-1)    == "F"

    # ── exact boundaries match TypeScript scoreToGrade ───────────────
    def test_boundary_90_is_A_not_B(self): assert grade_from_score(90) == "A"
    def test_boundary_75_is_B_not_C(self): assert grade_from_score(75) == "B"
    def test_boundary_60_is_C_not_D(self): assert grade_from_score(60) == "C"
    def test_boundary_40_is_D_not_F(self): assert grade_from_score(40) == "D"

    # ── return type ──────────────────────────────────────────────────
    def test_returns_string(self):
        assert isinstance(grade_from_score(80), str)
