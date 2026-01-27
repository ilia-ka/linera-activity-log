import type { IncomingMessage, ServerResponse } from "http"
import { validateEventPayload } from "../validation"

export async function handleEvent(req: IncomingMessage, res: ServerResponse): Promise<void> {
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

  const result = validateEventPayload(payload)
  if (!result.ok) {
    res.statusCode = 400
    res.setHeader("content-type", "application/json")
    res.end(JSON.stringify({ ok: false, error: "validation_failed", errors: result.errors }))
    return
  }

  res.statusCode = 200
  res.setHeader("content-type", "application/json")
  res.end(JSON.stringify({ ok: true, route: "event", receivedBytes: body.length }))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = ""
    req.on("data", (chunk) => (data += chunk))
    req.on("end", () => resolve(data))
  })
}
