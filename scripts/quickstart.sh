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

port_owner() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltnp "sport = :$port" 2>/dev/null || true
    return
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
  fi
}

stop_bg() {
  local name="$1"
  local port="${2:-}"
  local pid_file="$RUN_DIR/$name.pid"
  if [ ! -f "$pid_file" ]; then
    echo "$name not running"
    return
  fi
  local pid
  pid=$(cat "$pid_file")
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid"
    echo "$name stopped (pid $pid)"
  else
    echo "$name not running (stale pid $pid)"
    if [ -n "$port" ]; then
      port_owner "$port"
    fi
  fi
  rm -f "$pid_file"
}

get_faucet_port() {
  local faucet_url="${LINERA_FAUCET_URL:-http://localhost:8080}"
  local faucet_port
  faucet_port=$(printf "%s" "$faucet_url" | sed -E 's#.*:([0-9]+)(/.*)?$#\1#')
  if [ -z "$faucet_port" ] || [ "$faucet_port" = "$faucet_url" ]; then
    faucet_port=8080
  fi
  printf "%s" "$faucet_port"
}

get_service_port() {
  local service_port="8081"
  if [ -n "${LINERA_ENDPOINT:-}" ]; then
    local parsed
    parsed=$(printf "%s" "$LINERA_ENDPOINT" | sed -E 's#.*:([0-9]+)(/.*)?$#\1#')
    if [ -n "$parsed" ] && [ "$parsed" != "$LINERA_ENDPOINT" ]; then
      service_port="$parsed"
    fi
  fi
  printf "%s" "$service_port"
}

get_relayer_port() {
  printf "%s" "${PORT:-3000}"
}

stop_all() {
  stop_bg "relayer" "$(get_relayer_port)"
  stop_bg "linera-service" "$(get_service_port)"
  stop_bg "net-up" "$(get_faucet_port)"
}

kill_port() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" >/dev/null 2>&1 || true
    return
  fi
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids=$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "$pids" ]; then
      kill $pids || true
    fi
    return
  fi
  if command -v ss >/dev/null 2>&1; then
    local pids
    pids=$(ss -ltnp "sport = :$port" 2>/dev/null | sed -n 's/.*pid=\([0-9]\+\).*/\1/p' | sort -u)
    if [ -n "$pids" ]; then
      kill $pids || true
    fi
  fi
}

force_kill_ports() {
  kill_port "$(get_relayer_port)"
  kill_port "$(get_service_port)"
  kill_port "$(get_faucet_port)"
  echo "ports released (if any were in use)"
}

wait_for_port() {
  local name="$1"
  local host="$2"
  local port="$3"
  local timeout="${4:-30}"
  local pid_file="${5:-}"
  local elapsed=0
  while [ "$elapsed" -lt "$timeout" ]; do
    if [ -n "$pid_file" ] && [ -f "$pid_file" ]; then
      local pid
      pid=$(cat "$pid_file")
      if ! kill -0 "$pid" 2>/dev/null; then
        echo ""
        echo "$name exited (pid $pid)"
        return
      fi
    fi
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
  wait_for_port "faucet" "localhost" "$faucet_port" 40 "$RUN_DIR/net-up.pid"
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
  wait_for_port "linera service" "localhost" "$service_port" 20 "$RUN_DIR/linera-service.pid"
}

start_relayer() {
  load_env
  (cd "$ROOT/relayer" && npm install)
  start_bg "relayer" bash -lc "cd \"$ROOT/relayer\" && npm run dev"
  local relayer_port
  relayer_port=$(get_relayer_port)
  wait_for_port "relayer" "localhost" "$relayer_port" 20 "$RUN_DIR/relayer.pid"
}

run_tests() {
  load_env
  (cd "$ROOT/relayer" && npm test)
  (cd "$ROOT/relayer" && npm run test:e2e)
  (cd "$ROOT/relayer" && npm run test:e2e:linera)
}

sanity_curl() {
  load_env
  local base_url="${RELAYER_URL:-http://localhost:${PORT:-3000}}"
  local api_key="${RELAYER_API_KEY:-dev}"
  local actor="0x1111111111111111111111111111111111111111"
  local id="11111111-1111-4111-8111-111111111111"
  local intent="22222222-2222-4222-8222-222222222222"
  local now
  now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  echo "POST /event"
  curl -s -X POST "$base_url/event" \
    -H "content-type: application/json" \
    -H "x-api-key: $api_key" \
    -d "{\"id\":\"$id\",\"intentId\":\"$intent\",\"createdAt\":\"$now\",\"actor\":\"$actor\",\"app\":\"arc-stable-toolbox\",\"kind\":\"bridge\",\"status\":\"started\"}" \
    && echo ""

  echo "POST /event/status"
  curl -s -X POST "$base_url/event/status" \
    -H "content-type: application/json" \
    -H "x-api-key: $api_key" \
    -d "{\"actor\":\"$actor\",\"id\":\"$id\",\"status\":\"submitted\"}" \
    && echo ""

  echo "GET /events"
  curl -s "$base_url/events?actor=$actor&limit=20" \
    -H "x-api-key: $api_key" \
    && echo ""
}

full_setup() {
  stop_all
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
  echo "1) Full setup (2-10)"
  echo "2) Reset .linera"
  echo "3) Export LINERA_* (local .linera)"
  echo "4) Start linera net up (background)"
  echo "5) linera wallet init"
  echo "6) linera wallet request-chain"
  echo "7) Build wasm"
  echo "8) Publish app + write ids"
  echo "9) Start linera service (background)"
  echo "10) Start relayer (background)"
  echo "11) Run tests (unit + e2e + e2e:linera)"
  echo "12) Sanity curl checks"
  echo "13) Write ids manually"
  echo "14) Stop all services"
  echo "15) Force kill by ports (8080/8081/3000)"
  echo "q) Quit"
}

while true; do
  menu
  read -r -p "Select: " choice
  case "$choice" in
    1) full_setup ;;
    2) reset_linera_wallet ;;
    3) export_linera_env ;;
    4) start_net_up ;;
    5) wallet_init ;;
    6) wallet_request_chain ;;
    7) build_wasm ;;
    8) publish_and_write_ids ;;
    9) start_service ;;
    10) start_relayer ;;
    11) run_tests ;;
    12) sanity_curl ;;
    13) write_ids_prompt ;;
    14) stop_all ;;
    15) force_kill_ports ;;
    q|Q) exit 0 ;;
    *) echo "Unknown option" ;;
  esac
 done
