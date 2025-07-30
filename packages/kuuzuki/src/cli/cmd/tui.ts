import { Provider } from "../../provider/provider"
import { Server } from "../../server/server"
import { bootstrap } from "../bootstrap"
import { UI } from "../ui"
import { cmd } from "./cmd"
import path from "path"
import fs from "fs/promises"
import { Installation } from "../../installation"
import { Config } from "../../config/config"
import { Bus } from "../../bus"
import { Log } from "../../util/log"
import { FileWatcher } from "../../file/watch"
import { Mode } from "../../session/mode"

export const TuiCommand = cmd({
  command: "tui [project]",
  describe: "start kuuzuki in terminal UI mode",
  builder: (yargs) =>
    yargs
      .positional("project", {
        type: "string",
        describe: "path to start kuuzuki in",
      })
      .option("model", {
        type: "string",
        alias: ["m"],
        describe: "model to use in the format of provider/model",
      })
      .option("prompt", {
        alias: ["p"],
        type: "string",
        describe: "prompt to use",
      })
      .option("mode", {
        type: "string",
        describe: "mode to use",
      })
      .option("port", {
        type: "number",
        describe: "port to listen on",
        default: 0,
      })
      .option("hostname", {
        alias: ["h"],
        type: "string",
        describe: "hostname to listen on",
        default: "127.0.0.1",
      }),
  handler: async (args) => {
    while (true) {
      const cwd = args.project ? path.resolve(args.project) : process.cwd()
      try {
        process.chdir(cwd)
      } catch (e) {
        UI.error("Failed to change directory to " + cwd)
        return
      }
      const result = await bootstrap({ cwd }, async (app) => {
        FileWatcher.init()
        const providers = await Provider.list()
        if (Object.keys(providers).length === 0) {
          return "needs_provider"
        }

        const server = Server.listen({
          port: args.port,
          hostname: args.hostname,
        })

        // Write server info for auto-detection
        await import("../../server/server-info").then(({ writeServerInfo }) =>
          writeServerInfo({ port: server.port!, hostname: server.hostname || "127.0.0.1" })
        )

        // Wait for server to be ready before starting TUI
        const serverUrl = `http://${server.hostname || "127.0.0.1"}:${server.port}`
        let retries = 0
        const maxRetries = 30 // 3 seconds with 100ms intervals
        
        while (retries < maxRetries) {
          try {
            const response = await fetch(`${serverUrl}/health`)
            if (response.ok) {
              Log.Default.info("Server is ready", { url: serverUrl })
              break
            }
          } catch (e) {
            // Server not ready yet
          }
          
          retries++
          if (retries === maxRetries) {
            UI.error("Server failed to start. Please try again.")
            server.stop()
            return
          }
          
          await new Promise(resolve => setTimeout(resolve, 100))
        }

        let cmd: string[]
        let cwd: string = process.cwd()

        // Check for pre-built binary first
        const prebuiltBinary = path.join(__dirname, "../../../../tui/kuuzuki-tui")
        if (await Bun.file(prebuiltBinary).exists()) {
          cmd = [prebuiltBinary]
        } else {
          // Fallback to go run for development
          cmd = ["go", "run", "./main.go"]
          cwd = Bun.fileURLToPath(new URL("../../../../tui/cmd/kuuzuki", import.meta.url))
          
          // Check if the Go source exists
          const mainGoPath = path.join(cwd, "main.go")
          try {
            await fs.access(mainGoPath)
          } catch (e) {
            UI.error(`TUI source not found at ${mainGoPath}`)
            UI.error("Please ensure the TUI source code exists.")
            server.stop()
            return "done"
          }
        }
        if (Bun.embeddedFiles.length > 0) {
          const blob = Bun.embeddedFiles[0] as File
          let binaryName = blob.name
          if (process.platform === "win32" && !binaryName.endsWith(".exe")) {
            binaryName += ".exe"
          }
          const binary = path.join(__dirname, "../../../binaries", binaryName)
          const file = Bun.file(binary)
          if (!(await file.exists())) {
            await Bun.write(file, blob, { mode: 0o755 })
            await fs.chmod(binary, 0o755)
          }
          cwd = process.cwd()
          cmd = [binary]
        }
        Log.Default.info("tui", {
          cmd,
          cwd,
          server: server.url.toString(),
        })
        
        // Add error handling for TUI spawn
        let proc
        try {
          // In development mode, check if go is available
          if (cmd[0] === "go") {
            try {
              const goVersion = await Bun.spawn({
                cmd: ["go", "version"],
                stdout: "pipe",
                stderr: "pipe",
              }).exited
              
              if (goVersion !== 0) {
                UI.error("Go is not installed or not in PATH. Please install Go to run in development mode.")
                server.stop()
                return "done"
              }
            } catch (e) {
              UI.error("Go is not installed or not in PATH. Please install Go to run in development mode.")
              server.stop()
              return "done"
            }
          }
          
          // Log the exact command being run
          Log.Default.info("Spawning TUI process", {
            cmd: cmd.join(" "),
            cwd,
            server: server.url.toString()
          })
          
          // For development mode with Go, capture stderr to debug issues
          const isGoRun = cmd[0] === "go"
          
          proc = Bun.spawn({
            cmd: [
              ...cmd,
              ...(args.model ? ["--model", args.model] : []),
              ...(args.prompt ? ["--prompt", args.prompt] : []),
              ...(args.mode ? ["--mode", args.mode] : []),
            ],
            cwd,
            stdout: "inherit",
            stderr: isGoRun ? "pipe" : "inherit",  // Capture stderr for go run
            stdin: "inherit",
            env: {
              ...process.env,
              CGO_ENABLED: "0",
              KUUZUKI_SERVER: server.url.toString(),
              KUUZUKI_APP_INFO: JSON.stringify(app),
              KUUZUKI_MODES: JSON.stringify(await Mode.list()),
            },
            onExit: (proc, exitCode, signalCode, error) => {
              Log.Default.info("TUI process exited", { exitCode, signalCode, error: error?.message })
              if (error) {
                Log.Default.error("TUI process error", { error: error.message })
              }
              if (exitCode !== 0 && exitCode !== null) {
                Log.Default.error("TUI exited with error", { exitCode, signalCode })
              }
              server.stop()
              // Force exit to prevent terminal lock
              process.exit(exitCode || 0)
            },
          })
          
          // For go run, monitor stderr for compilation errors
          if (isGoRun && proc.stderr) {
            const reader = proc.stderr.getReader()
            const decoder = new TextDecoder()
            let errorBuffer = ""
            
            ;(async () => {
              try {
                while (true) {
                  const { done, value } = await reader.read()
                  if (done) break
                  const text = decoder.decode(value)
                  errorBuffer += text
                  // Print Go compilation errors immediately
                  process.stderr.write(text)
                }
              } catch (e) {
                // Reader closed
              }
              
              if (errorBuffer.length > 0) {
                Log.Default.error("Go compilation errors", { errors: errorBuffer })
              }
            })()
          }
          
          // Add a small delay to allow TUI to initialize and potentially fail fast
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // Check if process is still running
          if (proc.exitCode !== null) {
            Log.Default.error("TUI process exited immediately", { exitCode: proc.exitCode })
            UI.error("TUI failed to start. Check logs for details.")
            server.stop()
            return "done"
          }
        } catch (error) {
          Log.Default.error("Failed to spawn TUI", { error: error.message })
          UI.error(`Failed to start TUI: ${error.message}`)
          server.stop()
          return "done"
        }

        ;(async () => {
          if (Installation.VERSION === "dev") return
          if (Installation.isSnapshot()) return
          const config = await Config.global()
          if (config.autoupdate === false) return
          const latest = await Installation.latest().catch(() => {})
          if (!latest) return
          if (Installation.VERSION === latest) return
          const method = await Installation.method()
          if (method === "unknown") return
          await Installation.upgrade(method, latest)
            .then(() => {
              Bus.publish(Installation.Event.Updated, { version: latest })
            })
            .catch(() => {})
        })()
        // Disabled: VS Code extension auto-installation
        // Reserved for future custom kuuzuki extension
        //         ;(async () => {
        //           if (Ide.alreadyInstalled()) return
        //           const ide = await Ide.ide()
        //           if (ide === "unknown") return
        //           await Ide.install(ide)
        //             .then(() => {
        //               Bus.publish(Ide.Event.Installed, { ide })
        //             })
        //             .catch(() => {})
        //         })()

        // Setup signal handlers to ensure clean exit
        const cleanup = () => {
          Log.Default.info("Cleaning up...")
          if (proc && proc.exitCode === null) {
            proc.kill()
          }
          server.stop()
          process.exit(0)
        }
        
        process.on('SIGINT', cleanup)
        process.on('SIGTERM', cleanup)
        
        await proc.exited
        
        // Remove signal handlers
        process.removeListener('SIGINT', cleanup)
        process.removeListener('SIGTERM', cleanup)
        
        server.stop()

        return "done"
      })
      if (result === "done") break
      if (result === "needs_provider") {
        UI.empty()
        UI.println(UI.logo("   "))
        const result = await Bun.spawn({
          cmd: [...getOpencodeCommand(), "auth", "login"],
          cwd: process.cwd(),
          stdout: "inherit",
          stderr: "inherit",
          stdin: "inherit",
        }).exited
        if (result !== 0) return
        UI.empty()
      }
    }
  },
})

/**
 * Get the correct command to run kuuzuki CLI
 * In development: ["bun", "run", "packages/kuuzuki/src/index.ts"]
 * In production: ["/path/to/kuuzuki"]
 */
function getOpencodeCommand(): string[] {
  // Check if KUUZUKI_BIN_PATH is set (used by shell wrapper scripts)
  if (process.env["KUUZUKI_BIN_PATH"]) {
    return [process.env["KUUZUKI_BIN_PATH"]]
  }

  const execPath = process.execPath.toLowerCase()

  if (Installation.isDev()) {
    // In development, use bun to run the TypeScript entry point
    return [execPath, "run", process.argv[1]]
  }

  // In production, use the current executable path
  return [process.execPath]
}
