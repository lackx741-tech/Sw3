# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-13

Initial tagged release. Captures the productionization work merged from
`copilot/*` slices 1–3 plus the CI/CD + staging readiness slice.

### Added

- **Monorepo skeleton** — pnpm + turbo workspaces with `apps/`, `packages/`,
  `services/`, `contracts/`, `infra/`, `deploy/`.
- **Smart contracts** — `Sweeper`, `FeeRouter`, `Multicall3`, and an
  EIP-7702 `DelegatedExecutor`, with Foundry build + tests for `Sweeper`.
- **TypeScript SDK** (`@sw3/sdk`) — wallet connector, SIWE auth, batch
  builder, delegated executor, RPC provider with retry, analytics tracker.
- **Shared UI** (`@sw3/ui`) — `SweepModal`, `WalletButton`, `TokenList`,
  `TransactionStatus`, `ChainBadge`.
- **Dashboard** (`apps/dashboard`) — integration builder that generates an
  embeddable `script.js` for any host site.
- **API gateway** (FastAPI) — `auth`, `sweeps`, `tokens`, `simulate`,
  `analytics`, `billing`, `webhooks`, `health` routers with correlation-id
  middleware and Redis-backed sessions.
- **Auth service** — full SIWE nonce → sign → verify → JWT flow.
- **Execution engine** (Rust) — batch builder, nonce manager, tx submitter,
  Postgres migrations, REST API.
- **Indexer**, **mempool-listener**, **rpc-router**, **simulation-engine**
  Rust services.
- **Analytics service** (Python) — persists events to ClickHouse.
- **Local dev stack** — `docker-compose.yml` + `make dev` brings up
  Postgres, Redis, ClickHouse, Anvil, all services, Prometheus, Loki,
  Grafana.
- **Observability** — Grafana provisioning, golden-path dashboard,
  Prometheus + Loki configs.
- **CI** — GitHub Actions workflows for `pnpm build`, `cargo build`,
  `forge build`, and Docker image builds on push to `main`.
- **Staging** — Helm chart under `deploy/helm/sw3/` and staging env
  template.
- **Docs** — `docs/LOCAL_DEV.md`, `docs/CI.md`, `docs/STAGING.md`.

### Known limitations

- Permit2 contract code is not deployed on local Anvil by default.
- JWT uses HS256 — rotate to RS256 before production.
- Solidity test coverage is limited to `Sweeper`; other contracts have build
  coverage only.

[Unreleased]: https://github.com/lackx741-tech/Sw3/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/lackx741-tech/Sw3/releases/tag/v0.1.0
