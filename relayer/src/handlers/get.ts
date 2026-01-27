import type { IncomingMessage, ServerResponse } from "http"
import { checkApiKey } from "../auth"

export async function handleGet(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const auth = checkApiKey(req.headers)
  if (!auth.ok) {
    res.statusCode = auth.status
    res.setHeader("content-type", "application/json")
    res.end(JSON.stringify({ ok: false, error: auth.error }))
    return
  }

  const url = new URL(req.url ?? "/events", "http://localhost")
  const actor = url.searchParams.get("actor")
  const limit = url.searchParams.get("limit")
  const cursor = url.searchParams.get("cursor")
  res.statusCode = 200
  res.setHeader("content-type", "application/json")
  res.end(JSON.stringify({ ok: true, route: "events", actor, limit, cursor, items: [] }))
}
