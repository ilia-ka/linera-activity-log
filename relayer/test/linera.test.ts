import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { createLineraClient, resolveAppEndpoint } from "../src/linera"
import { ActivityEvent } from "../../shared/types"

const baseConfig = {
  lineraEndpoint: "http://localhost:8080",
  lineraChainId: "chain-id",
  lineraAppEndpoint: undefined,
  lineraWalletPath: "./linera-wallet.json",
  lineraAppId: "app-id",
  relayerApiKey: "dev",
  port: 3000
}

function makeEvent(id: string): ActivityEvent {
  return {
    id,
    createdAt: new Date().toISOString(),
    actor: "0x1111111111111111111111111111111111111111",
    app: "arc-stable-toolbox",
    intentId: randomUUID(),
    kind: "bridge",
    status: "started"
  }
}

test("resolveAppEndpoint builds chain/app endpoint", () => {
  const endpoint = resolveAppEndpoint(baseConfig)
  assert.equal(
    endpoint,
    "http://localhost:8080/chains/chain-id/applications/app-id"
  )
})

test("linera client parses events response", async () => {
  const event = makeEvent(randomUUID())
  const fetchMock = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      data: { events: JSON.stringify({ items: [event], nextCursor: null }) }
    })
  })

  const client = createLineraClient(baseConfig, fetchMock as any)
  const result = await client.getEvents(event.actor, 10, null)
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.items.length, 1)
    assert.equal(result.items[0].id, event.id)
  }
})
