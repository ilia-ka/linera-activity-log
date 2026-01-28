# linera-activity-log

Realtime activity feed and audit log service for Arc Station.

## Scope

This service only stores and serves ActivityEvent entries. Linera is used only as a storage substrate for this feed and is not responsible for decisions, execution, funds, or business logic.

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

## Start a local Linera network

Step 1. Start the local network (keep this running):

```
linera net up --with-faucet --faucet-port 8080
```

Step 2. In a new shell, set local wallet storage and create a chain:

```
export LINERA_WALLET=./.linera/wallet.json
export LINERA_KEYSTORE=./.linera/keystore.json
export LINERA_STORAGE=rocksdb:./.linera/wallet.db

linera wallet init --faucet http://localhost:8080
linera wallet request-chain --faucet http://localhost:8080
```

Keep `linera net up` running while you use the network. If you restart it, you must recreate the wallet and chain metadata.

Why this matters: the local test network uses temporary validator state. If you restart `linera net up`, any old wallet/keystore/chain metadata becomes incompatible with the new network. That mismatch shows up as `Keystore already exists` (old keys) or `Blobs not found` (chain ID not present in the new validators).

You can also skip the `LINERA_WALLET`, `LINERA_KEYSTORE`, and `LINERA_STORAGE` exports and let Linera use its default directory `~/.config/linera`. We used a project-local `.linera` directory so resets are explicit and the state is isolated per project.

Fix by resetting the local wallet directory and recreating the wallet/chain:

```
rm -rf .linera
mkdir -p .linera
export LINERA_WALLET=./.linera/wallet.json
export LINERA_KEYSTORE=./.linera/keystore.json
export LINERA_STORAGE=rocksdb:./.linera/wallet.db
linera wallet init --faucet http://localhost:8080
linera wallet request-chain --faucet http://localhost:8080
```

Common warnings that are safe to ignore:

- `Waiting for faucet to start` appears during startup; it resolves once the faucet is ready.
- `OTLP export requires the 'opentelemetry' feature to be enabled` only affects optional telemetry.

## Per-project environment with direnv

If you work with multiple Linera projects, use `direnv` so each repo has its own wallet paths.

1. Install and hook direnv (one-time):
   - `sudo apt install direnv`
   - add `eval "$(direnv hook bash)"` to your `~/.bashrc`, then restart your shell
2. In this repo:
   - `cp .envrc.example .envrc`
   - `direnv allow`

This loads the project-local `.linera` paths automatically when you enter the repo.

Quick setup script (does the steps above for bash/zsh):

```
./scripts/enable-direnv.sh
```

## One menu-driven script

Interactive helper that runs steps in the right order and can start background services:

```
./scripts/quickstart.sh
```

Logs and PIDs for background processes are stored in `.run/`.
Use the "Reset .linera" step after restarting `linera net up`.

## Deploy linera-app

Build the WASM artifacts:

```
cd linera-app
cargo +1.86.0 build --release --target wasm32-unknown-unknown
```

Publish and create an app instance (auto-writes `chainId` and `appId`):

```
../scripts/linera-publish.sh
```

Manual publish (if you want full control):

```
linera publish-and-create \
  target/wasm32-unknown-unknown/release/activity_log_contract.wasm \
  target/wasm32-unknown-unknown/release/activity_log_service.wasm \
  --json-argument "null"
```

Save the printed `app-id` and the default `chain-id` from `linera wallet show`.

Store them in the local IDs file used by the relayer:

```
printf "{\"chainId\":\"%s\",\"appId\":\"%s\"}\n" "<chain-id>" "<app-id>" > ../.linera/ids.json
```

If you see `Filesystem error: No such file or directory (os error 2)` here, it means this shell does not have the `LINERA_WALLET`, `LINERA_KEYSTORE`, and `LINERA_STORAGE` variables set, or the `.linera` directory does not exist. Re-export the variables (from Step 2) and ensure `.linera` exists, then retry.

## Run Linera node service

This exposes the GraphQL endpoint used by the relayer.

```
export LINERA_WALLET=./.linera/wallet.json
export LINERA_KEYSTORE=./.linera/keystore.json
export LINERA_STORAGE=rocksdb:./.linera/wallet.db

linera service --port 8081
```

If `linera service` shows `Blobs not found` for a chain description, your wallet/chain metadata does not match the currently running validators. Reset `.linera` and re-run Step 2.

## Run relayer locally

```
cd relayer
npm install
npm run dev
```

Environment variables:

```
LINERA_ENDPOINT=http://localhost:8081
LINERA_IDS_PATH=./.linera/ids.json
LINERA_APP_ENDPOINT=
LINERA_WALLET_PATH=./linera-wallet.json
RELAYER_API_KEY=dev
PORT=3000
```

The IDs file format is JSON:

```
{"chainId":"...","appId":"..."}
```

Relayer writes to Linera only when `LINERA_APP_ENDPOINT` is set or when the IDs file contains both `chainId` and `appId`. You can override the file by setting `LINERA_CHAIN_ID` and `LINERA_APP_ID` directly. Otherwise it uses in-memory storage.

## Tests

Unit tests:

```
cd relayer
npm test
```

During tests you may see `linera_append_failed` and `linera_get_failed` log lines. These are expected in tests that simulate Linera being unavailable. The test suite should still pass.

E2E test against a running relayer:

```
cd relayer
npm run test:e2e
```

`RELAYER_E2E=1` enables the e2e test; otherwise it is skipped.

E2E test that also checks Linera directly:

```
cd relayer
npm run test:e2e:linera
```

`RELAYER_E2E_LINERA=1` requires `LINERA_ENDPOINT` plus either `LINERA_IDS_PATH` or explicit `LINERA_CHAIN_ID` and `LINERA_APP_ID`.

## Full restart checklist

Use this order after restarting your environment.

1. Start validators and faucet (keep running):
   - `linera net up --with-faucet --faucet-port 8080`
2. Create/reset local wallet (if network was restarted):
   - `rm -rf .linera`
   - `mkdir -p .linera`
   - `export LINERA_WALLET=./.linera/wallet.json`
   - `export LINERA_KEYSTORE=./.linera/keystore.json`
   - `export LINERA_STORAGE=rocksdb:./.linera/wallet.db`
   - `linera wallet init --faucet http://localhost:8080`
   - `linera wallet request-chain --faucet http://localhost:8080`
3. Build and publish the app:
   - `cd linera-app`
   - `cargo +1.86.0 build --release --target wasm32-unknown-unknown`
   - `../scripts/linera-publish.sh`
4. Start the Linera service:
   - `export LINERA_WALLET=./.linera/wallet.json`
   - `export LINERA_KEYSTORE=./.linera/keystore.json`
   - `export LINERA_STORAGE=rocksdb:./.linera/wallet.db`
   - `linera service --port 8081`
5. Update `.linera/ids.json` with the new `chainId` and `appId`.
6. Start relayer:
   - `cd relayer`
   - `npm install`
   - `npm run dev`
7. Run tests in order:
   - `cd relayer`
   - `npm test`
   - `npm run test:e2e`
   - `npm run test:e2e:linera`

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
