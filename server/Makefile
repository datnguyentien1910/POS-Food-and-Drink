COMPOSE := docker compose
DB ?= restodash
FILE ?= backups/restodash.dump

.PHONY: up down logs migrate seed db-reset test e2e lint build backup restore

up: ## Khởi động Postgres
	$(COMPOSE) up -d db

down: ## Dừng container (giữ dữ liệu)
	$(COMPOSE) down

logs: ## Theo dõi log Postgres
	$(COMPOSE) logs -f db

migrate: ## Áp dụng migration
	npx prisma migrate deploy

seed: ## Nạp dữ liệu mẫu (idempotent)
	npx prisma db seed

db-reset: ## Xoá và tạo lại DB, chạy migration + seed
	npx prisma migrate reset --force

test: ## Unit test
	npm test

e2e: ## End-to-end test (cần DB test)
	npm run test:e2e

lint: ## Lint
	npm run lint

build: ## Build
	npm run build

backup: ## Sao lưu: make backup DB=restodash FILE=backups/restodash.dump
	./scripts/backup.sh $(DB) $(FILE)

restore: ## Phục hồi: make restore DB=restodash FILE=backups/restodash.dump
	./scripts/restore.sh $(DB) $(FILE)
