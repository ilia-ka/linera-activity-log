import { ActivityEvent, ActivityStatus, ActivityTx } from "../../shared/types"
import { Config } from "./config"

export type LineraResult = { ok: true } | { ok: false; error: string }
export type LineraUpdateResult = LineraResult
export type LineraGetResult =
  | { ok: true; items: ActivityEvent[]; nextCursor: string | null }
  | { ok: false; error: string }

export type LineraClient = {
  appendEvent: (event: ActivityEvent) => Promise<LineraResult>
  updateEventStatus: (
    actor: string,
    id: string,
    status: ActivityStatus,
    tx?: ActivityTx
  ) => Promise<LineraUpdateResult>
  getEvents: (
    actor: string,
    limit: number,
    cursor?: string | null
  ) => Promise<LineraGetResult>
}

type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string }
) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>

export function resolveAppEndpoint(config: Config): string | null {
  if (config.lineraAppEndpoint) {
    return config.lineraAppEndpoint.replace(/\/$/, "")
  }
  if (!config.lineraEndpoint || !config.lineraChainId || !config.lineraAppId) {
    return null
  }
  const base = config.lineraEndpoint.replace(/\/$/, "")
  return `${base}/chains/${config.lineraChainId}/applications/${config.lineraAppId}`
}

export function createLineraClient(config: Config, fetchImpl: FetchLike = fetch): LineraClient {
  const endpoint = resolveAppEndpoint(config)

  if (!endpoint) {
    return {
      async appendEvent() {
        return { ok: false, error: "linera_not_configured" }
      },
      async updateEventStatus() {
        return { ok: false, error: "linera_not_configured" }
      },
      async getEvents() {
        return { ok: false, error: "linera_not_configured" }
      }
    }
  }

  async function postGraphql(query: string, variables: Record<string, unknown>) {
    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables })
    })
    if (!res.ok) {
      return { ok: false as const, error: `http_${res.status}` }
    }
    const json = await res.json()
    if (json.errors && json.errors.length > 0) {
      return { ok: false as const, error: "graphql_error" }
    }
    return { ok: true as const, data: json.data as Record<string, unknown> }
  }

  return {
    async appendEvent(event: ActivityEvent) {
      const result = await postGraphql(
        "mutation AppendEvent($actor: String!, $eventJson: String!) { appendEvent(actor: $actor, eventJson: $eventJson) }",
        { actor: event.actor, eventJson: JSON.stringify(event) }
      )
      if (!result.ok) {
        return { ok: false, error: result.error }
      }
      const ok = result.data["appendEvent"] === true
      return ok ? { ok: true } : { ok: false, error: "append_failed" }
    },
    async updateEventStatus(
      actor: string,
      id: string,
      status: ActivityStatus,
      tx?: ActivityTx
    ) {
      const result = await postGraphql(
        "mutation UpdateEventStatus($actor: String!, $id: String!, $status: String!, $txJson: String) { updateEventStatus(actor: $actor, id: $id, status: $status, txJson: $txJson) }",
        {
          actor,
          id,
          status,
          txJson: tx ? JSON.stringify(tx) : null
        }
      )
      if (!result.ok) {
        return { ok: false, error: result.error }
      }
      const ok = result.data["updateEventStatus"] === true
      return ok ? { ok: true } : { ok: false, error: "update_failed" }
    },
    async getEvents(actor: string, limit: number, cursor?: string | null) {
      const result = await postGraphql(
        "query GetEvents($actor: String!, $limit: Int, $cursor: Int) { events(actor: $actor, limit: $limit, cursor: $cursor) }",
        { actor, limit, cursor: cursor ? Number.parseInt(cursor, 10) : null }
      )
      if (!result.ok) {
        return { ok: false, error: result.error }
      }
      const payload = result.data["events"]
      if (typeof payload !== "string") {
        return { ok: false, error: "invalid_response" }
      }
      try {
        const parsed = JSON.parse(payload) as {
          items?: ActivityEvent[]
          nextCursor?: string | number | null
        }
        const rawCursor = parsed.nextCursor
        const nextCursor =
          typeof rawCursor === "number"
            ? String(rawCursor)
            : typeof rawCursor === "string"
            ? rawCursor
            : null
        return {
          ok: true,
          items: parsed.items ?? [],
          nextCursor
        }
      } catch {
        return { ok: false, error: "invalid_json" }
      }
    }
  }
}
