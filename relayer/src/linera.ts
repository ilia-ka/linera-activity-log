import { ActivityEvent, ActivityStatus, ActivityTx } from "../../shared/types"
import { Config } from "./config"

export type LineraResult = { ok: true } | { ok: false; error: string }
export type LineraUpdateResult =
  | { ok: true; event: ActivityEvent }
  | { ok: false; error: string }
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

export function createLineraClient(_config: Config): LineraClient {
  return {
    async appendEvent() {
      return { ok: false, error: "linera_not_implemented" }
    },
    async updateEventStatus() {
      return { ok: false, error: "linera_not_implemented" }
    },
    async getEvents() {
      return { ok: false, error: "linera_not_implemented" }
    }
  }
}
