import type { IncomingMessage, ServerResponse } from "http"
import { checkApiKey } from "../auth"
import { validateStatusPayload } from "../validation"
import { ActivityStatus, ActivityTx } from "../../../shared/types"
import { backend } from "../backend"

export async function handleStatus(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const auth = checkApiKey(req.headers)
  if (!auth.ok) {
    res.statusCode = auth.status
    res.setHeader("content-type", "application/json")
    res.end(JSON.stringify({ ok: false, error: auth.error }))
    return
  }

  const body = await readBody(req)
  let payload: unknown
  try {
    payload = JSON.parse(body)
  } catch {
    res.statusCode = 400
    res.setHeader("content-type", "application/json")
    res.end(JSON.stringify({ ok: false, error: "invalid_json" }))
    return
  }

  const result = validateStatusPayload(payload)
  if (!result.ok) {
    res.statusCode = 400
    res.setHeader("content-type", "application/json")
    res.end(JSON.stringify({ ok: false, error: "validation_failed", errors: result.errors }))
    return
  }

  const actor = payload["actor"] as string
  const id = payload["id"] as string
  const status = payload["status"] as ActivityStatus
  const tx = payload["tx"] as ActivityTx | undefined
  const updated = await backend.updateEventStatus(actor, id, status, tx)
  if (!updated.ok) {
    res.statusCode = 404
    res.setHeader("content-type", "application/json")
    res.end(JSON.stringify({ ok: false, error: updated.error }))
    return
  }

  res.statusCode = 200
  res.setHeader("content-type", "application/json")
  res.end(JSON.stringify({ ok: true, route: "status", receivedBytes: body.length }))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = ""
    req.on("data", (chunk) => (data += chunk))
    req.on("end", () => resolve(data))
  })
}
