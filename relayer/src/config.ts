export type Config = {
  lineraEndpoint: string
  lineraWalletPath: string
  lineraAppId: string
  relayerApiKey: string
  port: number
}

export const config: Config = {
  lineraEndpoint: process.env.LINERA_ENDPOINT ?? "http://localhost:8080",
  lineraWalletPath: process.env.LINERA_WALLET_PATH ?? "./linera-wallet.json",
  lineraAppId: process.env.LINERA_APP_ID ?? "app-id",
  relayerApiKey: process.env.RELAYER_API_KEY ?? "dev",
  port: process.env.PORT ? Number(process.env.PORT) : 3000
}
