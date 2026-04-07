"""
db.py — Thread-safe PostgreSQL connection pool using psycopg2.
"""
import os, logging, threading
from urllib.parse import urlparse
import psycopg2
from psycopg2 import pool as pg_pool

log = logging.getLogger("db")

_pool: pg_pool.ThreadedConnectionPool | None = None
_pool_lock = threading.Lock()   # กัน race condition ตอนสร้าง pool


def _make_pool() -> pg_pool.ThreadedConnectionPool:
    url = os.environ["DATABASE_URL"]
    parsed = urlparse(url)
    return pg_pool.ThreadedConnectionPool(
        minconn=2,
        maxconn=15,
        host=parsed.hostname,
        port=parsed.port or 5432,
        dbname=parsed.path.lstrip("/"),
        user=parsed.username,
        password=parsed.password,
    )


def get_conn():
    global _pool
    # Double-checked locking pattern — thread-safe pool init
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _pool = _make_pool()
                log.info("[db] Connection pool created")
    return _pool.getconn()


def release_conn(conn):
    global _pool
    if _pool is None or conn is None:
        return
    try:
        _pool.putconn(conn)
    except Exception as e:
        log.warning(f"[db] putconn error: {e} — closing connection")
        try:
            conn.close()
        except Exception:
            pass