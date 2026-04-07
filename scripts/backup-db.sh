#!/bin/bash
# backup-db.sh — PostgreSQL backup with rotation
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/ogd}"
KEEP_DAYS="${KEEP_DAYS:-14}"
DATE=$(date +%Y%m%d_%H%M%S)
FILE="${BACKUP_DIR}/ogd_${DATE}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[backup] Starting PostgreSQL backup → ${FILE}"

docker compose exec -T postgres pg_dump \
    -U "${POSTGRES_USER:-ogd}" \
    "${POSTGRES_DB:-ogdquality}" \
  | gzip > "${FILE}"

SIZE=$(du -sh "${FILE}" | cut -f1)
echo "[backup] Done — ${SIZE}"

# Rotate: delete backups older than KEEP_DAYS
find "${BACKUP_DIR}" -name "ogd_*.sql.gz" -mtime "+${KEEP_DAYS}" -delete
echo "[backup] Rotated backups older than ${KEEP_DAYS} days"
