import http = require("http")
import { config } from "./config"
import { handleEvent } from "./handlers/event"
import { handleStatus } from "./handlers/status"
import { handleGet } from "./handlers/get"

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) {
    res.statusCode = 400
    res.end()
    return
  }

  if (req.method === "POST" && req.url === "/event") {
    await handleEvent(req, res)
    return
  }

  if (req.method === "POST" && req.url === "/event/status") {
    await handleStatus(req, res)
    return
  }

  if (req.method === "GET" && req.url.startsWith("/events")) {
    await handleGet(req, res)
    return
  }

  res.statusCode = 404
  res.setHeader("content-type", "application/json")
  res.end(JSON.stringify({ ok: false, error: "not_found" }))
})

server.listen(config.port, () => {
  console.log(`relayer listening on ${config.port}`)
})
