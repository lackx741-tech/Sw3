# Local Development Guide

## Prerequisites

| Tool      | Version  | Notes                                        |
|-----------|----------|----------------------------------------------|
| Docker    | ≥ 25     | Docker Engine with Compose v2                |
| pnpm      | ≥ 9.0    | `npm install -g pnpm`                        |
| Rust      | 1.80+    | via rustup — `rustup show` to verify         |
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

# 3. Start the full local stack
make dev

# 4. (first time) Deploy contracts to Anvil
make deploy-contracts

# 5. (first time) Run database migrations
make migrate

# 6. Verify everything is working
make test-golden-path
```

---

## Service ports

| Service            | Local URL                          | Notes                        |
|--------------------|------------------------------------|------------------------------|
| Dashboard          | http://localhost:3000              | `pnpm --filter @sw3/dashboard dev` |
| API Gateway        | http://localhost:8000              | OpenAPI: /docs               |
| Auth Service       | http://localhost:8001              | SIWE + JWT                   |
| Analytics Service  | http://localhost:8004              |                              |
| Billing Service    | http://localhost:8005              |                              |
| Webhook Service    | http://localhost:8006              |                              |
| Execution Engine   | http://localhost:8080              | Rust — run separately        |
| Simulation Engine  | http://localhost:8082              | Rust — run separately        |
| PostgreSQL         | localhost:5432                     | sw3 / sw3dev / sw3_dev       |
| Redis              | localhost:6379                     |                              |
| ClickHouse         | http://localhost:8123              | HTTP interface               |
| Anvil (EVM)        | http://localhost:8545              | chain-id 31337               |
| Prometheus         | http://localhost:9090              |                              |
| Loki               | http://localhost:3100              |                              |
| Grafana            | http://localhost:3333              | admin / admin                |

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
    ├── /v1/auth/*   → auth-service (:8001)     — SIWE + JWT
    ├── /v1/sweeps/* → execution-engine (:8080)  — Rust
    ├── /v1/tokens/* → (stub)
    ├── /v1/analytics/* → analytics-service (:8004)
    ├── /v1/billing/* → billing-service (:8005)
    └── /v1/webhooks/* → webhook-service (:8006)

Infrastructure
    ├── PostgreSQL — sweep jobs, batch jobs
    ├── Redis      — nonce cache, JWT revocation, session state
    ├── ClickHouse — analytics events
    └── Anvil      — local EVM chain

Observability
    ├── Prometheus → scrapes /metrics from all services
    ├── Loki       → log aggregation
    └── Grafana    → dashboards (SW3 Golden Path)
```

---

## Golden path

The one working end-to-end flow in this iteration:

```
1. Wallet connect (browser / cast)
2. POST /v1/auth/nonce  {address}            → {nonce}
3. Sign SIWE message with wallet
4. POST /v1/auth/verify {message, signature, address}
                                             → {token, refresh_token}
5. POST /v1/sweeps (with Bearer token)       → create sweep job
6. Execution engine polls for pending jobs, batches + submits to Anvil
7. Indexer service records confirmed tx
8. Analytics service logs event to ClickHouse
```

The auth flow (steps 1–4) is fully implemented end-to-end.
The execution path (steps 5–8) runs via the Rust execution-engine which
connects to Anvil on port 8545 — start it with `cargo run -p execution-engine`.

---

## Running Rust services

The execution-engine and simulation-engine are Rust binaries and are **not**
included in docker-compose (building multi-arch Rust images in compose adds
significant startup time). Run them separately:

```bash
# Terminal 1 — start infra first
make infra

# Terminal 2 — execution engine
DATABASE_URL=postgresql://sw3:sw3dev@localhost:5432/sw3_dev \
REDIS_URL=redis://localhost:6379/0 \
RPC_URLS=http://localhost:8545 \
cargo run -p execution-engine

# Terminal 3 — simulation engine
RPC_URL=http://localhost:8545 \
cargo run -p simulation-engine
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
```

---

## Contract deployment (detailed)

`make deploy-contracts` runs `scripts/deploy-contracts.sh` which:

1. Waits for Anvil to be ready.
2. `forge build` inside `contracts/sweeper`.
3. `forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545`.
4. Parses the deployed contract address from forge output.
5. Writes `SWEEPER_CONTRACT_ADDRESS` and `NEXT_PUBLIC_CONTRACT_ADDRESS` to `.env.local`.

**Manual remaining step**: if `forge script` output format changes or parsing
fails, manually copy the contract address from the forge output and set it in
`.env.local`.

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

1. **Rust services not in docker-compose** — execution-engine and
   simulation-engine must be started manually (see above).  Building Rust in
   compose is feasible but adds rebuild times; deferred to next slice.

2. **No EIP-7702 / Permit2 on Anvil** — the delegated executor and permit
   router contracts are defined but not yet deployed in the local bootstrap.
   Only the Sweeper contract is deployed by `make deploy-contracts`.

3. **SIWE `chain_id` field** — the `siwe` Python library version ≥ 2.x uses
   `chain_id` (not `chainId`). If you upgrade the library to a major version
   that changes field names, update `main.py` in auth-service accordingly.

4. **ClickHouse schema** — the analytics ClickHouse tables are not yet auto-
   migrated on startup.  Analytics events are silently dropped until tables
   are created manually.  A migration script is planned for the next slice.

5. **No end-to-end TLS** — all local services communicate over plain HTTP.
   Use a TLS-terminating reverse proxy (e.g., Caddy or nginx) for staging.

6. **JWT public-key auth** — JWTs are HS256 (shared secret).  For multi-
   service production use, rotate to RS256 with a public/private key pair.
   The algorithm field in auth-service is configurable via `JWT_ALGORITHM`.

7. **Execution engine correlation IDs** — the Rust services emit structured
   JSON logs but do not yet inject an `x-request-id` through the full pipeline.
   Added to the next slice.
