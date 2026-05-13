# Contributing to Sw3

Thanks for your interest in contributing! This document outlines how to get a
development environment running, the conventions we use, and how to submit
changes.

## Code of Conduct

By participating in this project you agree to abide by our
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Getting started

Prerequisites:

- Node.js `>=20` and `pnpm >=9` (see [`.nvmrc`](./.nvmrc))
- Rust stable (managed via [`rust-toolchain.toml`](./rust-toolchain.toml))
- Foundry (`forge`, `anvil`, `cast`)
- Docker `>=25` for the local stack

```bash
git clone https://github.com/lackx741-tech/Sw3.git
cd Sw3
make setup        # copies .env.local.example -> .env.local
pnpm install
make dev          # spins up the local stack
```

See [`docs/LOCAL_DEV.md`](./docs/LOCAL_DEV.md) for full details and known
limitations.

## Workspace layout

| Path         | Purpose                                              |
|--------------|------------------------------------------------------|
| `apps/`      | Next.js front-ends (dashboard, docs, explorer)       |
| `packages/`  | Shared TypeScript libraries (sdk, ui, config, types) |
| `services/`  | Backend services (Python FastAPI + Rust)             |
| `contracts/` | Solidity contracts (sweeper, fee-router, EIP-7702)   |
| `infra/`     | Prometheus, Loki, Grafana provisioning               |
| `deploy/`    | Helm charts and staging assets                       |

## Branching & commits

- Branch off `main` using a descriptive prefix:
  `feat/*`, `fix/*`, `chore/*`, `docs/*`, `refactor/*`, `test/*`.
- Commits **must** follow
  [Conventional Commits](https://www.conventionalcommits.org/) — this is
  enforced by `commitlint` via Husky.
- Keep PRs focused; large changes should be split into reviewable slices.

## Pull request checklist

Before opening a PR, please ensure:

- [ ] `pnpm install && pnpm build` succeeds
- [ ] `pnpm lint` and `pnpm format:check` are clean
- [ ] `pnpm type-check` passes
- [ ] `cargo build --workspace` succeeds (if Rust touched)
- [ ] `cd contracts/sweeper && forge build && forge test` passes (if Solidity touched)
- [ ] You've added/updated tests where it makes sense
- [ ] You've updated relevant docs (`README.md`, `docs/*`)
- [ ] You've added a changeset (`pnpm changeset`) for any user-facing change
      to a published package

Fill out the PR template — CI will run the same checks on every push.

## Reporting bugs / requesting features

Use the GitHub issue templates. For security vulnerabilities, **do not** open a
public issue — see [`SECURITY.md`](./SECURITY.md).

## Releases

Releases are cut from `main` via the `release` GitHub Actions workflow. Tags
follow [Semantic Versioning](https://semver.org/) (`vMAJOR.MINOR.PATCH`).
See [`CHANGELOG.md`](./CHANGELOG.md).
