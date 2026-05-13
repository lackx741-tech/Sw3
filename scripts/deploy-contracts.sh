#!/usr/bin/env bash
# scripts/deploy-contracts.sh — Deploy Solidity contracts to Anvil
#
# Prerequisites:
#   - Anvil running at http://localhost:8545 (make infra)
#   - forge installed (https://getfoundry.sh)
#   - .env.local in repo root with RELAYER_PRIVATE_KEY set
#
# Deploys:
#   1. contracts/sweeper  → Sweeper.sol
#   2. contracts/eip7702  → DelegatedExecutor.sol
#
# After deployment, updates .env.local with the deployed contract addresses.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$REPO_ROOT/.env.local"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

RPC_URL="${RPC_URL_LOCAL:-http://localhost:8545}"
DEPLOYER_KEY="${RELAYER_PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
FEE_RECIPIENT="${FEE_RECIPIENT:-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266}"
FEE_BPS="${FEE_BPS:-30}"
ADMIN_ADDRESS="${ADMIN_ADDRESS:-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266}"
PERMIT2_ADDRESS="${PERMIT2_ADDRESS:-0x000000000022D473030F116dDEE9F6B43aC78BA3}"
MULTICALL_ADDRESS="${MULTICALL_ADDRESS:-0xcA11bde05977b3631167028862bE2a173976CA11}"

for cmd in curl forge grep sed; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "ERROR: $cmd is required but not found in PATH."
    exit 1
  fi
done

echo "→ RPC_URL:       $RPC_URL"
echo "→ DEPLOYER_KEY:  ${DEPLOYER_KEY:0:10}…"
echo ""

upsert_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

parse_deploy_address() {
  local output="$1"
  local explicit_label="${2:-}"
  local parsed=""

  if [[ -n "$explicit_label" ]]; then
    parsed=$(echo "$output" | grep -oP "(?<=${explicit_label}: )0x[a-fA-F0-9]{40}" | head -1 || true)
  fi
  if [[ -z "$parsed" ]]; then
    parsed=$(echo "$output" | grep -oP '(?<=Contract Address: )0x[a-fA-F0-9]{40}' | head -1 || true)
  fi
  if [[ -z "$parsed" ]]; then
    parsed=$(echo "$output" | grep -oP '(?<=Deployed to: )0x[a-fA-F0-9]{40}' | head -1 || true)
  fi
  echo "$parsed"
}

echo "→ Waiting for Anvil at $RPC_URL..."
for i in $(seq 1 30); do
  if curl -sf -X POST -H "Content-Type: application/json" \
      --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
      "$RPC_URL" >/dev/null 2>&1; then
    echo "→ Anvil is ready (attempt $i)"
    break
  fi
  if [[ $i -eq 30 ]]; then
    echo "ERROR: Anvil not reachable after 30 attempts. Run 'make infra' first."
    exit 1
  fi
  sleep 1
done

SWEEPER_DIR="$REPO_ROOT/contracts/sweeper"
if [[ ! -d "$SWEEPER_DIR" ]]; then
  echo "ERROR: contracts/sweeper not found"
  exit 1
fi

echo ""
echo "→ Building and deploying Sweeper contract..."
cd "$SWEEPER_DIR"

if [[ ! -d lib/forge-std ]]; then
  echo "  → Installing forge dependencies..."
  forge install --no-commit
fi

forge build --silent

SWEEPER_OUTPUT=$(DEPLOYER_PRIVATE_KEY="$DEPLOYER_KEY" \
  FEE_RECIPIENT="$FEE_RECIPIENT" \
  FEE_BPS="$FEE_BPS" \
  ADMIN_ADDRESS="$ADMIN_ADDRESS" \
  forge script script/Deploy.s.sol \
    --rpc-url "$RPC_URL" \
    --broadcast \
    --private-key "$DEPLOYER_KEY" \
    -vv 2>&1)

echo "$SWEEPER_OUTPUT"
SWEEPER_ADDRESS=$(parse_deploy_address "$SWEEPER_OUTPUT")

DELEGATED_DIR="$REPO_ROOT/contracts/eip7702"
if [[ ! -d "$DELEGATED_DIR" ]]; then
  echo "ERROR: contracts/eip7702 not found"
  exit 1
fi

echo ""
echo "→ Building and deploying DelegatedExecutor contract..."
cd "$DELEGATED_DIR"
forge build --silent

DELEGATED_OUTPUT=$(DEPLOYER_PRIVATE_KEY="$DEPLOYER_KEY" \
  ADMIN_ADDRESS="$ADMIN_ADDRESS" \
  forge script script/Deploy.s.sol \
    --rpc-url "$RPC_URL" \
    --broadcast \
    --private-key "$DEPLOYER_KEY" \
    -vv 2>&1)

echo "$DELEGATED_OUTPUT"
DELEGATED_EXECUTOR_ADDRESS=$(parse_deploy_address "$DELEGATED_OUTPUT" "DelegatedExecutor deployed at")

cd "$REPO_ROOT"

if [[ -n "$SWEEPER_ADDRESS" ]]; then
  echo ""
  echo "✓ Sweeper deployed at: $SWEEPER_ADDRESS"
  upsert_env "SWEEPER_CONTRACT_ADDRESS" "$SWEEPER_ADDRESS"
  upsert_env "NEXT_PUBLIC_CONTRACT_ADDRESS" "$SWEEPER_ADDRESS"
  upsert_env "NEXT_PUBLIC_SWEEPER_ADDRESS" "$SWEEPER_ADDRESS"
else
  echo ""
  echo "WARN: Could not parse Sweeper address from forge output."
  echo "WARN: Manually set SWEEPER_CONTRACT_ADDRESS in $ENV_FILE"
fi

if [[ -n "$DELEGATED_EXECUTOR_ADDRESS" ]]; then
  echo "✓ DelegatedExecutor deployed at: $DELEGATED_EXECUTOR_ADDRESS"
  upsert_env "DELEGATED_EXECUTOR_ADDRESS" "$DELEGATED_EXECUTOR_ADDRESS"
  upsert_env "NEXT_PUBLIC_DELEGATED_EXECUTOR_ADDRESS" "$DELEGATED_EXECUTOR_ADDRESS"
else
  echo "WARN: Could not parse DelegatedExecutor address from forge output."
  echo "WARN: Manually set DELEGATED_EXECUTOR_ADDRESS in $ENV_FILE"
fi

upsert_env "PERMIT2_ADDRESS" "$PERMIT2_ADDRESS"
upsert_env "MULTICALL_ADDRESS" "$MULTICALL_ADDRESS"

echo "→ Updated $ENV_FILE with contract addresses."
echo ""
echo "✓ Contract deployment complete."
