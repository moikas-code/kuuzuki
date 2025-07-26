import { Hono } from "hono"
import { streamSSE } from "hono/streaming"

export const TerminalRoute = new Hono()

// Since we're already running the TUI as part of the server,
// we can create a simple proxy endpoint that forwards commands
TerminalRoute.get(
  "/stream",
  async (c) => {
    return streamSSE(c, async (stream) => {
      // Send initial connection message
      await stream.writeSSE({
        data: JSON.stringify({
          type: "connected",
          message: "Terminal stream connected"
        })
      })

      // Keep connection alive
      const keepAlive = setInterval(async () => {
        await stream.writeSSE({
          data: JSON.stringify({
            type: "ping",
            timestamp: Date.now()
          })
        })
      }, 30000)

      // Cleanup on disconnect
      stream.onAbort(() => {
        clearInterval(keepAlive)
      })
    })
  }
)