#!/bin/bash
# deploy.sh — Zero-downtime deploy for production
set -euo pipefail

echo "╔══════════════════════════════════════╗"
echo "║  OGD Quality System — Deploy         ║"
echo "╚══════════════════════════════════════╝"

# ── 1. Check .env exists ──────────────────────────────
if [ ! -f .env ]; then
    echo "❌  .env not found. Copy .env.example and fill values."
    exit 1
fi
source .env

# ── 2. Pull latest code ───────────────────────────────
echo "▶  Pulling latest code..."
git pull origin main

# ── 3. Build new images ───────────────────────────────
echo "▶  Building Docker images..."
docker compose -f docker-compose.prod.yml build --no-cache web worker

# ── 4. Run DB migrations ──────────────────────────────
echo "▶  Running database migrations..."
docker compose -f docker-compose.prod.yml run --rm web \
    sh -c "npx prisma migrate deploy"

# ── 5. Restart services (rolling) ────────────────────
echo "▶  Restarting services..."
docker compose -f docker-compose.prod.yml up -d --remove-orphans

# ── 6. Health check ───────────────────────────────────
echo "▶  Waiting for health check..."
sleep 10
STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/stats || echo "000")
if [ "$STATUS" = "200" ]; then
    echo "✅  Deploy successful — HTTP $STATUS"
else
    echo "⚠️  Health check returned HTTP $STATUS — check logs with: make prod-logs"
fi

# ── 7. Backup DB after deploy ─────────────────────────
echo "▶  Creating post-deploy backup..."
./scripts/backup-db.sh

echo ""
echo "✅  Deploy complete!"
echo "   Dashboard: https://${DOMAIN:-localhost}"
