import type { IncomingMessage, ServerResponse } from "http"
import { checkApiKey } from "../auth"
import { store } from "../store"

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
  if (!actor) {
    res.statusCode = 400
    res.setHeader("content-type", "application/json")
    res.end(JSON.stringify({ ok: false, error: "actor_required" }))
    return
  }

  if (!/^0x[a-f0-9]{40}$/.test(actor)) {
    res.statusCode = 400
    res.setHeader("content-type", "application/json")
    res.end(JSON.stringify({ ok: false, error: "actor" }))
    return
  }

  const limitValue = url.searchParams.get("limit")
  const cursor = url.searchParams.get("cursor")
  const parsedLimit = limitValue ? Number.parseInt(limitValue, 10) : 20
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 20
  const result = store.getEvents(actor, limit, cursor)

  res.statusCode = 200
  res.setHeader("content-type", "application/json")
  res.end(
    JSON.stringify({
      ok: true,
      route: "events",
      actor,
      limit,
      cursor,
      nextCursor: result.nextCursor,
      items: result.items
    })
  )
}
