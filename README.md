# Sw3

> **Enterprise ERC-20 sweeping platform** — multi-chain token batching, Permit2, EIP-7702 delegated execution, and embeddable UI widgets in a single monorepo.

---

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

#### API Routes

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/integration/compile` | Validate config and return generated script + embed snippet |
| `GET` | `/api/integration/script.js` | Serve the dynamic embed script (cached 60 s) |
| `GET` | `/api/integration/options` | Return available chains, contract keys, and modal tools |

### `apps/explorer` — Transaction Explorer

Blockchain transaction explorer for Sw3 sweep history (under construction).

### `apps/docs` — Documentation Site

Public documentation site (under construction).

---

## Packages

### `@sw3/shared-types`

Canonical TypeScript domain types shared across all packages and services. Import from here — do not redefine these types locally.

Key exports:

| Module | Content |
|---|---|
| `chain` | `ChainId` enum, `ChainConfig`, `SUPPORTED_CHAINS` |
| `token` | `Token`, `TokenWithBalance`, `TokenMetadata`, `ERC20ABI` |
| `sweep` | `SweepLeg`, `SweepBatch`, `SweepResult`, `SweepStatus` |
| `permit` | `Permit2Types`, `PermitSweepLeg` |
| `delegation` | `DelegatedCall`, `DelegationAuthorization`, `AUTHORIZATION_TYPES` |
| `analytics` | `AnalyticsEvent` |
| `api` | `ApiResponse`, `ErrorCode`, `WebhookPayload` |
| `wallet` | `ConnectedWallet`, `WalletType`, `WalletSession` |

### `@sw3/config`

Runtime-validated environment variables and static configuration.

```ts
import { parseClientEnv, parseServerEnv } from "@sw3/config";
import { CONTRACT_ADDRESSES, SUPPORTED_CHAINS } from "@sw3/config";

const env = parseClientEnv(process.env);
const chainCfg = SUPPORTED_CHAINS[ChainId.Base];
const addresses = CONTRACT_ADDRESSES[ChainId.Mainnet];
```

### `@sw3/sdk`

The primary TypeScript client library. Supports MetaMask, WalletConnect v2, and Coinbase Wallet.

```ts
import {
  SweeperClient,
  WalletConnector,
  SiweAuth,
  BatchBuilder,
  Executor,
  AnalyticsTracker,
  Authorizer,
  DelegatedExecutorClient,
} from "@sw3/sdk";
```

See [SDK Quick-Start](#sdk-quick-start) for usage examples.

### `@sw3/ui`

Reusable React components styled with Tailwind CSS and Radix UI.

| Component | Purpose |
|---|---|
| `WalletButton` | Connect / display / disconnect wallet dropdown |
| `SweepModal` | Token selection, amount inputs, fee preview, confirmation |
| `TokenList` | Sortable/filterable ERC-20 balance table |
| `TransactionStatus` | Animated pending / confirmed / failed status card |
| `ChainBadge` | Chain icon + name pill |

```tsx
import { WalletButton, SweepModal, TokenList } from "@sw3/ui";
```

---

## Services

### `api-gateway` (Python / FastAPI — port 8000)

Unified REST entry-point. Proxies authenticated requests to internal Rust services and aggregates responses.

**Middleware**: CORS (configurable origins), TrustedHost, Prometheus instrumentation, structured JSON logging, correlation ID propagation.

**Router prefixes**:

| Prefix | Handled by |
|---|---|
| `/v1/auth` | auth-service |
| `/v1/sweeps` | execution-engine |
| `/v1/tokens` | indexer-service |
| `/v1/analytics` | analytics-service |
| `/v1/billing` | billing-service |
| `/v1/webhooks` | webhook-service |
| `/health` | gateway itself |
| `/metrics` | Prometheus scrape endpoint |

API docs (dev only): `GET /docs` (Swagger UI), `GET /redoc`.

### `auth-service` (Python / FastAPI — port 8001)

Sign-In with Ethereum (EIP-4361) authentication with JWT sessions.

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Service health |
| `POST` | `/v1/auth/nonce` | Generate a SIWE nonce for an address |
| `POST` | `/v1/auth/verify` | Verify SIWE signature → issue JWT + refresh token |
| `POST` | `/v1/auth/refresh` | Rotate refresh token |
| `POST` | `/v1/auth/logout` | Invalidate session |
| `GET` | `/v1/auth/me` | Return the authenticated user |

### `execution-engine` (Rust / Axum — port 8002)

Core sweep job processor:

- Receives sweep job creation requests (`POST /sweep-jobs`).
- Batches pending jobs into multicall transactions.
- Manages relayer nonces via a Redis-backed `NonceManager` (TTL 5 min, atomic INCR, rollback on failure).
- Submits transactions via the `rpc-router` with exponential-backoff retry.
- Tracks job lifecycle in PostgreSQL (`sweep_jobs`, `batch_jobs` tables).
- Exposes Prometheus metrics at `/metrics` and a health check at `/health`.

**Database schema** (managed via SQLx migrations in `src/db/migrations/`):

```
sweep_jobs   — individual token sweep requests (pending → batched → submitted → confirmed / failed)
batch_jobs   — on-chain transaction batches (building → submitted → confirmed / failed)
```

### `simulation-engine` (Rust / Axum — port 8082)

Stateless pre-flight simulation service. Accepts a call payload, executes it against a fork via `eth_call`, and returns gas estimates with a configurable multiplier.

```
POST /simulate   → { success, gasEstimate, revertReason? }
GET  /health
```

### `rpc-router` (Rust / Axum — port 9090)

Transparent JSON-RPC round-robin proxy with health checking:

- Maintains a `ProviderStats` vector tracking latency and failure counts.
- Marks a provider unhealthy after 3 consecutive failures.
- Background `HealthChecker` probes endpoints periodically and re-enables healthy ones.

```
POST /           → proxy any JSON-RPC request
GET  /health     → { status, providers, healthy }
```

### `indexer-service` (Rust)

Polls on-chain ERC-20 balances for tracked wallet/token pairs, stores results in `wallet_balances` (PostgreSQL), and publishes change events on the `indexer:balance_changes` Redis pub-sub channel.

### `mempool-listener` (Rust)

Listens to the Ethereum mempool via WebSocket for pending sweep-related transactions.

### `analytics-service` (Python / FastAPI — port 8004)

Ingests analytics events from the SDK's `AnalyticsTracker` (batched POST to `/analytics/events`).

### `billing-service` (Python / FastAPI — port 8005)

API quota tracking and billing logic.

### `webhook-service` (Python / FastAPI — port 8006)

Dispatches outbound webhook payloads to registered subscriber URLs.

---

## Smart Contracts

All contracts are written in Solidity 0.8.24 and built/tested with [Foundry](https://github.com/foundry-rs/foundry).

### `contracts/sweeper` — Sweeper

The core execution contract. Operators (backend relayers) call `batchSweep` or `batchSweepWithPermit2` to transfer tokens on behalf of users.

```
Roles:  OPERATOR_ROLE  — call batchSweep / batchSweepWithPermit2
        PAUSER_ROLE    — emergency pause
        DEFAULT_ADMIN  — set fee/recipient, grant roles

Key functions:
  batchSweep(SweepLeg[], deadline)                   — allowance-based batch sweep
  batchSweepWithPermit2(PermitSweepLeg[], deadline)  — Permit2 signature-based sweep
  setFeeBps(uint256)                                 — update platform fee (max 10%)
  setFeeRecipient(address)                           — update fee destination
  pause() / unpause()
```

**Security**: `Pausable`, `ReentrancyGuard`, `SafeERC20`, `AccessControl`, `EIP712`, upgrade-safe `__gap` storage slots.

**Compile settings**: `optimizer_runs = 1_000_000`, `via_ir = true`, `evm_version = cancun`.

### `contracts/eip7702` — DelegatedExecutor

EIP-7702-style delegated execution router. EOAs sign an EIP-712 `Authorization` struct listing the calls they want executed; a relayer submits the batch.

```
Roles:  RELAYER_ROLE  — call executeDelegated
        PAUSER_ROLE   — emergency pause
        DEFAULT_ADMIN — grant roles

Replay protection: packed nonce bitmap (256 nonces per storage slot).
Deadline protection: per-authorization Unix timestamp.
```

### `contracts/fee-router` — FeeRouter

Distributes incoming ERC-20 tokens and ETH across multiple fee recipients according to configurable basis-point splits. Admin can update the split at any time; the sum must always equal 10 000 bps. Dust from rounding goes to the last recipient.

### `contracts/permit-router` — PermitRouter

Accepts EIP-2612 / Permit2 signature bundles and executes approved token transfers, backed by a nonce bitmap for replay protection.

### `contracts/multicall` — Multicall3

Standard Multicall3 contract for batching read calls. Deployed at `0xcA11bde05977b3631167028862bE2a173976CA11` on all supported chains.

---

## SDK Quick-Start

Install (once the package is published):

```bash
npm install @sw3/sdk
# WalletConnect / Coinbase Wallet are optional peer deps — install if needed:
npm install @walletconnect/ethereum-provider @coinbase/wallet-sdk
```

### Initialize the client

```ts
import { SweeperClient } from "@sw3/sdk";
import { ChainId } from "@sw3/shared-types";
import { CONTRACT_ADDRESSES } from "@sw3/config";

const client = new SweeperClient({
  apiUrl: "https://api.sw3.io",
  apiKey: "YOUR_API_KEY",
  chainId: ChainId.Mainnet,
  contractAddresses: CONTRACT_ADDRESSES[ChainId.Mainnet],
});
```

### Connect a wallet

```ts
import { WalletConnector, WalletType } from "@sw3/sdk";

const connector = new WalletConnector(client, {
  walletConnectProjectId: "YOUR_WC_PROJECT_ID",
});

const wallet = await connector.connect(WalletType.MetaMask);
console.log(wallet.address); // "0xabc…"
```

### Authenticate with SIWE

```ts
import { SiweAuth, SessionManager } from "@sw3/sdk";

const session = new SessionManager(client);
const auth = new SiweAuth(client, session);

const { jwt } = await auth.signIn({
  domain: "app.example.com",
  uri: "https://app.example.com",
});
```

### Build and execute a sweep

```ts
import { BatchBuilder, Executor } from "@sw3/sdk";

// Build a batch from a list of sweep legs
const builder = new BatchBuilder(client);
builder.addLeg({
  token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
  from: wallet.address,
  to: "0xRECIPIENT",
  amount: 1_000_000n,    // 1 USDC (6 decimals)
  feeBps: 30,
});

const batch = await builder.build();

// Execute (simulates first by default)
const executor = new Executor(client, { simulate: true, maxAttempts: 3 });
const result = await executor.execute(batch);
console.log(result.txHash);
```

### Permit2 sweep (no prior approval needed)

```ts
import { PermitSigner } from "@sw3/sdk";

const signer = new PermitSigner(client);
const permitLegs = await signer.signBatch([
  { token: "0xUSDC", from: wallet.address, to: "0xRECIPIENT", amount: 1_000_000n },
]);

const batch = await builder.buildWithPermit(permitLegs);
const result = await executor.execute(batch);
```

### EIP-7702 delegated execution

```ts
import { Authorizer, DelegatedExecutorClient } from "@sw3/sdk";

const contractAddress = CONTRACT_ADDRESSES[ChainId.Mainnet].delegatedExecutor!;
const authorizer = new Authorizer(client, contractAddress);

const { authorization, signature } = await authorizer.sign({
  nonce: 0n,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 300),
  calls: [{ target: "0xTARGET", value: 0n, data: "0xCALLDATA" }],
});

const delegatedExecutor = new DelegatedExecutorClient(client, contractAddress);
const result = await delegatedExecutor.execute(authorization, signature);
```

### Analytics

```ts
import { AnalyticsTracker } from "@sw3/sdk";

const tracker = new AnalyticsTracker(client, {
  endpoint: "https://api.sw3.io/analytics/events",
  batchSize: 20,
  flushIntervalMs: 10_000,
});

tracker.trackWalletConnect("MetaMask");
tracker.trackSweep(result, { durationMs: 4200, totalUsdValue: "250.00", feePaidUsd: "0.75" });

// Flush remaining events before page unload
await tracker.destroy();
```

---

## Golden-Path Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser / dApp                                                          │
│                                                                          │
│  1. WalletConnector.connect()          ← MetaMask / WalletConnect       │
│  2. SiweAuth.signIn()                  ← EIP-4361 SIWE                  │
│  3. BatchBuilder.build()               ← assemble SweepBatch             │
│  4. (optional) PermitSigner.signBatch()← Permit2 offchain signature      │
│  5. Executor.execute(batch)                                              │
│       │                                                                  │
│       ├─ simulate via simulation-engine (eth_call)                       │
│       ├─ submit to execution-engine (POST /sweep-jobs)                   │
│       │      │                                                           │
│       │      ├─ batches jobs → builds calldata                           │
│       │      ├─ acquires nonce via NonceManager (Redis)                  │
│       │      ├─ sends tx via rpc-router (round-robin RPC)                │
│       │      └─ Sweeper.batchSweep() / batchSweepWithPermit2()          │
│       │                                                                  │
│       └─ poll confirmation → emit sweepCompleted event                   │
│                                                                          │
│  6. indexer-service indexes balance changes → publishes to Redis         │
│  7. AnalyticsTracker.flush() → analytics-service                        │
└─────────────────────────────────────────────────────────────────────────┘
```

For EIP-7702 delegated execution:

```
1. Authorizer.sign()         ← EOA signs Authorization struct (EIP-712)
2. DelegatedExecutorClient.execute(auth, sig)
       │
       └─ relayer calls DelegatedExecutor.executeDelegated()
              ├─ recovers signer from EIP-712 digest
              ├─ checks + marks nonce bitmap
              ├─ verifies deadline
              └─ executes each Call in sequence
```

---

## Contract Deployment

### Sweeper

```bash
cd contracts/sweeper

export DEPLOYER_PRIVATE_KEY=0x...
export FEE_RECIPIENT=0x...
export FEE_BPS=30               # 0.30%
export ADMIN_ADDRESS=0x...
export RPC_URL=https://...

# Dry run (no broadcast)
forge script script/Deploy.s.sol --rpc-url $RPC_URL

# Live deploy + verify
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  -vvvv
```

Required env vars:

| Variable | Description |
|---|---|
| `DEPLOYER_PRIVATE_KEY` | Private key of the deploying account |
| `PERMIT2_ADDRESS` | Canonical Permit2 (`0x000000000022D473030F116dDEE9F6B43aC78BA3` on most chains) |
| `FEE_RECIPIENT` | Initial protocol fee recipient address |
| `FEE_BPS` | Initial fee in basis points (≤ 1000 = max 10%) |
| `ADMIN_ADDRESS` | Address granted `DEFAULT_ADMIN_ROLE` |

After deployment, update `packages/config/src/contracts.ts` with the real address.

---

## Observability

### Logging

All Rust services emit structured **JSON logs** via `tracing_subscriber` (format: `tracing_subscriber::fmt::layer().json()`). Log level is controlled with `RUST_LOG` / `LOG_LEVEL`.

Python services use Python's `logging` module configured via `app/core/logging.py`.

### Metrics

- **execution-engine** exposes Prometheus metrics at `GET /metrics`.
- **api-gateway** instruments all HTTP endpoints via `prometheus-fastapi-instrumentator`, exposed at `GET /metrics`.

### Tracing

OTLP export is configured via `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_SERVICE_NAME`. Compatible with Jaeger, Grafana Tempo, and any OTLP-compliant backend.

### Health checks

Every service exposes `GET /health` returning `{ "status": "ok", "service": "<name>" }`.

The rpc-router additionally returns provider pool status:

```json
{ "status": "ok", "providers": 3, "healthy": 2 }
```

### Sentry

Set `SENTRY_DSN` (server) and `NEXT_PUBLIC_SENTRY_DSN` (browser) to enable Sentry error tracking.

---

## Security Model

### Authentication

- Users authenticate via **Sign-In with Ethereum** (EIP-4361 / SIWE).
- The auth-service issues a short-lived JWT (default 60 min) and a long-lived refresh token.
- All API requests past auth carry the JWT in `Authorization: Bearer <token>`.

### Service-to-service auth

Internal services authenticate with a shared `INTERNAL_API_KEY` sent as `X-Internal-Key`.

### Nonce / replay protection

- SIWE nonces are single-use, Redis-backed, and expire after session TTL.
- Execution-engine manages relayer transaction nonces via Redis `INCR` with TTL-based recovery.
- `DelegatedExecutor` uses a packed 256-bit nonce bitmap per signer.
- `PermitRouter` uses its own nonce bitmap.

### Contract security

- `Pausable` — emergency pause on `Sweeper` and `DelegatedExecutor`.
- `ReentrancyGuard` — all state-changing functions.
- `SafeERC20` — safe token transfers.
- Fee cap — `Sweeper` enforces a maximum 10% fee (1 000 bps) at the contract level.
- Deadline enforcement — all batches include a `deadline` parameter checked on-chain.

### Secrets

- Never commit `.env` or `.env.local`.
- The relayer private key (`RELAYER_PRIVATE_KEY`) must remain server-side only.
- `FIELD_ENCRYPTION_KEY` encrypts sensitive fields at rest (AES-256).

---

## Contributing

### Commit convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(sdk): add permit2 batch signing
fix(execution-engine): rollback nonce on submission failure
chore(contracts): update foundry.toml optimizer runs
docs: update README deployment section
```

Pre-commit hooks (via Husky + lint-staged) automatically lint and format staged files.

### Releasing

Changelogs and version bumps are managed via [Changesets](https://github.com/changesets/changesets):

```bash
# Add a changeset describing your change
pnpm changeset

# Version bump (CI / maintainers)
pnpm changeset:version

# Publish to npm
pnpm changeset:publish
```

### Running the full test suite

```bash
# TypeScript
pnpm test

# Rust
cargo test --workspace

# Solidity (Foundry — from contracts/sweeper)
forge test -vvv
forge test --profile ci -vvv    # stricter fuzz runs (50 000)
```

---

## License

MIT © Sw3 Protocol

See [LICENSE](LICENSE) for the full text.
