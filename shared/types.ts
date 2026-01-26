export type ActivityApp = "arc-stable-toolbox"

export type ActivityKind = "bridge" | "swap" | "deploy" | "contractCall"

export type ActivityStatus =
  | "started"
  | "approved"
  | "submitted"
  | "attested"
  | "completed"
  | "failed"

export type ActivityChains = {
  sourceChainId?: number
  destChainId?: number
}

export type ActivityTokenSymbol = "USDC" | "EURC"

export type ActivityToken = {
  symbol: ActivityTokenSymbol
  amount: string
}

export type ActivityTx = {
  sourceTxHash?: string
  destTxHash?: string
}

export type ActivityRefs = {
  explorerSourceUrl?: string
  explorerDestUrl?: string
}

export type ActivityAiMode = "suggest" | "approve"

export type ActivityAiVerdict = "approve" | "deny" | "suggest"

export type ActivityAi = {
  mode: ActivityAiMode
  receiptRoot?: string
  model?: string
  verdict?: ActivityAiVerdict
  reason?: string
}

export type ActivitySignalsMeta = {
  deployAddress?: string
  errors?: string[]
  decimals?: number
  slippage?: string
}

export type ActivitySignals = {
  items: string[]
  meta?: ActivitySignalsMeta
}

export type ActivityEvent = {
  id: string
  createdAt: string
  actor: string
  app: ActivityApp
  intentId: string
  kind: ActivityKind
  status: ActivityStatus
  chains?: ActivityChains
  token?: ActivityToken
  tx?: ActivityTx
  refs?: ActivityRefs
  ai?: ActivityAi
  signals?: ActivitySignals
}
