# =============================================================================
# Makefile — SW3 local development commands
#
# Quick start:
#   make setup    # first-time setup (copy env, check deps)
#   make dev      # start full local stack
#   make stop     # stop all containers
#   make clean    # remove containers, volumes, and build caches
#
# Individual targets:
#   make infra              # start only infrastructure (postgres, redis, clickhouse, anvil)
#   make services           # start platform services on top of infra
#   make observability      # start prometheus, loki, grafana
#   make deploy-contracts   # deploy Solidity contracts to Anvil
#   make migrate            # run database migrations
#   make logs               # tail all container logs
#   make ps                 # show running containers
#   make build-rust         # cargo build --release
#   make build-ts           # pnpm install && pnpm build
#   make test-golden-path   # run the golden-path smoke test script
# =============================================================================

.DEFAULT_GOAL := help
SHELL         := /bin/bash
COMPOSE       := docker compose
ENV_FILE      := .env.local

# Colour helpers
GREEN  := \033[0;32m
YELLOW := \033[0;33m
NC     := \033[0m

.PHONY: help setup dev infra services observability stop clean logs ps \
        deploy-contracts migrate build-rust build-ts test-golden-path \
        format lint

## help: Show this help message
help:
	@echo ""
	@echo "  SW3 — local development Makefile"
	@echo ""
	@grep -E '^## ' Makefile | sed 's/## /  /' | column -t -s ':'
	@echo ""

## setup: First-time setup — copy env template and check tool dependencies
setup:
	@echo -e "$(GREEN)→ Checking dependencies...$(NC)"
	@command -v docker  >/dev/null 2>&1 || (echo "ERROR: docker not found";  exit 1)
	@command -v pnpm    >/dev/null 2>&1 || (echo "ERROR: pnpm not found";    exit 1)
	@command -v cargo   >/dev/null 2>&1 || (echo "ERROR: cargo not found";   exit 1)
	@echo -e "$(GREEN)→ All required tools found.$(NC)"
	@if [ ! -f $(ENV_FILE) ]; then \
		cp .env.local.example $(ENV_FILE); \
		echo -e "$(YELLOW)→ Created $(ENV_FILE) from .env.local.example$(NC)"; \
		echo -e "$(YELLOW)→ Review $(ENV_FILE) before running 'make dev'$(NC)"; \
	else \
		echo -e "$(GREEN)→ $(ENV_FILE) already exists — skipping$(NC)"; \
	fi

## dev: Start the full local development stack (infra + services + observability)
dev: $(ENV_FILE)
	@echo -e "$(GREEN)→ Starting full SW3 local stack...$(NC)"
	$(COMPOSE) --env-file $(ENV_FILE) up -d
	@echo ""
	@echo -e "$(GREEN)✓ Stack running. URLs:$(NC)"
	@echo "  Dashboard:   http://localhost:3000"
	@echo "  API Gateway: http://localhost:8000  (docs: http://localhost:8000/docs)"
	@echo "  Auth:        http://localhost:8001"
	@echo "  Grafana:     http://localhost:3333  (admin / admin)"
	@echo "  Prometheus:  http://localhost:9090"
	@echo "  Anvil (RPC): http://localhost:8545"
	@echo ""
	@echo -e "$(YELLOW)→ Run 'make deploy-contracts' to deploy Solidity contracts to Anvil$(NC)"
	@echo -e "$(YELLOW)→ Run 'make migrate'           to run DB migrations$(NC)"
	@echo -e "$(YELLOW)→ Run 'make logs'              to tail all service logs$(NC)"

## infra: Start only infrastructure services (postgres, redis, clickhouse, anvil)
infra: $(ENV_FILE)
	$(COMPOSE) --env-file $(ENV_FILE) up -d postgres redis clickhouse anvil

## services: Start platform services (requires infra to be running)
services: $(ENV_FILE)
	$(COMPOSE) --env-file $(ENV_FILE) up -d auth-service api-gateway analytics-service billing-service webhook-service

## observability: Start observability stack (prometheus, loki, grafana)
observability: $(ENV_FILE)
	$(COMPOSE) --env-file $(ENV_FILE) up -d prometheus loki grafana

## stop: Stop all containers (data volumes are preserved)
stop:
	$(COMPOSE) stop

## clean: Stop and remove all containers, volumes, and images built by compose
clean:
	$(COMPOSE) down --volumes --remove-orphans
	@echo -e "$(GREEN)→ Containers and volumes removed.$(NC)"

## logs: Tail logs from all running containers
logs:
	$(COMPOSE) logs -f --tail=100

## ps: Show running containers
ps:
	$(COMPOSE) ps

## deploy-contracts: Compile and deploy Solidity contracts to Anvil
deploy-contracts: $(ENV_FILE)
	@echo -e "$(GREEN)→ Deploying contracts to Anvil (http://localhost:8545)...$(NC)"
	@bash scripts/deploy-contracts.sh

## migrate: Run PostgreSQL database migrations
migrate:
	@echo -e "$(GREEN)→ Running database migrations...$(NC)"
	@bash scripts/migrate.sh

## build-rust: Build all Rust workspace crates in release mode
build-rust:
	@echo -e "$(GREEN)→ Building Rust workspace...$(NC)"
	cargo build --release
	@echo -e "$(GREEN)✓ Rust build complete.$(NC)"

## build-ts: Install pnpm dependencies and build all TypeScript packages
build-ts:
	@echo -e "$(GREEN)→ Installing pnpm dependencies...$(NC)"
	pnpm install
	@echo -e "$(GREEN)→ Building TypeScript workspace...$(NC)"
	pnpm build
	@echo -e "$(GREEN)✓ TypeScript build complete.$(NC)"

## test-golden-path: Run the end-to-end golden path smoke test
test-golden-path: $(ENV_FILE)
	@echo -e "$(GREEN)→ Running golden path smoke test...$(NC)"
	@bash scripts/test-golden-path.sh

## format: Format all code (prettier + cargo fmt)
format:
	pnpm format
	cargo fmt --all

## lint: Lint all code (eslint + cargo clippy)
lint:
	pnpm lint
	cargo clippy --all-targets --all-features

# Guard — ensure .env.local exists
$(ENV_FILE):
	@echo -e "$(YELLOW)→ $(ENV_FILE) not found. Run 'make setup' first.$(NC)"
	@exit 1
