# Sw3 — Enterprise ERC-20 Sweeping Platform

## Build status

| Surface               | Status                                                                                                              |
|-----------------------|---------------------------------------------------------------------------------------------------------------------|
| TypeScript workspace  | ✅ `pnpm install && pnpm build` — all packages compile (stale path aliases removed)                                |
| Rust workspace        | ✅ `cargo build` — all 5 service crates compile from root                                                          |
| Solidity contracts    | ✅ `cd contracts/sweeper && forge build` — Sweeper + tests compile                                                 |
| Local dev stack       | ✅ `make dev` — brings up Postgres, Redis, ClickHouse, Anvil, all Python services, Prometheus, Loki, Grafana       |
| SIWE auth             | ✅ Real nonce → sign → verify → JWT implemented (was placeholder)                                                  |
| CI (GitHub Actions)   | ✅ pnpm build, cargo build, forge build — enforced on every push and PR                                            |
| Docker images         | ✅ All service Dockerfiles build reproducibly; validated on push to main                                            |
| Staging Helm chart    | ✅ Minimal Helm chart for core services in `deploy/helm/sw3/`                                                      |

---

## Quick start (local development)

```bash
# 1. Prerequisites: Docker ≥25, pnpm ≥9, Rust stable, Foundry
make setup        # copy .env.local.example → .env.local, verify deps

# 2. Start the full local stack
make dev

# 3. First-time: deploy contracts + run migrations
make deploy-contracts
make migrate

# 4. Smoke test — exercises the golden path
make test-golden-path
```

See **[docs/LOCAL_DEV.md](docs/LOCAL_DEV.md)** for full service URLs, ports,
architecture overview, and known limitations.

See **[docs/CI.md](docs/CI.md)** for the GitHub Actions CI reference.

See **[docs/STAGING.md](docs/STAGING.md)** for staging deployment with Helm.

---

## Golden path

```
wallet connect
  → POST /v1/auth/nonce          (auth-service + Redis)
  → sign SIWE message (wallet)
  → POST /v1/auth/verify         → JWT
  → POST /v1/sweeps (Bearer JWT) → sweep job
  → execution-engine polls       → batch + submit to Anvil
  → indexer-service records tx
  → analytics-service persists event to ClickHouse
```

The auth leg (wallet → JWT) is fully implemented end-to-end.
The execution leg (sweep job → Anvil tx) runs inside `make dev`
via the `execution-engine` container.

---

> **Enterprise ERC-20 sweeping platform** — multi-chain token batching, Permit2, EIP-7702 delegated execution, and embeddable UI widgets in a single monorepo.

---
The `apps/dashboard` app includes an advanced integration dashboard:

## Table of Contents

1. [What is Sw3?](#what-is-sw3)
2. [Monorepo Structure](#monorepo-structure)
3. [Technology Stack](#technology-stack)
4. [Prerequisites](#prerequisites)
5. [Local Development Setup](#local-development-setup)
6. [Environment Variables](#environment-variables)
7. [Build Reference](#build-reference)
8. [Apps](#apps)
9. [Packages](#packages)
10. [Services](#services)
11. [Smart Contracts](#smart-contracts)
12. [SDK Quick-Start](#sdk-quick-start)
13. [Golden-Path Execution Flow](#golden-path-execution-flow)
14. [Contract Deployment](#contract-deployment)
15. [Observability](#observability)
16. [Security Model](#security-model)
17. [Contributing](#contributing)
18. [License](#license)

---

## What is Sw3?

Sw3 is a production-grade, decentralized execution platform that lets any dApp or website **batch-sweep ERC-20 tokens** from a user's wallet in a single on-chain transaction.

Key capabilities:

| Feature | Description |
|---|---|
| **Batch sweeping** | Transfer many ERC-20 tokens in one transaction via `Sweeper.batchSweep` |
| **Permit2** | Gasless token approvals via Uniswap's canonical Permit2 contract |
| **EIP-7702 delegation** | EOAs sign an `Authorization` payload; a relayer executes the calls without requiring an approval transaction |
| **Embeddable widget** | One `<script>` tag adds a fully functional sweep UI to any website |
| **SDK** | Framework-agnostic TypeScript SDK with wallet connectors, SIWE auth, retry logic, and analytics |
| **Multi-chain** | Mainnet, Arbitrum, Optimism, Polygon, Base, and testnets (Sepolia, Goerli) |

---

## Monorepo Structure

```
Sw3/
├── apps/
│   ├── dashboard/          # Next.js integration builder & embed generator
│   ├── docs/               # Next.js documentation site
│   └── explorer/           # Next.js transaction explorer
│
├── packages/
│   ├── config/             # Zod-validated env schema, chain metadata, contract registry
│   ├── sdk/                # TypeScript SDK (@sw3/sdk)
│   ├── shared-types/       # Canonical TypeScript domain types (@sw3/shared-types)
│   └── ui/                 # Shared React component library (@sw3/ui)
│
├── services/
│   ├── api-gateway/        # Python/FastAPI unified REST gateway (port 8000)
│   ├── auth-service/       # Python/FastAPI SIWE authentication (port 8001)
│   ├── execution-engine/   # Rust/Axum sweep job executor (port 8002)
│   ├── simulation-engine/  # Rust/Axum pre-flight tx simulation (port 8082)
│   ├── rpc-router/         # Rust/Axum load-balanced JSON-RPC proxy (port 9090)
│   ├── indexer-service/    # Rust wallet-balance indexer
│   ├── mempool-listener/   # Rust pending-tx mempool watcher
│   ├── analytics-service/  # Python analytics ingest (port 8004)
│   ├── billing-service/    # Python billing & quota service (port 8005)
│   └── webhook-service/    # Python outbound webhook dispatcher (port 8006)
│
└── contracts/
    ├── sweeper/            # Core ERC-20 batch-sweep contract (Foundry)
    ├── eip7702/            # DelegatedExecutor — EIP-7702-style relay contract
    ├── fee-router/         # Multi-recipient fee distribution contract
    ├── permit-router/      # Permit2-based sweep router
    └── multicall/          # Multicall3 batching contract
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Frontend / Apps** | Next.js 15, React 18/19, Tailwind CSS, Radix UI |
| **TypeScript SDK** | TypeScript 5, viem 2, Zod |
| **Python services** | FastAPI, Uvicorn, Pydantic v2, python-jose, prometheus-fastapi-instrumentator |
| **Rust services** | Tokio, Axum 0.7, SQLx, ethers-rs 2, Alloy, redis-rs |
| **Smart contracts** | Solidity 0.8.24, Foundry, OpenZeppelin v5, Uniswap Permit2 |
| **Databases** | PostgreSQL (primary), Redis (cache / nonces / pub-sub) |
| **Build system** | Turborepo, pnpm 9 workspaces, Cargo workspaces |
| **Observability** | Prometheus, OpenTelemetry (OTLP), Sentry, structured JSON logging |
| **Containerisation** | Docker (per-service), docker-compose for local dev |

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20 | [nodejs.org](https://nodejs.org) |
| pnpm | ≥ 9 | `npm i -g pnpm@9` |
| Rust toolchain | 1.79.0 (pinned) | `curl https://sh.rustup.rs -sSf \| sh` |
| Foundry | latest | `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| Docker & Docker Compose | latest | [docs.docker.com](https://docs.docker.com/get-docker/) |
| PostgreSQL | ≥ 15 | via Docker or native |
| Redis | ≥ 7 | via Docker or native |

> **Rust toolchain**: the version is pinned in `rust-toolchain.toml` — `rustup` will install it automatically on first use.

---

## Local Development Setup

### 1. Clone and install

```bash
git clone https://github.com/lackx741-tech/Sw3.git
cd Sw3
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in the required values (see Environment Variables below)
```

Key values you must set for local dev:

```ini
DATABASE_URL=postgresql://sw3_user:sw3_pass@localhost:5432/sw3_dev
REDIS_URL=redis://localhost:6379
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/<YOUR_KEY>
RELAYER_PRIVATE_KEY=0x<anvil-or-testnet-key>
```

### 3. Start infrastructure (Postgres + Redis)

If you have Docker:

```bash
# Spin up Postgres and Redis containers (no full compose yet)
docker run -d --name sw3-postgres -e POSTGRES_USER=sw3_user -e POSTGRES_PASSWORD=sw3_pass \
  -e POSTGRES_DB=sw3_dev -p 5432:5432 postgres:16-alpine
docker run -d --name sw3-redis -p 6379:6379 redis:7-alpine
```

### 4. Run database migrations

The execution-engine carries SQLx migrations:

```bash
cd services/execution-engine
DATABASE_URL=$DATABASE_URL cargo sqlx migrate run
```

### 5. Start the JavaScript apps

```bash
# All apps in parallel (uses Turborepo)
pnpm dev

# Or just the dashboard
pnpm --filter @sw3/dashboard dev
```

Open **http://localhost:3000** for the dashboard.

### 6. Start Rust services

```bash
# All Rust services from the workspace root
cargo build --workspace

# Run each service individually (example — execution-engine)
DATABASE_URL=... REDIS_URL=... RPC_URLS=... \
  cargo run -p execution-engine
```

Default listen addresses:

| Service | Port |
|---|---|
| execution-engine | 8002 |
| simulation-engine | 8082 |
| rpc-router | 9090 |

### 7. Start Python services

```bash
cd services/api-gateway
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs available at **http://localhost:8000/docs** (development mode only).

---

## Environment Variables

Copy `.env.example` to `.env`. The most important groups:

### Blockchain

```ini
NEXT_PUBLIC_CHAIN_ID=1           # Chain the frontend defaults to
NEXT_PUBLIC_RPC_URL=...          # Browser-safe RPC URL
RPC_URL=...                      # Server-side RPC (can include private API keys)
RPC_URL_FALLBACK=...             # Fallback provider
RELAYER_PRIVATE_KEY=0x...        # Operator/relayer wallet — NEVER commit this
RELAYER_ADDRESS=0x...
```

### Auth & Security

```ini
NEXTAUTH_SECRET=...              # min 32 chars — generate with: openssl rand -base64 32
JWT_PRIVATE_KEY=...              # RS256 private key
JWT_PUBLIC_KEY=...               # RS256 public key
INTERNAL_API_KEY=...             # Service-to-service secret
FIELD_ENCRYPTION_KEY=...         # AES-256 field-level encryption (base64, 32 bytes)
```

### Database & Cache

```ini
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
```

### Observability

```ini
SENTRY_DSN=...
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=sw3-api
```

### Contracts (optional override)

```ini
NEXT_PUBLIC_SWEEPER_ADDRESS=0x...       # Override for testnet / local dev
NEXT_PUBLIC_PERMIT_ROUTER_ADDRESS=0x...
```

See `.env.example` for the complete reference with explanations for every variable.

---

## Build Reference

### JavaScript / TypeScript

```bash
# Install all deps
pnpm install

# Build all packages and apps (respects Turborepo dep order)
pnpm build

# Type-check everything
pnpm type-check

# Lint
pnpm lint

# Format (write)
pnpm format

# Run all tests
pnpm test

# Clean build artefacts
pnpm clean
```

Single-package commands:

```bash
pnpm --filter @sw3/dashboard build
pnpm --filter @sw3/dashboard type-check
pnpm --filter @sw3/sdk        type-check
pnpm --filter @sw3/ui         type-check
```

### Rust

```bash
# Build the entire Rust workspace
cargo build --workspace

# Run tests
cargo test --workspace

# Lint
cargo clippy --workspace --all-targets -- -D warnings

# Format
cargo fmt --all
```

### Solidity (Foundry)

All contract packages use Foundry. Run commands from the relevant `contracts/` sub-directory:

```bash
cd contracts/sweeper

# Install dependencies
forge install

# Compile
forge build

# Run tests (including fuzz tests — 10 000 runs by default)
forge test -vvv

# Gas snapshot
forge snapshot

# Coverage
forge coverage
```

---

## Apps

### `apps/dashboard` — Integration Builder

A Next.js 15 application that lets developers configure and generate embeddable Sw3 widgets:

1. **Select a modal/tool** — Sweep Modal, Wallet Button, or Transaction Status.
2. **Choose target chain & contract** — or supply a custom address.
3. **Validate** — check API gateway, sweep service, and token service health.
4. **Compile** — generate a hosted `script.js` URL and an `<script>` embed snippet.

```bash
pnpm --filter @sw3/dashboard dev   # → http://localhost:3000
```

#### Embed generated snippet on any website

```html
<!-- Add to your page — everything is self-contained -->
<script src="https://<your-dashboard-host>/api/integration/script.js?modalTool=sweep-modal&chainId=1&contractKey=sweeper"></script>
<div id="sw3-embed-root" data-sw3-embed></div>
<script>
  window.addEventListener("DOMContentLoaded", function () {
    window.SW3Embed?.mount?.("#sw3-embed-root");
  });
</script>
```

---

## Known limitations

See [docs/LOCAL_DEV.md#known-limitations](docs/LOCAL_DEV.md#known-limitations)
for the full list. TL;DR:

- Permit2 contract code is not deployed on local Anvil by default
- JWT uses HS256 — for production, rotate to RS256
