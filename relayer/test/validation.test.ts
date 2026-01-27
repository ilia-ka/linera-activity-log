import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { validateEventPayload, validateStatusPayload } from "../src/validation"

test("validateEventPayload accepts minimal valid event", () => {
  const event = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    actor: "0x1111111111111111111111111111111111111111",
    app: "arc-stable-toolbox",
    intentId: randomUUID(),
    kind: "bridge",
    status: "started"
  }
  const result = validateEventPayload(event)
  assert.equal(result.ok, true)
})

test("validateEventPayload rejects extra fields", () => {
  const event = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    actor: "0x1111111111111111111111111111111111111111",
    app: "arc-stable-toolbox",
    intentId: randomUUID(),
    kind: "bridge",
    status: "started",
    extra: "nope"
  }
  const result = validateEventPayload(event)
  assert.equal(result.ok, false)
})

test("validateStatusPayload accepts minimal valid payload", () => {
  const payload = {
    actor: "0x1111111111111111111111111111111111111111",
    id: randomUUID(),
    status: "submitted"
  }
  const result = validateStatusPayload(payload)
  assert.equal(result.ok, true)
})

test("validateStatusPayload rejects extra fields", () => {
  const payload = {
    actor: "0x1111111111111111111111111111111111111111",
    id: randomUUID(),
    status: "submitted",
    extra: true
  }
  const result = validateStatusPayload(payload)
  assert.equal(result.ok, false)
})
