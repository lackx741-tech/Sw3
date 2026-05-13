# services/rpc-router/Dockerfile
# Multi-stage build — build context must be the repo root:
#   docker build -f services/rpc-router/Dockerfile -t sw3/rpc-router .

# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM rust:1.79-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace manifests first (layer-cache workspace dependency builds)
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./

# Copy all member manifests so cargo can resolve the full workspace
COPY services/execution-engine/Cargo.toml  ./services/execution-engine/
COPY services/simulation-engine/Cargo.toml ./services/simulation-engine/
COPY services/rpc-router/Cargo.toml        ./services/rpc-router/
COPY services/indexer-service/Cargo.toml   ./services/indexer-service/
COPY services/mempool-listener/Cargo.toml  ./services/mempool-listener/

# Stub out other workspace members so the workspace resolves before real source
RUN for svc in execution-engine simulation-engine indexer-service mempool-listener; do \
      mkdir -p services/$svc/src && \
      printf 'fn main() {}' > services/$svc/src/main.rs; \
    done && \
    # execution-engine also has lib.rs; stub it to satisfy the workspace
    touch services/execution-engine/src/lib.rs

# Copy real source for this service and build
COPY services/rpc-router/src ./services/rpc-router/src

RUN cargo build --release --bin rpc-router

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/target/release/rpc-router /usr/local/bin/

# rpc-router listens on 9091 in compose (avoids conflict with Prometheus :9090)
EXPOSE 9091

ENTRYPOINT ["/usr/local/bin/rpc-router"]
