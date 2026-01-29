# linera-activity-log

Realtime activity feed and audit log service for Arc Station.  
The only goal is to store and serve ActivityEvent entries. Linera is used strictly as storage, not as business logic, execution, or decision layer.

## Quickstart

Run the menu script:

```
./scripts/quickstart.sh
```

Menu options:

1) Full setup (2-10)  
2) Reset .linera  
3) Export LINERA_* (local .linera)  
4) Start linera net up (background)  
5) linera wallet init  
6) linera wallet request-chain  
7) Build wasm  
8) Publish app + write ids  
9) Start linera service (background)  
10) Start relayer (background)  
11) Run tests (unit + e2e + e2e:linera)  
12) Sanity curl checks  
13) Write ids manually  
14) Stop all services  
15) Force kill by ports (8080/8081/3000)  
q) Quit

Logs and PID files for background processes are stored in `.run/`.

## Installation and setup (detailed, in menu order)

### 1) Full setup (2-10)

Runs the full sequence: reset, export, net up, wallet init, request-chain, build, publish, start service, start relayer.

### 2) Reset .linera

Required after restarting `linera net up`, otherwise old wallet/chain metadata will not match the new network.

```
rm -rf .linera
mkdir -p .linera
```

### 3) Export LINERA_* (local .linera)

```
export LINERA_WALLET=./.linera/wallet.json
export LINERA_KEYSTORE=./.linera/keystore.json
export LINERA_STORAGE=rocksdb:./.linera/wallet.db
```

You can skip these exports and use the default Linera directory `~/.config/linera`, but a project-local `.linera` is easier to reset and keeps state isolated per repo.

### 4) Start linera net up

```
linera net up --with-faucet --faucet-port 8080
```

Keep this running while you work.

### 5) linera wallet init

```
linera wallet init --faucet http://localhost:8080
```

### 6) linera wallet request-chain

```
linera wallet request-chain --faucet http://localhost:8080
```

### 7) Build wasm

```
cd linera-app
cargo +1.86.0 build --release --target wasm32-unknown-unknown
```

### 8) Publish app + write ids

Auto publish and write `chainId/appId`:

```
../scripts/linera-publish.sh
```

IDs file: `.linera/ids.json`

```
{"chainId":"...","appId":"..."}
```

### 9) Start linera service

```
linera service --port 8081
```

If you see `Blobs not found`, your wallet/chain metadata does not match the running validators. Run steps 1–5 again.

### 10) Start relayer

```
cd relayer
npm install
npm run dev
```

### 11) Run tests (unit + e2e + e2e:linera)

```
cd relayer
npm test
npm run test:e2e
npm run test:e2e:linera
```

If tests print `linera_append_failed`/`linera_get_failed`, that is expected for cases where Linera is intentionally unavailable.

### 12) Sanity curl checks

```
./scripts/quickstart.sh
```

Choose option `12` to run three curl checks against the relayer.

### 13) Write ids manually

```
printf "{\"chainId\":\"%s\",\"appId\":\"%s\"}\n" "<chain-id>" "<app-id>" > ./.linera/ids.json
```

### 14) Stop all services

Stops background processes started by the script (`net up`, `linera service`, `relayer`).

### 15) Force kill by ports (8080/8081/3000)

Force‑kills any process holding these ports.

## Install Linera CLI

Prerequisites (Linux):

```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup toolchain install 1.86.0
rustup target add wasm32-unknown-unknown
curl -LO https://github.com/protocolbuffers/protobuf/releases/download/v21.11/protoc-21.11-linux-x86_64.zip
unzip protoc-21.11-linux-x86_64.zip -d $HOME/.local
export PATH="$HOME/.local/bin:$PATH"
```

Install Linera binaries:

```
RUSTUP_TOOLCHAIN=1.86.0 cargo install --locked linera-storage-service@0.15.8
RUSTUP_TOOLCHAIN=1.86.0 cargo install --locked linera-service@0.15.8
```

Add the SDK to your Rust app when needed:

```
cargo add linera-sdk@0.15.8
```

## Config and environment

`.env`:

```
LINERA_ENDPOINT=http://localhost:8081
LINERA_IDS_PATH=./.linera/ids.json
LINERA_APP_ENDPOINT=
LINERA_WALLET_PATH=./linera-wallet.json
RELAYER_API_KEY=dev
PORT=3000
```

Relayer writes to Linera if `LINERA_APP_ENDPOINT` is set or if the IDs file contains both `chainId` and `appId`. Otherwise it uses the in‑memory store.

## Tests (detailed)

### Unit

```
cd relayer
npm test
```

### E2E (relayer only)

```
cd relayer
npm run test:e2e
```

Requires: running relayer, `RELAYER_E2E=1`, `RELAYER_API_KEY`.

### E2E + Linera

```
cd relayer
npm run test:e2e:linera
```

Requires: `RELAYER_E2E_LINERA=1`, `LINERA_ENDPOINT`, and a valid `LINERA_IDS_PATH`.

## Curl examples

Append event:

```
curl -X POST http://localhost:3000/event \
  -H "content-type: application/json" \
  -H "x-api-key: dev" \
  -d '{"id":"11111111-1111-4111-8111-111111111111","intentId":"22222222-2222-4222-8222-222222222222","createdAt":"2026-01-28T10:20:00Z","actor":"0x1111111111111111111111111111111111111111","app":"arc-stable-toolbox","kind":"bridge","status":"started"}'
```

Update status:

```
curl -X POST http://localhost:3000/event/status \
  -H "content-type: application/json" \
  -H "x-api-key: dev" \
  -d '{"actor":"0x1111111111111111111111111111111111111111","id":"11111111-1111-4111-8111-111111111111","status":"submitted","tx":{"sourceTxHash":"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}'
```

Get events:

```
curl "http://localhost:3000/events?actor=0x1111111111111111111111111111111111111111&limit=20" \
  -H "x-api-key: dev"
```
