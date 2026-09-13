#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [ -f "${ROOT_DIR}/contracts/.env" ]; then
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/contracts/.env"
fi

if [ -z "${PRIVATE_KEY:-}" ]; then
  echo "Missing PRIVATE_KEY in contracts/.env" >&2
  exit 1
fi

if [ -z "${MANTLE_SEPOLIA_TESTNET_RPC_URL:-}" ]; then
  echo "Missing MANTLE_SEPOLIA_TESTNET_RPC_URL in contracts/.env" >&2
  exit 1
fi

if [ -z "${ARBITRUM_SEPOLIA_RPC_URL:-}" ]; then
  echo "Missing ARBITRUM_SEPOLIA_RPC_URL in contracts/.env" >&2
  exit 1
fi

CONTRACT_PATH="contracts/sol/ZkAssetRaffle.sol:ZkAssetRaffle"

echo "Deploying to Mantle Sepolia Testnet..."
forge create "${CONTRACT_PATH}" \
  --rpc-url "${MANTLE_SEPOLIA_TESTNET_RPC_URL}" \
  --private-key "${PRIVATE_KEY}"

echo "Deploying to Arbitrum Sepolia..."
forge create "${CONTRACT_PATH}" \
  --rpc-url "${ARBITRUM_SEPOLIA_RPC_URL}" \
  --private-key "${PRIVATE_KEY}"
