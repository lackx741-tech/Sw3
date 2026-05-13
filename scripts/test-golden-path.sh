#!/usr/bin/env bash
# scripts/test-golden-path.sh — End-to-end golden path smoke test
#
# Tests the full flow:
#   wallet connect → SIWE auth → authorization → simulation → batch → execution
#   → indexing → analytics
#
# Uses the Anvil test account #0 to sign a SIWE message.
# Requires: curl, jq, cast (foundry), and the full stack running via `make dev`.
#
# Exit codes:
#   0 = all checks passed
#   1 = one or more checks failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$REPO_ROOT/.env.local"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

API_BASE="${API_BASE:-http://localhost:8000}"
RPC_URL="${RPC_URL_LOCAL:-http://localhost:8545}"
CLICKHOUSE_URL="${CLICKHOUSE_URL_LOCAL:-http://localhost:8123}"

# Anvil test account #0
WALLET_ADDRESS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

PASS=0
FAIL=0

check() {
  local name="$1"
  local result="$2"
  if [[ "$result" == "ok" ]]; then
    echo "  ✓ $name"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name — $result"
    FAIL=$((FAIL + 1))
  fi
}

http_ok() {
  local url="$1"
  local code
  code=$(curl -sf -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
  [[ "$code" -ge 200 && "$code" -lt 300 ]] && echo "ok" || echo "HTTP $code"
}

echo ""
echo "═══════════════════════════════════════"
echo "  SW3 Golden Path — Smoke Test"
echo "═══════════════════════════════════════"
echo ""

# ─── 1. Infrastructure health ────────────────────────────────────────────────
echo "Step 1 — Infrastructure health"

check "API Gateway /health"  "$(http_ok "$API_BASE/health")"
check "Auth Service /health" "$(http_ok "http://localhost:8001/health")"
check "Analytics   /health" "$(http_ok "http://localhost:8004/health")"

ANVIL_BLOCK=$(curl -sf -X POST \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  "$RPC_URL" 2>/dev/null | jq -r '.result // empty' || true)
check "Anvil /eth_blockNumber" "$([ -n "$ANVIL_BLOCK" ] && echo "ok" || echo "no response")"

echo ""

# ─── 1a. Contract bootstrap wiring ────────────────────────────────────────────
echo "Step 1a — Local contract bootstrap wiring"

check "SWEEPER_CONTRACT_ADDRESS configured" "$([ -n "${SWEEPER_CONTRACT_ADDRESS:-}" ] && echo "ok" || echo "missing in .env.local")"
check "DELEGATED_EXECUTOR_ADDRESS configured" "$([ -n "${DELEGATED_EXECUTOR_ADDRESS:-}" ] && echo "ok" || echo "missing in .env.local")"

if command -v cast >/dev/null 2>&1 && [[ -n "${DELEGATED_EXECUTOR_ADDRESS:-}" ]]; then
  DELEGATED_NONCE_USED=$(cast call \
    "$DELEGATED_EXECUTOR_ADDRESS" \
    "isNonceUsed(address,uint256)(bool)" \
    "$WALLET_ADDRESS" \
    "0" \
    --rpc-url "$RPC_URL" 2>/dev/null || true)
  check "DelegatedExecutor is callable" "$([ "$DELEGATED_NONCE_USED" = "false" ] && echo "ok" || echo "unexpected response: ${DELEGATED_NONCE_USED:-empty}")"
else
  echo "  ⚠ cast missing or DELEGATED_EXECUTOR_ADDRESS unset — skipping DelegatedExecutor call check"
fi

echo ""

# ─── 2. SIWE auth flow ──────────────────────────────────────────────────────
echo "Step 2 — SIWE auth (wallet connect → nonce → sign → verify → JWT)"

# 2a. Request nonce
NONCE_RESP=$(curl -sf -X POST \
  -H "Content-Type: application/json" \
  --data "{\"address\": \"$WALLET_ADDRESS\"}" \
  "http://localhost:8001/v1/auth/nonce" 2>/dev/null || echo '{}')
NONCE=$(echo "$NONCE_RESP" | jq -r '.nonce // empty')
check "Get SIWE nonce" "$([ -n "$NONCE" ] && echo "ok" || echo "no nonce in response: $NONCE_RESP")"

# 2b. Build SIWE message
DOMAIN="localhost"
ISSUED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
CHAIN_ID=31337
SIWE_MSG="$DOMAIN wants you to sign in with your Ethereum account:
$WALLET_ADDRESS

Sign in to SW3

URI: http://localhost:3000
Version: 1
Chain ID: $CHAIN_ID
Nonce: $NONCE
Issued At: $ISSUED_AT"

# 2c. Sign with cast (if available)
JWT=""
if command -v cast >/dev/null 2>&1 && [[ -n "$NONCE" ]]; then
  SIG=$(cast sign --private-key "$PRIVATE_KEY" "$SIWE_MSG" 2>/dev/null || true)
  if [[ -n "$SIG" ]]; then
    VERIFY_RESP=$(curl -sf -X POST \
      -H "Content-Type: application/json" \
      --data "$(jq -n \
        --arg msg "$SIWE_MSG" \
        --arg sig "$SIG" \
        --arg addr "$WALLET_ADDRESS" \
        --argjson chain "$CHAIN_ID" \
        '{message: $msg, signature: $sig, address: $addr, chain_id: $chain}')" \
      "http://localhost:8001/v1/auth/verify" 2>/dev/null || echo '{}')
    JWT=$(echo "$VERIFY_RESP" | jq -r '.token // empty')
    check "SIWE verify → JWT" "$([ -n "$JWT" ] && echo "ok" || echo "no token: $VERIFY_RESP")"
  else
    check "SIWE sign (cast)" "cast sign failed — skipping verify"
  fi
else
  echo "  ⚠ cast not found or nonce missing — skipping SIWE sign/verify"
fi

echo ""

# ─── 3. API Gateway proxy ─────────────────────────────────────────────────────
echo "Step 3 — API Gateway proxies auth flow"

GW_NONCE_RESP=$(curl -sf -X POST \
  -H "Content-Type: application/json" \
  --data "{\"address\": \"$WALLET_ADDRESS\"}" \
  "$API_BASE/v1/auth/nonce" 2>/dev/null || echo '{}')
GW_NONCE=$(echo "$GW_NONCE_RESP" | jq -r '.nonce // empty')
check "API GW /v1/auth/nonce proxy" "$([ -n "$GW_NONCE" ] && echo "ok" || echo "no nonce: $GW_NONCE_RESP")"

# Check correlation ID is propagated in response headers
CORR_ID=$(curl -sf -X POST \
  -H "Content-Type: application/json" \
  --data "{\"address\": \"$WALLET_ADDRESS\"}" \
  -D - \
  "$API_BASE/v1/auth/nonce" 2>/dev/null | grep -i "x-correlation-id" | tr -d '\r' | awk '{print $2}' || true)
check "X-Correlation-ID in response" "$([ -n "$CORR_ID" ] && echo "ok" || echo "header missing")"

echo ""

# ─── 4. Simulation engine ────────────────────────────────────────────────────
echo "Step 4 — Transaction simulation"

check "Simulation engine /health" "$(http_ok "http://localhost:8082/health")"

# 4a. Direct simulation
SIM_RESP=$(curl -sf -X POST \
  -H "Content-Type: application/json" \
  --data "$(jq -n \
    --arg from "$WALLET_ADDRESS" \
    --arg to   "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" \
    '{from: $from, to: $to, value: "0x0", data: "0x"}')" \
  "http://localhost:8082/simulate" 2>/dev/null || echo '{}')
SIM_SUCCESS=$(echo "$SIM_RESP" | jq -r '.success // empty')
check "Direct POST /simulate" "$([ "$SIM_SUCCESS" = "true" ] && echo "ok" || echo "failed: $SIM_RESP")"

# 4b. Via API Gateway
GW_SIM_RESP=$(curl -sf -X POST \
  -H "Content-Type: application/json" \
  --data "$(jq -n \
    --arg from "$WALLET_ADDRESS" \
    --arg to   "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" \
    '{from: $from, to: $to, value: "0x0", data: "0x"}')" \
  "$API_BASE/v1/simulate/" 2>/dev/null || echo '{}')
GW_SIM_SUCCESS=$(echo "$GW_SIM_RESP" | jq -r '.success // empty')
check "API GW /v1/simulate proxy" "$([ "$GW_SIM_SUCCESS" = "true" ] && echo "ok" || echo "failed: $GW_SIM_RESP")"

echo ""

# ─── 5. Execution engine ─────────────────────────────────────────────────────
echo "Step 5 — Execution engine (sweep job lifecycle)"

check "Execution engine /health" "$(http_ok "http://localhost:8080/health")"
check "Execution engine /metrics" "$(http_ok "http://localhost:8080/metrics")"

# 5a. Create sweep job (via API GW with JWT if available)
AUTH_HEADER=""
if [[ -n "$JWT" ]]; then
  AUTH_HEADER="Authorization: Bearer $JWT"
fi

SWEEP_RESP=$(curl -sf -X POST \
  -H "Content-Type: application/json" \
  ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
  --data "$(jq -n \
    --arg owner     "$WALLET_ADDRESS" \
    --arg token     "0x0000000000000000000000000000000000000000" \
    --arg amount    "1000000000000000000" \
    --arg recipient "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" \
    '{owner: $owner, token: $token, amount: $amount, recipient: $recipient}')" \
  "$API_BASE/v1/sweeps/" 2>/dev/null || echo '{}')
SWEEP_ID=$(echo "$SWEEP_RESP" | jq -r '.id // empty')
check "Create sweep job via API GW" "$([ -n "$SWEEP_ID" ] && echo "ok" || echo "no id: $SWEEP_RESP")"

# 5b. Retrieve sweep job by ID
if [[ -n "$SWEEP_ID" ]]; then
  FETCH_RESP=$(curl -sf \
    ${AUTH_HEADER:+-H "$AUTH_HEADER"} \
    "$API_BASE/v1/sweeps/$SWEEP_ID" 2>/dev/null || echo '{}')
  FETCH_ID=$(echo "$FETCH_RESP" | jq -r '.id // empty')
  check "Retrieve sweep job by ID" "$([ "$FETCH_ID" = "$SWEEP_ID" ] && echo "ok" || echo "mismatch: $FETCH_RESP")"
else
  echo "  ⚠ sweep job creation failed — skipping retrieve"
fi

echo ""

# ─── 6. RPC Router ───────────────────────────────────────────────────────────
echo "Step 6 — RPC router"

check "RPC router /health" "$(http_ok "http://localhost:9091/health")"
check "RPC router /metrics" "$(http_ok "http://localhost:9091/metrics")"

RPC_RESP=$(curl -sf -X POST \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  "http://localhost:9091/" 2>/dev/null | jq -r '.result // empty' || true)
check "RPC router proxies eth_blockNumber" "$([ -n "$RPC_RESP" ] && echo "ok" || echo "no result")"

echo ""

# ─── 7. Analytics ─────────────────────────────────────────────────────────────
echo "Step 7 — Analytics persistence"

check "Analytics service /health" "$(http_ok "http://localhost:8004/health")"

# Fire an analytics event representing the completed golden path
ANALYTICS_RESP=$(curl -sf -X POST \
  -H "Content-Type: application/json" \
  --data "$(jq -n \
    --arg evt   "golden_path_smoke_test" \
    --arg addr  "$WALLET_ADDRESS" \
    --argjson ch "$CHAIN_ID" \
    '{event_type: $evt, address: $addr, chain_id: $ch, data: {source: "test-golden-path.sh"}}')" \
  "$API_BASE/v1/analytics/events" 2>/dev/null || echo '{}')
ANALYTICS_ACCEPTED=$(echo "$ANALYTICS_RESP" | jq -r '.accepted // empty')
check "Analytics event via API GW" "$([ "$ANALYTICS_ACCEPTED" = "true" ] && echo "ok" || echo "not accepted: $ANALYTICS_RESP")"

# Ensure event persisted to ClickHouse when available.
if [[ "$ANALYTICS_ACCEPTED" = "true" ]]; then
  CLICKHOUSE_QUERY_URL="$CLICKHOUSE_URL/?database=${CLICKHOUSE_DATABASE:-sw3_analytics}&user=${CLICKHOUSE_USER:-default}"
  if [[ -n "${CLICKHOUSE_PASSWORD:-}" ]]; then
    CLICKHOUSE_QUERY_URL="${CLICKHOUSE_QUERY_URL}&password=${CLICKHOUSE_PASSWORD}"
  fi
  EVENT_COUNT=$(curl -sfS \
    --data-binary "SELECT count() FROM analytics_events WHERE event_type = 'golden_path_smoke_test'" \
    "$CLICKHOUSE_QUERY_URL" 2>/dev/null | tr -d '\n' || true)
  check "Analytics event persisted to ClickHouse" "$([[ "${EVENT_COUNT:-0}" =~ ^[0-9]+$ && "$EVENT_COUNT" -ge 1 ]] && echo "ok" || echo "count=${EVENT_COUNT:-none}")"
fi

echo ""

# ─── 8. Observability ─────────────────────────────────────────────────────────
echo "Step 8 — Observability stack"
check "Prometheus /-/healthy" "$(http_ok "http://localhost:9090/-/healthy")"
check "Grafana /api/health"   "$(http_ok "http://localhost:3333/api/health")"
check "Loki /ready"           "$(http_ok "http://localhost:3100/ready")"

echo ""

# ─── Summary ─────────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "═══════════════════════════════════════"
echo ""

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
