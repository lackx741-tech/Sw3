# Sw3 — Enterprise ERC-20 Sweeping Platform

## Build status

| Surface               | Status                                                                                                              |
|-----------------------|---------------------------------------------------------------------------------------------------------------------|
| TypeScript workspace  | ✅ `pnpm install && pnpm build` — all packages compile (stale path aliases removed)                                |
| Rust workspace        | ✅ `cargo build` — all 5 service crates compile from root                                                          |
| Solidity contracts    | ✅ `cd contracts/sweeper && forge build` — Sweeper + tests compile                                                 |
| Local dev stack       | ✅ `make dev` — brings up Postgres, Redis, ClickHouse, Anvil, all Python services, Prometheus, Loki, Grafana       |
| SIWE auth             | ✅ Real nonce → sign → verify → JWT implemented (was placeholder)                                                  |

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

## Dashboard integration builder

The `apps/dashboard` app includes an advanced integration dashboard:

1. Select the modal/tool flow (Sweep Modal, Wallet Button, Transaction Status).
2. Select the target chain + contract (or provide a custom contract address).
3. Validate backend integration status (API gateway, sweeps, tokens services).
4. Compile and generate:
   - embeddable `Script.js` URL
   - full generated script source
   - website embed snippet

### Run dashboard locally

```bash
pnpm --filter @sw3/dashboard dev
```

Open `http://localhost:3000`.

### Embed on any website

```html
<script src="https://<your-dashboard-host>/api/integration/script.js?..."></script>
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
