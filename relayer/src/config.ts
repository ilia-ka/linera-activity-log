import fs from "node:fs"
import path from "node:path"

export type Config = {
  lineraEndpoint: string
  lineraChainId?: string
  lineraAppEndpoint?: string
  lineraWalletPath: string
  lineraAppId: string
  relayerApiKey: string
  port: number
}

type LineraIds = {
  chainId?: string
  appId?: string
}

function readLineraIds(idsPath?: string): LineraIds {
  if (!idsPath) {
    return {}
  }
  const candidates = path.isAbsolute(idsPath)
    ? [idsPath]
    : [
        path.resolve(process.cwd(), idsPath),
        path.resolve(process.cwd(), "..", idsPath)
      ]
  const resolved = candidates.find((candidate) => fs.existsSync(candidate))
  if (!resolved) {
    return {}
  }
  try {
    const raw = fs.readFileSync(resolved, "utf8").trim()
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const chainId = typeof parsed.chainId === "string" ? parsed.chainId : undefined
    const appId = typeof parsed.appId === "string" ? parsed.appId : undefined
    return { chainId, appId }
  } catch {
    return {}
  }
}

const lineraIds = readLineraIds(process.env.LINERA_IDS_PATH)

export const config: Config = {
  lineraEndpoint: process.env.LINERA_ENDPOINT ?? "http://localhost:8080",
  lineraChainId: lineraIds.chainId ?? process.env.LINERA_CHAIN_ID,
  lineraAppEndpoint: process.env.LINERA_APP_ENDPOINT,
  lineraWalletPath: process.env.LINERA_WALLET_PATH ?? "./linera-wallet.json",
  lineraAppId: lineraIds.appId ?? process.env.LINERA_APP_ID ?? "app-id",
  relayerApiKey: process.env.RELAYER_API_KEY ?? "dev",
  port: process.env.PORT ? Number(process.env.PORT) : 3000
}
