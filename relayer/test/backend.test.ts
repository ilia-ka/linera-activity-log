import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { createBackend } from "../src/backend"
import { createStore } from "../src/store"
import { ActivityEvent } from "../../shared/types"

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

test("backend uses memory when linera disabled", async () => {
  const store = createStore(10)
  const backend = createBackend({ store, lineraEnabled: false })
  const event = makeEvent(randomUUID())
  const appended = await backend.appendEvent(event)
  assert.equal(appended.ok, true)
  const result = await backend.getEvents(event.actor, 10, null)
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].id, event.id)
})

test("backend falls back to memory when linera fails", async () => {
  const store = createStore(10)
  const backend = createBackend({
    store,
    lineraEnabled: true,
    linera: {
      async appendEvent() {
        return { ok: false, error: "fail" }
      },
      async updateEventStatus() {
        return { ok: false, error: "fail" }
      },
      async getEvents() {
        return { ok: false, error: "fail" }
      }
    }
  })
  const event = makeEvent(randomUUID())
  const appended = await backend.appendEvent(event)
  assert.equal(appended.ok, true)
  const result = await backend.getEvents(event.actor, 10, null)
  assert.equal(result.items.length, 1)
})
