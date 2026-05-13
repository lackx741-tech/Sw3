# Local Development Guide

## Prerequisites

| Tool      | Version  | Notes                                        |
|-----------|----------|----------------------------------------------|
| Docker    | ≥ 25     | Docker Engine with Compose v2                |
| pnpm      | ≥ 9.0    | `npm install -g pnpm`                        |
| Rust      | 1.79+    | via rustup — `rustup show` to verify         |
| Foundry   | latest   | `curl -L https://foundry.paradigm.xyz | bash`|
| Node.js   | ≥ 20     | via nvm recommended                          |

Optional but recommended for the golden-path test:
- `cast` (included with Foundry)
- `jq`
- `psql`

---

## Quick start

```bash
# 1. Clone and enter repo
git clone https://github.com/lackx741-tech/Sw3.git && cd Sw3

# 2. First-time setup (copies .env.local, checks deps)
make setup

# 3. Start the full local stack (infra + Python services + Rust services + observability)
make dev

# 4. (first time) Deploy contracts to Anvil
make deploy-contracts

# 5. (first time) Run database migrations
make migrate

# 6. Verify everything is working
make test-golden-path
```

> **Note:** `make dev` builds the Rust services via Docker (execution-engine,
> simulation-engine, rpc-router, indexer-service). The first build takes several
> minutes; subsequent runs use the Docker layer cache.

---

## Service ports

| Service            | Local URL                          | Notes                         |
|--------------------|------------------------------------|-------------------------------|
| Dashboard          | http://localhost:3000              | `pnpm --filter @sw3/dashboard dev` |
| API Gateway        | http://localhost:8000              | OpenAPI: /docs                |
| Auth Service       | http://localhost:8001              | SIWE + JWT                    |
| Analytics Service  | http://localhost:8004              | /health, /metrics, /v1/events |
| Billing Service    | http://localhost:8005              |                               |
| Webhook Service    | http://localhost:8006              |                               |
| Execution Engine   | http://localhost:8080              | Rust — /health /metrics       |
| Simulation Engine  | http://localhost:8082              | Rust — /health /simulate      |
| RPC Router         | http://localhost:9091              | Rust — /health /metrics (JSON-RPC) |
| PostgreSQL         | localhost:5432                     | sw3 / sw3dev / sw3_dev        |
| Redis              | localhost:6379                     |                               |
| ClickHouse         | http://localhost:8123              | HTTP interface                |
| Anvil (EVM)        | http://localhost:8545              | chain-id 31337                |
| Prometheus         | http://localhost:9090              |                               |
| Loki               | http://localhost:3100              |                               |
| Grafana            | http://localhost:3333              | admin / admin                 |

---

## Architecture overview

```
Browser / SDK
    │
    ▼
Dashboard (Next.js :3000)
    │
    ▼
API Gateway (FastAPI :8000)
    ├── /v1/auth/*      → auth-service (:8001)          — SIWE + JWT
    ├── /v1/sweeps/*    → execution-engine (:8080)       — Rust, sweep jobs
    ├── /v1/simulate/*  → simulation-engine (:8082)      — Rust, tx simulation
    ├── /v1/analytics/* → analytics-service (:8004)      — event logging
    ├── /v1/billing/*   → billing-service (:8005)
    └── /v1/webhooks/*  → webhook-service (:8006)

Rust services
    ├── execution-engine  (:8080) — sweep job CRUD + batch executor
    ├── simulation-engine (:8082) — eth_call gas estimation
    ├── rpc-router        (:9091) — JSON-RPC round-robin + health failover
    └── indexer-service   (no HTTP) — balance polling background worker

Infrastructure
    ├── PostgreSQL — sweep jobs, batch jobs
    ├── Redis      — nonce cache, JWT revocation, session state
    ├── ClickHouse — analytics events persistence
    └── Anvil      — local EVM chain

Observability
    ├── Prometheus → scrapes /metrics from all services
    ├── Loki       → log aggregation
    └── Grafana    → dashboards
```

---

## Golden path (fully wired in this iteration)

The complete end-to-end flow that can be exercised locally:

```
1. Wallet connect (browser / cast)
2. POST /v1/auth/nonce  {address}                           → {nonce}
3. Sign SIWE message with wallet
4. POST /v1/auth/verify {message, signature, address}       → {token, refresh_token}
5. Verify local bootstrap contract wiring:
   - `SWEEPER_CONTRACT_ADDRESS`
   - `DELEGATED_EXECUTOR_ADDRESS`
6. POST /v1/simulate/   {from, to, data, value}             → {success, gas_estimate}
7. POST /v1/sweeps/     {owner, token, amount, recipient}   → {id, status: "pending"}
8. Execution engine polls DB → batches pending jobs → submits to Anvil
9. Indexer service polls confirmed txs → updates Redis cache
10. POST /v1/analytics/events {event_type, address, data}   → {accepted: true, persisted: true|false}
11. Validate analytics persistence in ClickHouse when available
```

Run the full path automatically with:
```bash
make test-golden-path
```

---

## Running the TypeScript dashboard

```bash
# Install dependencies
pnpm install

# Start the dashboard (Next.js dev server)
NEXT_PUBLIC_API_URL=http://localhost:8000/v1 \
pnpm --filter @sw3/dashboard dev
```

Open http://localhost:3000.

---

## Building

```bash
# TypeScript — all packages + apps
pnpm install && pnpm build

# Rust — all workspace crates
cargo build

# Solidity — sweeper contracts
cd contracts/sweeper && forge build

# Rust Docker images (also done automatically by make dev)
make rust-services
```

---

## Contract deployment (detailed)

`make deploy-contracts` runs `scripts/deploy-contracts.sh` which:

1. Waits for Anvil to be ready.
2. `forge build` inside `contracts/sweeper`.
3. `forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545`.
4. `forge build` inside `contracts/eip7702`.
5. `forge script contracts/eip7702/script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545`.
6. Parses the deployed contract addresses from forge output.
7. Writes these vars to `.env.local`:
   - `SWEEPER_CONTRACT_ADDRESS`
   - `NEXT_PUBLIC_CONTRACT_ADDRESS`
   - `NEXT_PUBLIC_SWEEPER_ADDRESS`
   - `DELEGATED_EXECUTOR_ADDRESS`
   - `NEXT_PUBLIC_DELEGATED_EXECUTOR_ADDRESS`
   - `PERMIT2_ADDRESS` (canonical)
   - `MULTICALL_ADDRESS`

If `forge script` output format changes and parsing fails, manually copy
addresses from forge output and set them in `.env.local`.

---

## Environment variables

All variables are documented in `.env.local.example`.

Key variables to set for a fully working local stack:

| Variable              | Default (local)                        | Notes                      |
|-----------------------|----------------------------------------|----------------------------|
| `JWT_SECRET`          | `local-dev-jwt-secret-...`             | Change in staging/prod     |
| `RELAYER_PRIVATE_KEY` | Anvil test key `0xac09...`            | Never use in prod          |
| `DATABASE_URL`        | `postgresql://sw3:sw3dev@postgres/...` | Docker network DNS         |
| `REDIS_URL`           | `redis://redis:6379/0`                 | Docker network DNS         |
| `RPC_URL`             | `http://anvil:8545`                    | Docker network DNS         |

---

## Known limitations (as of this PR)

1. **Permit2 contract code is not deployed on local Anvil by default** — this
   slice wires canonical `PERMIT2_ADDRESS` and deploys `DelegatedExecutor`, but
   full local Permit2 execution still depends on deploying a Permit2-compatible
   contract at that address.

2. **SIWE `chain_id` field** — the `siwe` Python library is pinned to `>=2.1.0,<3.0.0`
   in `services/auth-service/requirements.txt`. The 2.x API uses `chain_id`.
   Before upgrading past 2.x, review the CHANGELOG for field name changes and
   update `main.py` in auth-service accordingly.

3. **Analytics persistence requires ClickHouse availability** — analytics-service
   degrades gracefully (`accepted: true, persisted: false`) when ClickHouse is
   unavailable or writes fail.

4. **No end-to-end TLS** — all local services communicate over plain HTTP.
   Use a TLS-terminating reverse proxy (e.g., Caddy or nginx) for staging.

5. **JWT public-key auth** — JWTs are HS256 (shared secret). For multi-
   service production use, rotate to RS256 with a public/private key pair.
   The algorithm field in auth-service is configurable via `JWT_ALGORITHM`.

6. **Rust service build time** — the first `make dev` (or `make rust-services`)
   builds four Rust Docker images from source. This takes 5–15 minutes on a
   cold build depending on hardware. Subsequent builds use the Docker layer
   cache and are much faster.

## Explicitly out of scope for this slice

- Full local Permit2 deployment + full PermitRouter execution against that local
  Permit2 instance.
- Production-grade JWT key management (RS256 key distribution/rotation).
- End-to-end TLS between local services.
