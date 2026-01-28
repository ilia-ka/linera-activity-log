#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
RUN_DIR="$ROOT/.run"
mkdir -p "$RUN_DIR"

load_env() {
  if [ -f "$ROOT/.env" ]; then
    set -a
    . "$ROOT/.env"
    set +a
  fi
}

resolve_ids_path() {
  local ids_path="${LINERA_IDS_PATH:-$ROOT/.linera/ids.json}"
  if [[ "$ids_path" != /* ]]; then
    ids_path="$ROOT/$ids_path"
  fi
  printf "%s" "$ids_path"
}

export_linera_env() {
  mkdir -p "$ROOT/.linera"
  export LINERA_WALLET="$ROOT/.linera/wallet.json"
  export LINERA_KEYSTORE="$ROOT/.linera/keystore.json"
  export LINERA_STORAGE="rocksdb:$ROOT/.linera/wallet.db"
  echo "LINERA_WALLET=$LINERA_WALLET"
  echo "LINERA_KEYSTORE=$LINERA_KEYSTORE"
  echo "LINERA_STORAGE=$LINERA_STORAGE"
}

wait_for_port() {
  local name="$1"
  local host="$2"
  local port="$3"
  local timeout="${4:-30}"
  local elapsed=0
  while [ "$elapsed" -lt "$timeout" ]; do
    if bash -c "echo > /dev/tcp/$host/$port" >/dev/null 2>&1; then
      echo "$name ready on $host:$port"
      return
    fi
    printf "."
    sleep 1
    elapsed=$((elapsed + 1))
  done
  echo ""
  echo "$name not ready after ${timeout}s"
}

reset_linera_wallet() {
  rm -rf "$ROOT/.linera"
  mkdir -p "$ROOT/.linera"
  echo "reset $ROOT/.linera"
}

start_bg() {
  local name="$1"
  shift
  local pid_file="$RUN_DIR/$name.pid"
  local log_file="$RUN_DIR/$name.log"
  if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    echo "$name already running (pid $(cat "$pid_file"))"
    return
  fi
  nohup "$@" > "$log_file" 2>&1 &
  echo $! > "$pid_file"
  echo "$name started (pid $(cat "$pid_file"))"
  echo "log: $log_file"
}

start_net_up() {
  load_env
  export_linera_env
  local faucet_url="${LINERA_FAUCET_URL:-http://localhost:8080}"
  local faucet_port
  faucet_port=$(printf "%s" "$faucet_url" | sed -E 's#.*:([0-9]+)(/.*)?$#\1#')
  if [ -z "$faucet_port" ] || [ "$faucet_port" = "$faucet_url" ]; then
    faucet_port=8080
  fi
  start_bg "net-up" linera net up --with-faucet --faucet-port "$faucet_port"
  wait_for_port "faucet" "localhost" "$faucet_port" 40
}

wallet_init() {
  load_env
  export_linera_env
  local faucet_url="${LINERA_FAUCET_URL:-http://localhost:8080}"
  linera wallet init --faucet "$faucet_url"
}

wallet_request_chain() {
  load_env
  export_linera_env
  local faucet_url="${LINERA_FAUCET_URL:-http://localhost:8080}"
  linera wallet request-chain --faucet "$faucet_url"
}

build_wasm() {
  load_env
  export_linera_env
  (cd "$ROOT/linera-app" && cargo +1.86.0 build --release --target wasm32-unknown-unknown)
}

publish_and_write_ids() {
  load_env
  export_linera_env
  "$ROOT/scripts/linera-publish.sh"
}

write_ids_prompt() {
  load_env
  local ids_path
  ids_path=$(resolve_ids_path)
  read -r -p "chainId: " chain_id
  read -r -p "appId: " app_id
  if [ -z "$chain_id" ] || [ -z "$app_id" ]; then
    echo "chainId/appId required"
    return
  fi
  mkdir -p "$(dirname "$ids_path")"
  printf '{"chainId":"%s","appId":"%s"}\n' "$chain_id" "$app_id" > "$ids_path"
  echo "ids written to $ids_path"
}

start_service() {
  load_env
  export_linera_env
  local service_port="8081"
  if [ -n "${LINERA_ENDPOINT:-}" ]; then
    local parsed
    parsed=$(printf "%s" "$LINERA_ENDPOINT" | sed -E 's#.*:([0-9]+)(/.*)?$#\1#')
  if [ -n "$parsed" ] && [ "$parsed" != "$LINERA_ENDPOINT" ]; then
      service_port="$parsed"
    fi
  fi
  start_bg "linera-service" linera service --port "$service_port"
  wait_for_port "linera service" "localhost" "$service_port" 20
}

start_relayer() {
  load_env
  (cd "$ROOT/relayer" && npm install)
  start_bg "relayer" bash -lc "cd \"$ROOT/relayer\" && npm run dev"
  local relayer_port="${PORT:-3000}"
  wait_for_port "relayer" "localhost" "$relayer_port" 20
}

run_tests() {
  load_env
  (cd "$ROOT/relayer" && npm test)
  (cd "$ROOT/relayer" && npm run test:e2e)
  (cd "$ROOT/relayer" && npm run test:e2e:linera)
}

full_setup() {
  reset_linera_wallet
  export_linera_env
  start_net_up
  wallet_init
  wallet_request_chain
  build_wasm
  publish_and_write_ids
  start_service
  start_relayer
}

menu() {
  echo ""
  echo "1) Reset .linera"
  echo "2) Export LINERA_* (local .linera)"
  echo "3) Start linera net up (background)"
  echo "4) linera wallet init"
  echo "5) linera wallet request-chain"
  echo "6) Build wasm"
  echo "7) Publish app + write ids"
  echo "8) Start linera service (background)"
  echo "9) Start relayer (background)"
  echo "10) Run tests (unit + e2e + e2e:linera)"
  echo "11) Write ids manually"
  echo "0) Full setup (1-9)"
  echo "q) Quit"
}

while true; do
  menu
  read -r -p "Select: " choice
  case "$choice" in
    1) reset_linera_wallet ;;
    2) export_linera_env ;;
    3) start_net_up ;;
    4) wallet_init ;;
    5) wallet_request_chain ;;
    6) build_wasm ;;
    7) publish_and_write_ids ;;
    8) start_service ;;
    9) start_relayer ;;
    10) run_tests ;;
    11) write_ids_prompt ;;
    0) full_setup ;;
    q|Q) exit 0 ;;
    *) echo "Unknown option" ;;
  esac
 done
