import type { IncomingMessage, ServerResponse } from "http"

export async function handleEvent(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req)
  res.statusCode = 200
  res.setHeader("content-type", "application/json")
  res.end(JSON.stringify({ ok: true, route: "event", receivedBytes: body.length }))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = ""
    req.on("data", (chunk) => (data += chunk))
    req.on("end", () => resolve(data))
  })
}
