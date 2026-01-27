import { ValidationResult, validateActivityEvent } from "../../shared/validate"

const statusSet = new Set([
  "started",
  "approved",
  "submitted",
  "attested",
  "completed",
  "failed"
])

const rootKeys = new Set(["actor", "id", "status", "tx"])
const txKeys = new Set(["sourceTxHash", "destTxHash"])

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const addressRe = /^0x[a-f0-9]{40}$/
const txHashRe = /^0x[a-fA-F0-9]{64}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

function hasOnlyKeys(
  obj: Record<string, unknown>,
  allowed: Set<string>,
  path: string,
  errors: string[]
): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      errors.push(`extra:${path}.${key}`)
    }
  }
}

export function validateEventPayload(input: unknown): ValidationResult {
  return validateActivityEvent(input)
}

export function validateStatusPayload(input: unknown): ValidationResult {
  if (!isRecord(input)) {
    return { ok: false, errors: ["not_object"] }
  }

  const errors: string[] = []
  hasOnlyKeys(input, rootKeys, "root", errors)

  const actor = input["actor"]
  if (!isNonEmptyString(actor) || !addressRe.test(actor)) {
    errors.push("actor")
  }

  const id = input["id"]
  if (!isNonEmptyString(id) || !uuidRe.test(id)) {
    errors.push("id")
  }

  const status = input["status"]
  if (!isNonEmptyString(status) || !statusSet.has(status)) {
    errors.push("status")
  }

  if ("tx" in input) {
    const tx = input["tx"]
    if (!isRecord(tx)) {
      errors.push("tx")
    } else {
      hasOnlyKeys(tx, txKeys, "tx", errors)
      const sourceTxHash = tx["sourceTxHash"]
      if (sourceTxHash !== undefined) {
        if (!isNonEmptyString(sourceTxHash) || !txHashRe.test(sourceTxHash)) {
          errors.push("tx.sourceTxHash")
        }
      }
      const destTxHash = tx["destTxHash"]
      if (destTxHash !== undefined) {
        if (!isNonEmptyString(destTxHash) || !txHashRe.test(destTxHash)) {
          errors.push("tx.destTxHash")
        }
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return { ok: true }
}
