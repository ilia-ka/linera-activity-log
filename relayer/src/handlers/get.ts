import type { IncomingMessage, ServerResponse } from "http"

export async function handleGet(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/events", "http://localhost")
  const actor = url.searchParams.get("actor")
  const limit = url.searchParams.get("limit")
  const cursor = url.searchParams.get("cursor")
  res.statusCode = 200
  res.setHeader("content-type", "application/json")
  res.end(JSON.stringify({ ok: true, route: "events", actor, limit, cursor, items: [] }))
}
