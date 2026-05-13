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
#
# After deployment, updates .env.local with the deployed contract addresses.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$REPO_ROOT/.env.local"

# ─── Load env ────────────────────────────────────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

RPC_URL="${RPC_URL_LOCAL:-http://localhost:8545}"
DEPLOYER_KEY="${RELAYER_PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"
FEE_RECIPIENT="${FEE_RECIPIENT:-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266}"
FEE_BPS="${FEE_BPS:-30}"
ADMIN_ADDRESS="${ADMIN_ADDRESS:-0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266}"

echo "→ RPC_URL:       $RPC_URL"
echo "→ DEPLOYER_KEY:  ${DEPLOYER_KEY:0:10}…"
echo ""

# ─── Wait for Anvil ──────────────────────────────────────────────────────────
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

# ─── Deploy Sweeper ───────────────────────────────────────────────────────────
SWEEPER_DIR="$REPO_ROOT/contracts/sweeper"
if [[ ! -d "$SWEEPER_DIR" ]]; then
  echo "ERROR: contracts/sweeper not found"
  exit 1
fi

echo ""
echo "→ Building and deploying Sweeper contract..."
cd "$SWEEPER_DIR"

# Install forge dependencies if not already installed
if [[ ! -d lib/forge-std ]]; then
  echo "  → Installing forge dependencies..."
  forge install --no-commit
fi

# Build
forge build --silent

# Deploy via forge script
DEPLOY_OUTPUT=$(DEPLOYER_PRIVATE_KEY="$DEPLOYER_KEY" \
  FEE_RECIPIENT="$FEE_RECIPIENT" \
  FEE_BPS="$FEE_BPS" \
  ADMIN_ADDRESS="$ADMIN_ADDRESS" \
  forge script script/Deploy.s.sol \
    --rpc-url "$RPC_URL" \
    --broadcast \
    --private-key "$DEPLOYER_KEY" \
    -vv 2>&1)

echo "$DEPLOY_OUTPUT"

# Extract deployed contract address from forge output
SWEEPER_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP '(?<=Contract Address: )0x[a-fA-F0-9]{40}' | head -1 || true)

if [[ -z "$SWEEPER_ADDRESS" ]]; then
  # Fallback: look for "Deployed to:" pattern
  SWEEPER_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP '(?<=Deployed to: )0x[a-fA-F0-9]{40}' | head -1 || true)
fi

cd "$REPO_ROOT"

# ─── Update .env.local ───────────────────────────────────────────────────────
if [[ -n "$SWEEPER_ADDRESS" ]]; then
  echo ""
  echo "✓ Sweeper deployed at: $SWEEPER_ADDRESS"

  # Update .env.local with the deployed address
  if grep -q "^SWEEPER_CONTRACT_ADDRESS=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^SWEEPER_CONTRACT_ADDRESS=.*|SWEEPER_CONTRACT_ADDRESS=$SWEEPER_ADDRESS|" "$ENV_FILE"
  else
    echo "SWEEPER_CONTRACT_ADDRESS=$SWEEPER_ADDRESS" >> "$ENV_FILE"
  fi

  if grep -q "^NEXT_PUBLIC_CONTRACT_ADDRESS=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^NEXT_PUBLIC_CONTRACT_ADDRESS=.*|NEXT_PUBLIC_CONTRACT_ADDRESS=$SWEEPER_ADDRESS|" "$ENV_FILE"
  else
    echo "NEXT_PUBLIC_CONTRACT_ADDRESS=$SWEEPER_ADDRESS" >> "$ENV_FILE"
  fi

  echo "→ Updated $ENV_FILE with contract addresses."
else
  echo ""
  echo "WARN: Could not parse contract address from forge output."
  echo "WARN: Manually set SWEEPER_CONTRACT_ADDRESS in $ENV_FILE"
fi

echo ""
echo "✓ Contract deployment complete."
