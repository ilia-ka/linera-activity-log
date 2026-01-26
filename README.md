# linera-activity-log

Realtime activity feed and audit log service for Arc Station.

## Scope

This service only stores and serves ActivityEvent entries. Linera is used only as a storage substrate for this feed and is not responsible for decisions, execution, funds, or business logic.

## Install Linera CLI

Prerequisites (Linux):

```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
curl -LO https://github.com/protocolbuffers/protobuf/releases/download/v21.11/protoc-21.11-linux-x86_64.zip
unzip protoc-21.11-linux-x86_64.zip -d $HOME/.local
export PATH="$HOME/.local/bin:$PATH"
```

Install Linera binaries:

```
cargo install --locked linera-storage-service@0.15.8
cargo install --locked linera-service@0.15.8
```

Add the SDK to your Rust app when needed:

```
cargo add linera-sdk@0.15.8
```

## Start a local Linera network

In one shell:

```
linera net up --with-faucet --faucet-port 8080
```

In another shell:

```
linera wallet init --faucet http://localhost:8080
linera wallet request-chain --faucet http://localhost:8080
```

## Deploy linera-app

Build the WASM artifacts:

```
cd linera-app
cargo build --release --target wasm32-unknown-unknown
```

Publish and create an app instance:

```
linera publish-and-create \
  target/wasm32-unknown-unknown/release/activity_log_{contract,service}.wasm \
  --json-argument "null"
```

## Run relayer locally

```
cd relayer
npm install
npm run dev
```

Environment variables:

```
LINERA_ENDPOINT=http://localhost:8080
LINERA_WALLET_PATH=./linera-wallet.json
LINERA_APP_ID=app-id
RELAYER_API_KEY=dev
PORT=3000
```

## Curl examples

Append event:

```
curl -X POST http://localhost:3000/event \
  -H "content-type: application/json" \
  -H "x-api-key: dev" \
  -d '{"id":"evt_1","intentId":"intent_1","createdAt":"2026-01-26T00:00:00Z","actor":"0x1111111111111111111111111111111111111111","kind":"bridge","status":"started"}'
```

Update status:

```
curl -X POST http://localhost:3000/event/status \
  -H "content-type: application/json" \
  -H "x-api-key: dev" \
  -d '{"actor":"0x1111111111111111111111111111111111111111","id":"evt_1","status":"submitted","tx":{"sourceTxHash":"0xabc"}}'
```

Get events:

```
curl "http://localhost:3000/events?actor=0x1111111111111111111111111111111111111111&limit=20"
```
