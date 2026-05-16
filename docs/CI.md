# CI/CD Reference

This document describes the GitHub Actions workflows that enforce build and
quality gates for every commit to the SW3 repository.

---

## Workflows

### 1. `ci.yml` — Main CI (every push / PR)

**Triggers:** every push to `main` and every pull request.

| Job | What it does |
|-----|--------------|
| `build-ts` | `pnpm install --frozen-lockfile`, `pnpm type-check`, `pnpm build` |
| `build-rust` | `cargo build`, `cargo clippy --all-targets -- -D warnings`, `cargo fmt --check` |
| `build-solidity` | `forge install`, `forge build`, `forge test --gas-report` for both `contracts/sweeper` and `contracts/eip7702` |

All three jobs run concurrently. A push or PR is blocked from merging if any
job fails.

**Caching:**
- pnpm store — keyed on `pnpm-lock.yaml` hash
- Cargo registry + build artefacts — keyed on `Cargo.lock` hash
- Foundry build output — keyed on contract source hashes

---

### 2. `docker-build.yml` — Docker image validation (push to `main` + manual)

**Triggers:** push to `main` and manual dispatch (`workflow_dispatch`).

| Job | Services built |
|-----|----------------|
| `build-python-images` | api-gateway, auth-service, analytics-service, billing-service, webhook-service |
| `build-rust-images` | execution-engine, simulation-engine, rpc-router, indexer-service |
| `build-dashboard-image` | apps/dashboard |

Images are built but **not pushed**. The purpose is to catch broken
Dockerfiles and layer failures before a real release push.

GitHub Actions cache (`type=gha`) is used so layer caches survive between
runs on the same branch.

This workflow is deliberately **not** triggered on every PR because
Rust multi-stage builds take 5–15 minutes cold. Run it on-demand with
`workflow_dispatch` if you need to validate Docker changes on a feature
branch.

---

## What CI does not yet cover

| Gap | Reason |
|-----|--------|
| Full end-to-end smoke test in CI | Requires Docker Compose stack + Anvil; too heavy for every PR. See `make test-golden-path` locally instead. |
| Image push to registry | Not wired; add `docker/login-action` + `push: true` in `docker-build.yml` once a registry is chosen. |
| Contract deployment to testnet | Intentionally out of scope for PR CI; use `scripts/deploy-contracts.sh` against Sepolia/Holesky manually. |
| Solidity coverage | Can be added with `forge coverage`; held back until forge coverage is stable on this compiler version. |
| Performance / load tests | Post-CI; see `docs/STAGING.md` for staging validation approach. |

---

## Running CI checks locally

```bash
# TypeScript
pnpm install --frozen-lockfile
pnpm type-check
pnpm build

# Rust
cargo build
cargo clippy --all-targets --all-features -- -D warnings
cargo fmt --all -- --check

# Solidity (sweeper)
cd contracts/sweeper
forge install --no-commit
forge build
forge test --gas-report

# Solidity (eip7702)
cd contracts/eip7702
forge build
forge test

# Docker (requires Docker installed)
docker build -f services/api-gateway/Dockerfile services/api-gateway -t sw3/api-gateway
docker build -f services/execution-engine/Dockerfile . -t sw3/execution-engine
docker build -f apps/dashboard/Dockerfile . -t sw3/dashboard
```
