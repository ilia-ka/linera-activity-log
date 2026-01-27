import assert from "node:assert/strict"
import test from "node:test"
import { checkApiKey } from "../src/auth"

test("checkApiKey accepts matching header", () => {
  const result = checkApiKey({ "x-api-key": "dev" }, "dev")
  assert.equal(result.ok, true)
})

test("checkApiKey rejects missing header", () => {
  const result = checkApiKey({}, "dev")
  assert.equal(result.ok, false)
})

test("checkApiKey rejects wrong header", () => {
  const result = checkApiKey({ "x-api-key": "nope" }, "dev")
  assert.equal(result.ok, false)
})

test("checkApiKey accepts array header", () => {
  const result = checkApiKey({ "x-api-key": ["dev"] }, "dev")
  assert.equal(result.ok, true)
})
