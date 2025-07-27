import { cmd } from "./cmd"
import { UI } from "../ui"
import { spawn } from "child_process"
import path from "path"
import { fileURLToPath } from "url"
import fs from "fs/promises"

export const DesktopCommand = cmd({
  command: "$0 [project]",
  describe: "start kuuzuki desktop app",
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
      }),
  handler: async (args) => {
    try {
      // Check if desktop app binary exists
      const __dirname = path.dirname(fileURLToPath(import.meta.url))
      const desktopBinary = path.join(__dirname, "../../../../desktop/src-tauri/target/release/kuuzuki-desktop")
      
      // Alternative paths to check
      const alternativePaths = [
        path.join(__dirname, "../../../desktop/src-tauri/target/release/kuuzuki-desktop"),
        path.join(process.env.HOME || "", ".local/bin/kuuzuki-desktop"),
        "/usr/local/bin/kuuzuki-desktop",
        "/usr/bin/kuuzuki-desktop"
      ]
      
      let binaryPath: string | null = null
      
      // Check main path first
      try {
        await fs.access(desktopBinary)
        binaryPath = desktopBinary
      } catch {
        // Check alternative paths
        for (const altPath of alternativePaths) {
          try {
            await fs.access(altPath)
            binaryPath = altPath
            break
          } catch {
            // Continue checking
          }
        }
      }
      
      if (!binaryPath) {
        UI.error("Desktop app not found. Please build it first with: ./run.sh build desktop")
        UI.info("Or run in terminal mode with: kuuzuki tui")
        return
      }
      
      // Launch desktop app
      const desktopProcess = spawn(binaryPath, [], {
        detached: true,
        stdio: 'ignore',
        env: {
          ...process.env,
          KUUZUKI_PROJECT: args.project || process.cwd(),
          KUUZUKI_MODEL: args.model || "",
          KUUZUKI_PROMPT: args.prompt || ""
        }
      })
      
      desktopProcess.unref()
      
      UI.success("Desktop app launched")
      process.exit(0)
      
    } catch (error) {
      UI.error("Failed to launch desktop app: " + (error instanceof Error ? error.message : String(error)))
      UI.info("Run in terminal mode with: kuuzuki tui")
    }
  }
})