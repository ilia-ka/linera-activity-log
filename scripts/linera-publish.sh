#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
IDS_PATH="${LINERA_IDS_PATH:-$ROOT/.linera/ids.json}"
if [[ "$IDS_PATH" != /* ]]; then
  IDS_PATH="$ROOT/$IDS_PATH"
fi
APP_WASM="${LINERA_CONTRACT_WASM:-$ROOT/linera-app/target/wasm32-unknown-unknown/release/activity_log_contract.wasm}"
SERVICE_WASM="${LINERA_SERVICE_WASM:-$ROOT/linera-app/target/wasm32-unknown-unknown/release/activity_log_service.wasm}"

PUBLISH_OUT=$(linera publish-and-create "$APP_WASM" "$SERVICE_WASM" --json-argument "null" 2>&1)
printf "%s\n" "$PUBLISH_OUT"

APP_ID=$(printf "%s\n" "$PUBLISH_OUT" | grep -Eo '[0-9a-f]{64}' | tail -n1 || true)

CHAIN_ID="${LINERA_CHAIN_ID:-}"
if [ -z "$CHAIN_ID" ]; then
  WALLET_OUT=$(linera wallet show)
  CHAIN_ID=$(printf "%s\n" "$WALLET_OUT" | awk '$1=="Chain" && $2=="ID:" { id=$3 } $1=="Tags:" && $2=="DEFAULT" { default_id=id } END { print default_id }')
fi

if [ -z "$APP_ID" ] || [ -z "$CHAIN_ID" ]; then
  echo "failed to resolve chainId/appId" >&2
  exit 1
fi

mkdir -p "$(dirname "$IDS_PATH")"
printf '{"chainId":"%s","appId":"%s"}\n' "$CHAIN_ID" "$APP_ID" > "$IDS_PATH"
printf "ids written to %s\n" "$IDS_PATH"
