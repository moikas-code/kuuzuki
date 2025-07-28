import { Provider } from "../../provider/provider"
import { Server } from "../../server/server"
import { bootstrap } from "../bootstrap"
import { cmd } from "./cmd"

export const ServeCommand = cmd({
  command: "serve",
  builder: (yargs) =>
    yargs
      .option("port", {
        alias: ["p"],
        type: "number",
        describe: "port to listen on",
        default: 4096,
      })
      .option("hostname", {
        alias: ["h"],
        type: "string",
        describe: "hostname to listen on",
        default: "127.0.0.1",
      }),
  describe: "starts a headless kuuzuki server",
  handler: async (args) => {
    const cwd = process.cwd()
    await bootstrap({ cwd }, async () => {
      const providers = await Provider.list()
      if (Object.keys(providers).length === 0) {
        return "needs_provider"
      }

      const hostname = args.hostname
      const port = args.port

      const server = Server.listen({
        port,
        hostname,
      })

      console.log(`kuuzuki server listening on http://${server.hostname}:${server.port}`)

      // Write server info for auto-detection
      await import("../../server/server-info").then(({ writeServerInfo }) =>
        writeServerInfo({ port: server.port!, hostname: server.hostname || "127.0.0.1" })
      )

      await new Promise(() => {})

      server.stop()
    })
  },
})
