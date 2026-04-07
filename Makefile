.PHONY: dev prod down logs ps migrate seed sync scan backup help

# ─── Development ────────────────────────────────────────
dev:
	@cp -n .env.example .env 2>/dev/null || true
	docker compose up --build -d
	@echo "✅  System running at http://localhost:3000"

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

# ─── Database ───────────────────────────────────────────
migrate:
	docker compose exec web npx prisma migrate dev

migrate-prod:
	docker compose -f docker-compose.prod.yml exec web npx prisma migrate deploy

studio:
	docker compose exec web npx prisma studio

seed:
	docker compose exec web npx ts-node src/scripts/seed.ts

# ─── Operations ─────────────────────────────────────────
sync:
	@echo "▶  Triggering CKAN catalog sync..."
	curl -s -X POST http://localhost:3000/api/sync | jq .

scan:
	@echo "▶  Triggering full quality scan..."
	curl -s -X POST http://localhost:3000/api/scan | jq .

stats:
	curl -s http://localhost:3000/api/stats | jq .

# ─── Production ─────────────────────────────────────────
prod:
	docker compose -f docker-compose.prod.yml up --build -d
	@echo "✅  Production system running"

prod-down:
	docker compose -f docker-compose.prod.yml down

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

# ─── Backup ─────────────────────────────────────────────
backup:
	@./scripts/backup-db.sh

# ─── Help ───────────────────────────────────────────────
help:
	@echo ""
	@echo "  OGD Quality System — Commands"
	@echo ""
	@echo "  make dev          Start development stack"
	@echo "  make down         Stop development stack"
	@echo "  make logs         Follow all logs"
	@echo "  make migrate      Run DB migrations (dev)"
	@echo "  make studio       Open Prisma Studio"
	@echo "  make sync         Trigger CKAN sync now"
	@echo "  make scan         Trigger quality scan now"
	@echo "  make stats        Show quality stats"
	@echo "  make prod         Start production stack"
	@echo "  make backup       Backup database"
	@echo ""
