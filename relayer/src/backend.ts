import { ActivityEvent, ActivityStatus, ActivityTx } from "../../shared/types"
import { config } from "./config"
import { createLineraClient, LineraClient, resolveAppEndpoint } from "./linera"
import { AppendResult, createStore, EventStore, GetResult, UpdateResult } from "./store"

export type Backend = {
  appendEvent: (event: ActivityEvent) => Promise<AppendResult>
  updateEventStatus: (
    actor: string,
    id: string,
    status: ActivityStatus,
    tx?: ActivityTx
  ) => Promise<UpdateResult>
  getEvents: (actor: string, limit: number, cursor?: string | null) => Promise<GetResult>
}

export function createBackend(options?: {
  store?: EventStore
  linera?: LineraClient | null
  lineraEnabled?: boolean
}): Backend {
  const store = options?.store ?? createStore(300)
  const lineraEnabled = options?.lineraEnabled ?? Boolean(resolveAppEndpoint(config))
  const linera = options?.linera ?? (lineraEnabled ? createLineraClient(config) : null)

  async function appendEvent(event: ActivityEvent): Promise<AppendResult> {
    const local = store.appendEvent(event)
    if (!local.ok) {
      return local
    }
    if (linera) {
      const remote = await linera.appendEvent(event)
      if (!remote.ok) {
        console.error("linera_append_failed", "error" in remote ? remote.error : "unknown")
      }
    }
    return local
  }

  async function updateEventStatus(
    actor: string,
    id: string,
    status: ActivityStatus,
    tx?: ActivityTx
  ): Promise<UpdateResult> {
    const local = store.updateEventStatus(actor, id, status, tx)
    if (!local.ok) {
      return local
    }
    if (linera) {
      const remote = await linera.updateEventStatus(actor, id, status, tx)
      if (!remote.ok) {
        console.error("linera_update_failed", "error" in remote ? remote.error : "unknown")
      }
    }
    return local
  }

  async function getEvents(
    actor: string,
    limit: number,
    cursor?: string | null
  ): Promise<GetResult> {
    if (linera) {
      const remote = await linera.getEvents(actor, limit, cursor)
      if (remote.ok) {
        return { items: remote.items, nextCursor: remote.nextCursor }
      }
      console.error("linera_get_failed", "error" in remote ? remote.error : "unknown")
    }
    return store.getEvents(actor, limit, cursor)
  }

  return { appendEvent, updateEventStatus, getEvents }
}

export const backend = createBackend()
