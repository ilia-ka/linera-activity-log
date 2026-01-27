import type { IncomingHttpHeaders } from "http"
import { config } from "./config"

export type AuthResult = { ok: true } | { ok: false; status: number; error: string }

export function checkApiKey(
  headers: IncomingHttpHeaders,
  expected: string | undefined = config.relayerApiKey
): AuthResult {
  if (!expected) {
    return { ok: false, status: 500, error: "api_key_not_configured" }
  }

  const raw = headers["x-api-key"]
  const value = Array.isArray(raw) ? raw[0] : raw

  if (!value || value !== expected) {
    return { ok: false, status: 401, error: "unauthorized" }
  }

  return { ok: true }
}
