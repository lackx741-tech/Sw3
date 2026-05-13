# Staging Deployment

This document describes how to deploy the SW3 platform to a staging
environment using the Helm chart in `deploy/helm/sw3/`.

---

## What is deployable after this PR

| Component | Deployable | Notes |
|-----------|-----------|-------|
| api-gateway | ✅ | Python FastAPI; Helm Deployment + Service + Ingress |
| auth-service | ✅ | Python FastAPI; Helm Deployment + Service |
| analytics-service | ✅ | Python FastAPI; Helm Deployment + Service |
| execution-engine | ✅ | Rust; Helm Deployment + Service |
| simulation-engine | ✅ | Rust; Helm Deployment + Service |
| rpc-router | ✅ | Rust; Helm Deployment + Service |
| dashboard | ✅ | Next.js; `apps/dashboard/Dockerfile` — deploy separately |
| indexer-service | ⚠️ | No HTTP listener; deploy as a Kubernetes `Job` or background `Deployment` — not in Helm chart yet |
| billing-service | ⚠️ | Dockerfile exists; not yet in Helm chart (placeholder service) |
| webhook-service | ⚠️ | Dockerfile exists; not yet in Helm chart (placeholder service) |

Infrastructure (PostgreSQL, Redis, ClickHouse) is expected to be provided
by managed cloud services or existing cluster operators and is **not** in
this Helm chart.

---

## Prerequisites

1. **Kubernetes cluster** — any K8s ≥ 1.27 (EKS, GKE, AKS, or k3s staging node).
2. **nginx ingress controller** — `helm repo add ingress-nginx && helm install ingress-nginx ingress-nginx/ingress-nginx`.
3. **kubectl** and **helm ≥ 3.12** installed locally.
4. **Container registry** — Docker images built and pushed (e.g. GHCR, ECR, GCR).
5. **Managed infra** provisioned:
   - PostgreSQL with `sw3_staging` database + `sw3` user
   - Redis instance
   - ClickHouse instance with `sw3_analytics` database

---

## Step-by-step: first staging deploy

### 1. Build and push images

```bash
# Example using GHCR
export REGISTRY=ghcr.io/lackx741-tech

# Python services
docker build -f services/api-gateway/Dockerfile  services/api-gateway  -t $REGISTRY/sw3/api-gateway:main
docker build -f services/auth-service/Dockerfile services/auth-service -t $REGISTRY/sw3/auth-service:main
docker build -f services/analytics-service/Dockerfile services/analytics-service -t $REGISTRY/sw3/analytics-service:main

# Rust services (build from repo root)
docker build -f services/execution-engine/Dockerfile . -t $REGISTRY/sw3/execution-engine:main
docker build -f services/simulation-engine/Dockerfile . -t $REGISTRY/sw3/simulation-engine:main
docker build -f services/rpc-router/Dockerfile         . -t $REGISTRY/sw3/rpc-router:main

# Dashboard
docker build -f apps/dashboard/Dockerfile . -t $REGISTRY/sw3/dashboard:main

# Push all
docker push $REGISTRY/sw3/api-gateway:main
docker push $REGISTRY/sw3/auth-service:main
docker push $REGISTRY/sw3/analytics-service:main
docker push $REGISTRY/sw3/execution-engine:main
docker push $REGISTRY/sw3/simulation-engine:main
docker push $REGISTRY/sw3/rpc-router:main
docker push $REGISTRY/sw3/dashboard:main
```

### 2. Create the namespace and secrets

```bash
kubectl create namespace sw3 --dry-run=client -o yaml | kubectl apply -f -

# Copy staging.env.example, fill in real values, then:
cp deploy/staging.env.example /tmp/staging.env
# edit /tmp/staging.env with real DB URL, JWT secret, etc.

kubectl create secret generic sw3-secrets \
  --namespace sw3 \
  --from-env-file=/tmp/staging.env \
  --dry-run=client -o yaml | kubectl apply -f -

# Clean up the env file
rm /tmp/staging.env
```

### 3. Deploy the Helm chart

```bash
helm upgrade --install sw3 ./deploy/helm/sw3 \
  -f deploy/helm/values.staging.yaml \
  --namespace sw3 \
  --set global.imageRegistry=ghcr.io/lackx741-tech \
  --wait --timeout=5m
```

### 4. Verify

```bash
kubectl get pods -n sw3
kubectl get ingress -n sw3

# Health check the API gateway
curl https://api.sw3-staging.example.com/health

# Smoke test (requires cast, jq, curl)
API_BASE=https://api.sw3-staging.example.com bash scripts/test-golden-path.sh
```

---

## Required secrets (`sw3-secrets`)

These keys **must** be present in the `sw3-secrets` Kubernetes Secret.
See `deploy/staging.env.example` for descriptions and placeholder values.

| Key | Required by |
|-----|-------------|
| `JWT_SECRET` | auth-service |
| `DATABASE_URL` | api-gateway, execution-engine |
| `REDIS_URL` | auth-service, api-gateway, execution-engine |
| `CLICKHOUSE_HOST` | analytics-service |
| `CLICKHOUSE_PASSWORD` | analytics-service |
| `CLICKHOUSE_DATABASE` | analytics-service |
| `RPC_URLS` | execution-engine, simulation-engine, rpc-router |
| `SWEEPER_PRIVATE_KEY` | execution-engine |
| `SWEEPER_CONTRACT` | execution-engine |
| `SECRET_KEY` | api-gateway |

Optional keys (have defaults but should be overridden for staging):

| Key | Default | Notes |
|-----|---------|-------|
| `CHAIN_ID` | `31337` | Set to `11155111` (Sepolia) or your target chain |
| `MAX_BATCH_SIZE` | `50` | Lower in staging if gas budget is limited |
| `CONFIRMATION_BLOCKS` | `2` | Higher = safer, slower |

---

## Updating a running deployment

```bash
# Tag new images and push, then:
helm upgrade sw3 ./deploy/helm/sw3 \
  -f deploy/helm/values.staging.yaml \
  --namespace sw3 \
  --set global.imageRegistry=ghcr.io/lackx741-tech \
  --set apiGateway.image.tag=<new-tag> \
  --wait
```

---

## Remaining production gaps (not solved by this PR)

| Gap | Notes |
|-----|-------|
| **TLS certificates** | The Ingress has `tls.enabled: true` in values.staging.yaml but you must provision the cert (cert-manager, ACM, etc.) separately. |
| **JWT RS256 key rotation** | Auth service uses HS256 shared secret. Multi-service prod deployments should rotate to RS256 with a key pair. |
| **indexer-service Kubernetes spec** | The indexer is a background worker with no HTTP listener. A Helm Deployment template for it is not yet included — add it as a `Deployment` with `replicas: 1` and no Service/probes. |
| **Database migrations in CI/CD** | `scripts/migrate.sh` is designed for local use. For staging, run it as a Kubernetes `Job` before deploying new app versions, or use Flyway/Liquibase. |
| **Image signing / SBOM** | No image attestations yet. Add `cosign` signing in the Docker build workflow before production. |
| **Horizontal pod autoscaling** | HPA resources are not in the chart. Add based on observed CPU/memory in staging. |
| **Rate limiting** | nginx ingress annotations for rate limiting are not set. Add before exposing to public traffic. |
| **Inter-service mTLS** | Services communicate over plain HTTP within the cluster. Use a service mesh (Istio/Linkerd) or at minimum NetworkPolicies for production. |
| **Observability (staging)** | Prometheus/Grafana/Loki are local-only. For staging, point `OTEL_EXPORTER_OTLP_ENDPOINT` at a managed collector (Grafana Cloud, Honeycomb, etc.). |
