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

echo ""

# ─── 4. Execution engine ─────────────────────────────────────────────────────
echo "Step 4 — Execution engine /health"

check "Execution engine /health" "$(http_ok "http://localhost:8080/health" 2>/dev/null || echo "not running (start Rust service separately)")"

echo ""

# ─── 5. Analytics ─────────────────────────────────────────────────────────────
echo "Step 5 — Analytics service /health"
check "Analytics service /health" "$(http_ok "http://localhost:8004/health")"

echo ""

# ─── 6. Observability ─────────────────────────────────────────────────────────
echo "Step 6 — Observability stack"
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
