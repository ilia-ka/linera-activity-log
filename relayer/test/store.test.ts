import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
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

test("appendEvent stores and prevents duplicates", () => {
  const store = createStore(10)
  const event = makeEvent(randomUUID())
  const first = store.appendEvent(event)
  const second = store.appendEvent(event)
  assert.equal(first.ok, true)
  assert.equal(second.ok, false)
})

test("appendEvent respects retention", () => {
  const store = createStore(2)
  const first = makeEvent(randomUUID())
  const second = makeEvent(randomUUID())
  const third = makeEvent(randomUUID())
  store.appendEvent(first)
  store.appendEvent(second)
  store.appendEvent(third)
  const { items } = store.getEvents(first.actor, 10, null)
  assert.equal(items.length, 2)
  assert.equal(items[0].id, second.id)
  assert.equal(items[1].id, third.id)
})

test("updateEventStatus updates status and tx", () => {
  const store = createStore(10)
  const event = makeEvent(randomUUID())
  store.appendEvent(event)
  const result = store.updateEventStatus(event.actor, event.id, "submitted", {
    sourceTxHash: "0x".padEnd(66, "a")
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.event.status, "submitted")
    assert.equal(result.event.tx?.sourceTxHash, "0x".padEnd(66, "a"))
  }
})

test("getEvents paginates with cursor", () => {
  const store = createStore(10)
  const a = makeEvent(randomUUID())
  const b = makeEvent(randomUUID())
  const c = makeEvent(randomUUID())
  store.appendEvent(a)
  store.appendEvent(b)
  store.appendEvent(c)
  const first = store.getEvents(a.actor, 2, null)
  assert.equal(first.items.length, 2)
  const second = store.getEvents(a.actor, 2, first.nextCursor)
  assert.equal(second.items.length, 1)
  assert.equal(second.items[0].id, c.id)
})
