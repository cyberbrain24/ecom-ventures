.PHONY: help up down restart logs ps test lint check clean nginx-reload migrate-platform-up migrate-platform-down

# Display available commands
help:
	@echo "Ecom Ventures Engineering Control Interface"
	@echo "---------------------------------------------"
	@echo "make up                    - Start all Docker infrastructure containers"
	@echo "make down                  - Stop and preserve container volumes"
	@echo "make restart               - Restart all containers"
	@echo "make logs                  - Tail logs across all containers"
	@echo "make ps                    - View running container status"
	@echo "make nginx-reload          - Reload Nginx reverse proxy configuration"
	@echo "make test                  - Run all backend unit and integration tests"
	@echo "make lint                  - Lint frontend and backend codebases"
	@echo "make check                 - Execute .agent/checks.sh verification suite"
	@echo "make migrate-platform-up   - Apply Central Platform DB migrations"
	@echo "make migrate-platform-down - Rollback latest Platform DB migration"
	@echo "make clean                 - Tear down containers and prune dangling volumes"

# Docker management commands
up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

ps:
	docker compose ps

nginx-reload:
	docker compose exec reverse-proxy nginx -s reload

# Testing and verification commands
test:
	cd backend && go test -v ./...

lint:
	cd backend && go vet ./...
	npm run lint

check:
	bash .agent/checks.sh

# Database migration commands
migrate-platform-up:
	cd backend && go run cmd/migrate/main.go -direction=up -path=../infra/migrations/platform

migrate-platform-down:
	cd backend && go run cmd/migrate/main.go -direction=down -path=../infra/migrations/platform

clean:
	docker compose down -v

seed-pilot:
	cd backend && go run cmd/seed/main.go

docker-prod-config:
	docker compose -f docker-compose.prod.yml config

