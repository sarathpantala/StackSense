.PHONY: help up down restart logs build migrate seed shell lint test clean

# ─── Default ───────────────────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# ─── Docker Compose ───────────────────────────────────────
up: ## Start all services (detached)
	docker compose up -d

up-build: ## Rebuild and start all services
	docker compose up -d --build

down: ## Stop all services
	docker compose down

restart: ## Restart all services
	docker compose restart

logs: ## Tail logs (all services)
	docker compose logs -f

logs-api: ## Tail backend logs only
	docker compose logs -f backend

ps: ## Show running containers
	docker compose ps

# ─── Backend ──────────────────────────────────────────────
migrate: ## Run Alembic migrations (auto-generate + upgrade)
	docker compose exec backend alembic revision --autogenerate -m "auto" && \
	docker compose exec backend alembic upgrade head

migrate-up: ## Apply pending migrations
	docker compose exec backend alembic upgrade head

migrate-down: ## Rollback last migration
	docker compose exec backend alembic downgrade -1

shell: ## Open a Python shell in the backend container
	docker compose exec backend python

bash: ## Open a bash shell in the backend container
	docker compose exec backend bash

# ─── Frontend ─────────────────────────────────────────────
ui: ## Start Next.js dev server (local, not Docker)
	cd frontend && npm run dev

ui-build: ## Build the Next.js production bundle
	cd frontend && npm run build

ui-install: ## Install frontend dependencies
	cd frontend && npm install

# ─── Quality ──────────────────────────────────────────────
lint: ## Lint frontend code
	cd frontend && npm run lint

# ─── Health ───────────────────────────────────────────────
health: ## Check API health endpoint
	@curl -sf http://localhost:8000/api/v1/health | python3 -m json.tool || echo "API not reachable"

# ─── Cleanup ──────────────────────────────────────────────
clean: ## Stop services and remove volumes
	docker compose down -v

nuke: ## Full reset — containers, volumes, images
	docker compose down -v --rmi local
