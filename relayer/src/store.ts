import { ActivityEvent, ActivityStatus, ActivityTx } from "../../shared/types"

export type AppendResult = { ok: true } | { ok: false; error: string }
export type UpdateResult = { ok: true; event: ActivityEvent } | { ok: false; error: string }
export type GetResult = { items: ActivityEvent[]; nextCursor: string | null }

export type EventStore = {
  appendEvent: (event: ActivityEvent) => AppendResult
  updateEventStatus: (
    actor: string,
    id: string,
    status: ActivityStatus,
    tx?: ActivityTx
  ) => UpdateResult
  getEvents: (actor: string, limit: number, cursor?: string | null) => GetResult
  reset: () => void
}

export function createStore(retention: number): EventStore {
  const data = new Map<string, ActivityEvent[]>()

  function appendEvent(event: ActivityEvent): AppendResult {
    const list = data.get(event.actor) ?? []
    if (list.some((item) => item.id === event.id)) {
      return { ok: false, error: "event_exists" }
    }
    list.push(event)
    while (list.length > retention) {
      list.shift()
    }
    data.set(event.actor, list)
    return { ok: true }
  }

  function updateEventStatus(
    actor: string,
    id: string,
    status: ActivityStatus,
    tx?: ActivityTx
  ): UpdateResult {
    const list = data.get(actor)
    if (!list) {
      return { ok: false, error: "not_found" }
    }
    const item = list.find((event) => event.id === id)
    if (!item) {
      return { ok: false, error: "not_found" }
    }
    item.status = status
    if (tx) {
      item.tx = { ...(item.tx ?? {}), ...tx }
    }
    return { ok: true, event: item }
  }

  function getEvents(actor: string, limit: number, cursor?: string | null): GetResult {
    const list = data.get(actor) ?? []
    const offset = cursor ? Number.parseInt(cursor, 10) : 0
    const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 20
    const items = list.slice(safeOffset, safeOffset + safeLimit)
    const nextOffset = safeOffset + items.length
    const nextCursor = nextOffset < list.length ? String(nextOffset) : null
    return { items, nextCursor }
  }

  function reset(): void {
    data.clear()
  }

  return { appendEvent, updateEventStatus, getEvents, reset }
}

export const store = createStore(300)
