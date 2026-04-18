"""
conftest.py — mock heavy DB/IO dependencies so unit tests run without a real DB.
"""
import sys
from unittest.mock import MagicMock

# Mock psycopg2 before any worker module imports it
sys.modules.setdefault('psycopg2', MagicMock())
sys.modules.setdefault('psycopg2.pool', MagicMock())

# Mock db module (used by scoring.py) — tests never call recalculate_dataset_score
db_mock = MagicMock()
db_mock.get_conn.return_value = MagicMock()
db_mock.release_conn.return_value = None
sys.modules.setdefault('db', db_mock)
