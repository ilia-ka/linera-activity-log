import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

const baseUrl = process.env.RELAYER_URL ?? "http://localhost:3000"
const apiKey = process.env.RELAYER_API_KEY ?? ""
const enabled = process.env.RELAYER_E2E === "1" && apiKey.length > 0
const lineraEndpoint = process.env.LINERA_ENDPOINT
const lineraIdsPath = process.env.LINERA_IDS_PATH
const lineraIds = readLineraIds(lineraIdsPath)
const lineraChainId = process.env.LINERA_CHAIN_ID ?? lineraIds.chainId
const lineraAppId = process.env.LINERA_APP_ID ?? lineraIds.appId
const lineraEnabled =
  process.env.RELAYER_E2E_LINERA === "1" &&
  Boolean(lineraEndpoint && lineraChainId && lineraAppId)
const lineraAppEndpoint = lineraEndpoint
  ? `${lineraEndpoint.replace(/\/$/, "")}/chains/${lineraChainId}/applications/${lineraAppId}`
  : ""

function readLineraIds(idsPath?: string) {
  if (!idsPath) {
    return {}
  }
  const candidates = path.isAbsolute(idsPath)
    ? [idsPath]
    : [
        path.resolve(process.cwd(), idsPath),
        path.resolve(process.cwd(), "..", idsPath)
      ]
  const resolved = candidates.find((candidate) => fs.existsSync(candidate))
  if (!resolved) {
    return {}
  }
  try {
    const raw = fs.readFileSync(resolved, "utf8").trim()
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const chainId = typeof parsed.chainId === "string" ? parsed.chainId : undefined
    const appId = typeof parsed.appId === "string" ? parsed.appId : undefined
    return { chainId, appId }
  } catch {
    return {}
  }
}

function makeEvent() {
  return {
    id: randomUUID(),
    intentId: randomUUID(),
    createdAt: new Date().toISOString(),
    actor: "0x1111111111111111111111111111111111111111",
    app: "arc-stable-toolbox",
    kind: "bridge",
    status: "started"
  }
}

async function postJson(path: string, payload: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey
    },
    body: JSON.stringify(payload)
  })
  const json = await res.json()
  return { status: res.status, json }
}

async function getJson(path: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      "x-api-key": apiKey
    }
  })
  const json = await res.json()
  return { status: res.status, json }
}

async function queryLineraEvents(actor: string) {
  if (!lineraAppEndpoint) {
    return { ok: false, items: [] as any[] }
  }
  const res = await fetch(lineraAppEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: "query($actor:String!){ events(actor:$actor) }",
      variables: { actor }
    })
  })
  const json = await res.json().catch(() => null)
  const payload = json?.data?.events
  if (typeof payload !== "string") {
    return { ok: false, items: [] as any[] }
  }
  try {
    const parsed = JSON.parse(payload) as { items?: any[] }
    return { ok: true, items: Array.isArray(parsed.items) ? parsed.items : [] }
  } catch {
    return { ok: false, items: [] as any[] }
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

test("relayer e2e flow", { skip: !enabled }, async () => {
  const event = makeEvent()
  const append = await postJson("/event", event)
  assert.equal(append.status, 200)
  assert.equal(append.json.ok, true)

  const status = await postJson("/event/status", {
    actor: event.actor,
    id: event.id,
    status: "submitted"
  })
  assert.equal(status.status, 200)
  assert.equal(status.json.ok, true)

  const list = await getJson(`/events?actor=${event.actor}&limit=20`)
  assert.equal(list.status, 200)
  assert.equal(list.json.ok, true)
  assert.ok(Array.isArray(list.json.items))
  const found = list.json.items.find((item: { id: string }) => item.id === event.id)
  assert.ok(found)
  assert.equal(found.status, "submitted")
})

test("relayer writes to linera", { skip: !lineraEnabled }, async () => {
  const event = makeEvent()
  const append = await postJson("/event", event)
  assert.equal(append.status, 200)
  assert.equal(append.json.ok, true)

  const status = await postJson("/event/status", {
    actor: event.actor,
    id: event.id,
    status: "submitted"
  })
  assert.equal(status.status, 200)
  assert.equal(status.json.ok, true)

  let found = false
  for (let i = 0; i < 20; i += 1) {
    const result = await queryLineraEvents(event.actor)
    if (result.ok) {
      const item = result.items.find((value) => value?.id === event.id)
      if (item && item.status === "submitted") {
        found = true
        break
      }
    }
    await delay(300)
  }
  assert.equal(found, true)
})
