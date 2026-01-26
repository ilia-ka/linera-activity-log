import {
  ActivityAiMode,
  ActivityAiVerdict,
  ActivityApp,
  ActivityEvent,
  ActivityKind,
  ActivityStatus,
  ActivityTokenSymbol
} from "./types"

export type ValidationResult = { ok: true } | { ok: false; errors: string[] }

const appValue: ActivityApp = "arc-stable-toolbox"

const statusSet = new Set<ActivityStatus>([
  "started",
  "approved",
  "submitted",
  "attested",
  "completed",
  "failed"
])

const kindSet = new Set<ActivityKind>(["bridge", "swap", "deploy", "contractCall"])

const tokenSymbolSet = new Set<ActivityTokenSymbol>(["USDC", "EURC"])

const aiModeSet = new Set<ActivityAiMode>(["suggest", "approve"])

const aiVerdictSet = new Set<ActivityAiVerdict>(["approve", "deny", "suggest"])

const rootKeys = new Set([
  "id",
  "createdAt",
  "actor",
  "app",
  "intentId",
  "kind",
  "status",
  "chains",
  "token",
  "tx",
  "refs",
  "ai",
  "signals"
])

const chainsKeys = new Set(["sourceChainId", "destChainId"])
const tokenKeys = new Set(["symbol", "amount"])
const txKeys = new Set(["sourceTxHash", "destTxHash"])
const refsKeys = new Set(["explorerSourceUrl", "explorerDestUrl"])
const aiKeys = new Set(["mode", "receiptRoot", "model", "verdict", "reason"])
const signalsKeys = new Set(["items", "meta"])
const metaKeys = new Set(["deployAddress", "errors", "decimals", "slippage"])

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const addressRe = /^0x[a-f0-9]{40}$/
const amountRe = /^[0-9]+$/
const txHashRe = /^0x[a-fA-F0-9]{64}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

function isUuid(value: string): boolean {
  return uuidRe.test(value)
}

function isIsoDateTime(value: string): boolean {
  return !Number.isNaN(Date.parse(value))
}

function isUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
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

export function validateActivityEvent(input: unknown): ValidationResult {
  if (!isRecord(input)) {
    return { ok: false, errors: ["not_object"] }
  }

  const errors: string[] = []

  hasOnlyKeys(input, rootKeys, "root", errors)

  const id = input["id"]
  if (!isNonEmptyString(id) || !isUuid(id)) {
    errors.push("id")
  }

  const createdAt = input["createdAt"]
  if (!isNonEmptyString(createdAt) || !isIsoDateTime(createdAt)) {
    errors.push("createdAt")
  }

  const actor = input["actor"]
  if (!isNonEmptyString(actor) || !addressRe.test(actor)) {
    errors.push("actor")
  }

  const app = input["app"]
  if (!isNonEmptyString(app) || app !== appValue) {
    errors.push("app")
  }

  const intentId = input["intentId"]
  if (!isNonEmptyString(intentId) || !isUuid(intentId)) {
    errors.push("intentId")
  }

  const kind = input["kind"]
  if (!isNonEmptyString(kind) || !kindSet.has(kind as ActivityKind)) {
    errors.push("kind")
  }

  const status = input["status"]
  if (!isNonEmptyString(status) || !statusSet.has(status as ActivityStatus)) {
    errors.push("status")
  }

  if ("chains" in input) {
    const chains = input["chains"]
    if (!isRecord(chains)) {
      errors.push("chains")
    } else {
      hasOnlyKeys(chains, chainsKeys, "chains", errors)
      const sourceChainId = chains["sourceChainId"]
      if (
        sourceChainId !== undefined &&
        (!Number.isInteger(sourceChainId) || (sourceChainId as number) < 1)
      ) {
        errors.push("chains.sourceChainId")
      }
      const destChainId = chains["destChainId"]
      if (
        destChainId !== undefined &&
        (!Number.isInteger(destChainId) || (destChainId as number) < 1)
      ) {
        errors.push("chains.destChainId")
      }
    }
  }

  if ("token" in input) {
    const token = input["token"]
    if (!isRecord(token)) {
      errors.push("token")
    } else {
      hasOnlyKeys(token, tokenKeys, "token", errors)
      const symbol = token["symbol"]
      if (!isNonEmptyString(symbol) || !tokenSymbolSet.has(symbol as ActivityTokenSymbol)) {
        errors.push("token.symbol")
      }
      const amount = token["amount"]
      if (!isNonEmptyString(amount) || !amountRe.test(amount)) {
        errors.push("token.amount")
      }
    }
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

  if ("refs" in input) {
    const refs = input["refs"]
    if (!isRecord(refs)) {
      errors.push("refs")
    } else {
      hasOnlyKeys(refs, refsKeys, "refs", errors)
      const explorerSourceUrl = refs["explorerSourceUrl"]
      if (explorerSourceUrl !== undefined) {
        if (!isNonEmptyString(explorerSourceUrl) || !isUrl(explorerSourceUrl)) {
          errors.push("refs.explorerSourceUrl")
        }
      }
      const explorerDestUrl = refs["explorerDestUrl"]
      if (explorerDestUrl !== undefined) {
        if (!isNonEmptyString(explorerDestUrl) || !isUrl(explorerDestUrl)) {
          errors.push("refs.explorerDestUrl")
        }
      }
    }
  }

  if ("ai" in input) {
    const ai = input["ai"]
    if (!isRecord(ai)) {
      errors.push("ai")
    } else {
      hasOnlyKeys(ai, aiKeys, "ai", errors)
      const mode = ai["mode"]
      if (!isNonEmptyString(mode) || !aiModeSet.has(mode as ActivityAiMode)) {
        errors.push("ai.mode")
      }
      const receiptRoot = ai["receiptRoot"]
      if (receiptRoot !== undefined && !isNonEmptyString(receiptRoot)) {
        errors.push("ai.receiptRoot")
      }
      const model = ai["model"]
      if (model !== undefined && !isNonEmptyString(model)) {
        errors.push("ai.model")
      }
      const verdict = ai["verdict"]
      if (verdict !== undefined) {
        if (!isNonEmptyString(verdict) || !aiVerdictSet.has(verdict as ActivityAiVerdict)) {
          errors.push("ai.verdict")
        }
      }
      const reason = ai["reason"]
      if (reason !== undefined && !isNonEmptyString(reason)) {
        errors.push("ai.reason")
      }
    }
  }

  if ("signals" in input) {
    const signals = input["signals"]
    if (!isRecord(signals)) {
      errors.push("signals")
    } else {
      hasOnlyKeys(signals, signalsKeys, "signals", errors)
      const items = signals["items"]
      if (!Array.isArray(items) || items.some((item) => !isNonEmptyString(item))) {
        errors.push("signals.items")
      }
      const meta = signals["meta"]
      if (meta !== undefined) {
        if (!isRecord(meta)) {
          errors.push("signals.meta")
        } else {
          hasOnlyKeys(meta, metaKeys, "signals.meta", errors)
          const deployAddress = meta["deployAddress"]
          if (deployAddress !== undefined) {
            if (!isNonEmptyString(deployAddress) || !addressRe.test(deployAddress)) {
              errors.push("signals.meta.deployAddress")
            }
          }
          const errorsValue = meta["errors"]
          if (errorsValue !== undefined) {
            if (
              !Array.isArray(errorsValue) ||
              errorsValue.some((item) => !isNonEmptyString(item))
            ) {
              errors.push("signals.meta.errors")
            }
          }
          const decimals = meta["decimals"]
          if (decimals !== undefined) {
            if (!Number.isInteger(decimals) || (decimals as number) < 0) {
              errors.push("signals.meta.decimals")
            }
          }
          const slippage = meta["slippage"]
          if (slippage !== undefined && !isNonEmptyString(slippage)) {
            errors.push("signals.meta.slippage")
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return { ok: true }
}
