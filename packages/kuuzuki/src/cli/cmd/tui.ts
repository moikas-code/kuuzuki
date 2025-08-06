import { Provider } from "../../provider/provider";
import { Server } from "../../server/server";
import { bootstrap } from "../bootstrap";
import { UI } from "../ui";
import { cmd } from "./cmd";
import path from "path";
import fs from "fs/promises";
import { spawn } from "child_process";
import { Installation } from "../../installation";
import { Config } from "../../config/config";
import { Bus } from "../../bus";
import { Log } from "../../util/log";
import { FileWatcher } from "../../file/watch";
import { Mode } from "../../session/mode";

// Global process tracking for cleanup
const activeProcesses = new Set<any>();

// Helper function to replace Bun.spawn
function spawnAsync(command: string, args: string[], options: any = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      stdio: [
        options.stdin || "pipe",
        options.stdout || "pipe",
        options.stderr || "pipe",
      ],
      env: { ...process.env, ...options.env },
    });

    if (options.stdout === "inherit" && options.stderr === "inherit") {
      proc.on("exit", (code) => resolve({ exitCode: code }));
    } else {
      let stdout = "";
      let stderr = "";

      if (proc.stdout) proc.stdout.on("data", (data) => (stdout += data));
      if (proc.stderr) proc.stderr.on("data", (data) => (stderr += data));

      proc.on("exit", (code) => {
        resolve({
          exited: code,
          stdout: stdout,
          stderr: stderr,
        });
      });
    }

    proc.on("error", reject);
  });
}

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
      })
      .option("debug", {
        type: "boolean",
        describe: "Enable debug logging",
        default: false,
      })
      .option("verbose", {
        type: "boolean",
        describe: "Enable verbose logging",
        default: false,
      }),
  handler: async (args) => {
    // Enable debug logging if requested
    if (args.debug || args.verbose) {
      process.env.KUUZUKI_DEBUG = "true";
    }

    while (true) {
      const cwd = args.project ? path.resolve(args.project) : process.cwd();
      try {
        process.chdir(cwd);
      } catch (e) {
        UI.error("Failed to change directory to " + cwd);
        return;
      }
      const result = await bootstrap({ cwd }, async (app) => {
        FileWatcher.init();
        const providers = await Provider.list();
        if (Object.keys(providers).length === 0) {
          return "needs_provider";
        }

        const server = Server.listen({
          port: args.port,
          hostname: args.hostname,
        });

        // Write server info for auto-detection
        await import("../../server/server-info").then(({ writeServerInfo }) =>
          writeServerInfo({
            port: server.port!,
            hostname: server.hostname || "127.0.0.1",
          }),
        );

        // No process cleanup - let each instance manage itself independently

        // Wait for server to be ready before starting TUI
        const serverUrl = `http://${server.hostname || "127.0.0.1"}:${server.port}`;
        let retries = 0;
        const maxRetries = 200; // 20 seconds with 100ms intervals - increased for session management fixes

        Log.Default.info("Waiting for server to be ready", { url: serverUrl });
        while (retries < maxRetries) {
          try {
            // Test multiple endpoints to ensure server is fully ready
            const healthResponse = await fetch(`${serverUrl}/health`, {
              signal: AbortSignal.timeout(1000),
            });

            if (healthResponse.ok) {
              // Additional check - try to fetch config to ensure all routes are ready
              try {
                const configResponse = await fetch(`${serverUrl}/config`, {
                  signal: AbortSignal.timeout(1000),
                });
                if (configResponse.ok || configResponse.status === 404) {
                  Log.Default.info("Server is fully ready", { url: serverUrl });
                  break;
                }
              } catch (e) {
                // Config endpoint might not exist, health is enough
                Log.Default.info("Server is ready (health check passed)", {
                  url: serverUrl,
                });
                break;
              }
            }
          } catch (e) {
            // Server not ready yet or timeout
            Log.Default.debug("Server not ready yet", {
              attempt: retries + 1,
              maxRetries,
              error: e.message,
              url: serverUrl,
            });
          }

          retries++;
          if (retries === maxRetries) {
            UI.error(
              "Server failed to start within timeout. Please try again.",
            );
            server.stop();
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Additional stabilization delay to ensure server is fully ready
        // Increased delay to allow session management system to initialize properly
        Log.Default.info("Server ready, waiting for stabilization...");
        await new Promise((resolve) => setTimeout(resolve, 1000));

        let cmd: string[];
        let cwd: string = process.cwd();

        // Check for TUI binary in multiple locations
        const tuiBinaryName =
          process.platform === "win32" ? "kuuzuki-tui.exe" : "kuuzuki-tui";

        // Potential TUI binary locations
        const tuiLocations = [
          // 1. Production npm package: TUI binary alongside main binary
          path.join(path.dirname(process.execPath), tuiBinaryName),
          // 2. NPX or local node_modules: look in platform package
          path.join(
            __dirname,
            "..",
            "..",
            "..",
            "..",
            `kuuzuki-${process.platform === "win32" ? "windows" : process.platform}-${process.arch === "x64" ? "x64" : "arm64"}`,
            "bin",
            tuiBinaryName,
          ),
          // 3. Global npm/yarn/pnpm: look in sibling package
          path.join(
            __dirname,
            "..",
            "..",
            "..",
            "..",
            "..",
            `kuuzuki-${process.platform === "win32" ? "windows" : process.platform}-${process.arch === "x64" ? "x64" : "arm64"}`,
            "bin",
            tuiBinaryName,
          ),
          // 4. Development: pre-built binary in tui directory
          path.join(__dirname, "../../../../tui", tuiBinaryName),
          // 5. Development: binary in project root binaries
          path.join(__dirname, "../../../binaries", tuiBinaryName),
        ];

        let tuiBinaryPath: string | null = null;
        for (const location of tuiLocations) {
          try {
            // First check if file exists
            await fs.access(location, fs.constants.F_OK);

            // Try to access with execute permission
            try {
              await fs.access(location, fs.constants.X_OK);
            } catch {
              // File exists but not executable - fix permissions (Bun global install issue)
              Log.Default.info("Fixing TUI binary permissions", {
                path: location,
              });
              await fs.chmod(location, 0o755);
            }

            tuiBinaryPath = location;
            break;
          } catch {
            // File doesn't exist, continue checking other locations
          }
        }

        if (tuiBinaryPath) {
          cmd = [tuiBinaryPath];
        } else {
          // Fallback to go run for development
          cmd = ["go", "run", "./main.go"];

          // Try to determine the correct cwd for Go source
          let goCwd: string;
          if (typeof import.meta !== "undefined" && import.meta.url) {
            // ES module environment - use fileURLToPath from url module
            const { fileURLToPath } = await import("url");
            goCwd = path.join(
              path.dirname(fileURLToPath(import.meta.url)),
              "../../../../tui/cmd/kuuzuki",
            );
          } else {
            // CommonJS or compiled binary fallback
            goCwd = path.join(__dirname, "../../../../tui/cmd/kuuzuki");
          }
          cwd = goCwd;

          // Check if the Go source exists
          const mainGoPath = path.join(cwd, "main.go");
          try {
            await fs.access(mainGoPath);
          } catch (e) {
            UI.error(`TUI binary not found in any of these locations:`);
            tuiLocations.forEach((loc) => UI.error(`  - ${loc}`));
            UI.error(`\nAlso tried Go source at: ${mainGoPath}`);
            UI.error("\nPlease ensure kuuzuki is properly installed.");
            server.stop();
            return "done";
          }
        }
        // Note: Removed Bun.embeddedFiles handling as it's not used in npm distribution
        Log.Default.info("tui", {
          cmd,
          cwd,
          server: serverUrl,
        });

        // Add error handling for TUI spawn
        let proc;
        try {
          // In development mode, check if go is available
          if (cmd[0] === "go") {
            try {
              const result = (await spawnAsync("go", ["version"], {
                stdout: "pipe",
                stderr: "pipe",
              })) as any;

              if (result.exitCode !== 0) {
                UI.error(
                  "Go is not installed or not in PATH. Please install Go to run in development mode.",
                );
                server.stop();
                return "done";
              }
            } catch (e) {
              UI.error(
                "Go is not installed or not in PATH. Please install Go to run in development mode.",
              );
              server.stop();
              return "done";
            }
          }

          // Log the exact command being run
          Log.Default.info("Spawning TUI process", {
            cmd: cmd.join(" "),
            cwd,
            server: serverUrl,
          });

          // For development mode with Go, capture stderr to debug issues
          const isGoRun = cmd[0] === "go";

          // Prepare arguments
          const tuiArgs = cmd
            .slice(1)
            .concat([
              ...(args.model ? ["--model", args.model] : []),
              ...(args.prompt ? ["--prompt", args.prompt] : []),
              ...(args.mode ? ["--mode", args.mode] : []),
            ]);

          proc = spawn(cmd[0], tuiArgs, {
            cwd,
            stdio: ["inherit", "inherit", isGoRun ? "pipe" : "inherit"],
            env: {
              ...process.env,
              CGO_ENABLED: "0",
              KUUZUKI_SERVER: serverUrl,
              KUUZUKI_APP_INFO: JSON.stringify(app),
              KUUZUKI_MODES: JSON.stringify(await Mode.list()),
            },
          });

          // Track this process for cleanup
          activeProcesses.add(proc);

          proc.on("exit", (exitCode, signalCode) => {
            // Remove from tracking when process exits
            activeProcesses.delete(proc);
            Log.Default.info("TUI process exited", { exitCode, signalCode });
            if (exitCode !== 0 && exitCode !== null) {
              Log.Default.error("TUI exited with error", {
                exitCode,
                signalCode,
              });
            }
            server.stop();
            // Force exit to prevent terminal lock
            process.exit(exitCode || 0);
          });

          proc.on("error", (error) => {
            Log.Default.error("TUI process error", { error: error.message });
            server.stop();
            process.exit(1);
          });

          // For go run, monitor stderr for compilation errors
          if (isGoRun && proc.stderr) {
            let errorBuffer = "";

            proc.stderr.on("data", (data) => {
              const text = data.toString();
              errorBuffer += text;
              // Print Go compilation errors immediately
              process.stderr.write(text);
            });

            proc.stderr.on("end", () => {
              if (errorBuffer.length > 0) {
                Log.Default.error("Go compilation errors", {
                  errors: errorBuffer,
                });
              }
            });
          }

          // Add a longer delay to allow TUI to initialize and potentially fail fast
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Check if process is still running
          if (proc.exitCode !== null) {
            Log.Default.error("TUI process exited immediately", {
              exitCode: proc.exitCode,
            });
            UI.error(
              `TUI failed to start (exit code: ${proc.exitCode}). This usually means the server connection failed.`,
            );
            UI.error(`Server was running at: ${serverUrl}`);
            UI.error(
              "Try running without watch mode: bun packages/kuuzuki/src/index.ts tui",
            );
            server.stop();
            return "done";
          }

          Log.Default.info("TUI process started successfully", {
            pid: proc.pid,
          });
        } catch (error) {
          Log.Default.error("Failed to spawn TUI", { error: error.message });
          UI.error(`Failed to start TUI: ${error.message}`);
          server.stop();
          return "done";
        }

        (async () => {
          if (Installation.VERSION === "dev") return;
          if (Installation.isSnapshot()) return;
          const config = await Config.global();
          if (config.autoupdate === false) return;
          const latest = await Installation.latest().catch(() => {});
          if (!latest) return;
          if (Installation.VERSION === latest) return;
          const method = await Installation.method();
          if (method === "unknown") return;
          await Installation.upgrade(method, latest)
            .then(() => {
              Bus.publish(Installation.Event.Updated, { version: latest });
            })
            .catch(() => {});
        })();
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
          Log.Default.info("Cleaning up...");
          if (proc && proc.exitCode === null) {
            proc.kill();
          }
          server.stop();
          // Clear server info asynchronously
          import("../../server/server-info")
            .then(({ clearServerInfo }) => clearServerInfo())
            .catch(() => {});
          process.exit(0);
        };

        process.on("SIGINT", cleanup);
        process.on("SIGTERM", cleanup);

        // Wait for process to exit
        await new Promise((resolve) => {
          proc.on("exit", resolve);
        });

        // Remove signal handlers
        process.removeListener("SIGINT", cleanup);
        process.removeListener("SIGTERM", cleanup);

        server.stop();

        // Clean up server info file
        await import("../../server/server-info").then(({ clearServerInfo }) =>
          clearServerInfo(),
        );

        return "done";
      });
      if (result === "done") break;
      if (result === "needs_provider") {
        UI.empty();
        UI.println(UI.logo("   "));
        const result = (await spawnAsync(
          getOpencodeCommand()[0],
          [...getOpencodeCommand().slice(1), "auth", "login"],
          {
            cwd: process.cwd(),
            stdout: "inherit",
            stderr: "inherit",
            stdin: "inherit",
          },
        )) as any;
        if (result.exitCode !== 0) return;
        UI.empty();
      }
    }
  },
});

/**
 * Get the correct command to run kuuzuki CLI
 * In development: ["bun", "run", "packages/kuuzuki/src/index.ts"]
 * In production: ["/path/to/kuuzuki"]
 */
function getOpencodeCommand(): string[] {
  // Check if KUUZUKI_BIN_PATH is set (used by shell wrapper scripts)
  if (process.env["KUUZUKI_BIN_PATH"]) {
    return [process.env["KUUZUKI_BIN_PATH"]];
  }

  const execPath = process.execPath.toLowerCase();

  if (Installation.isDev()) {
    // In development, use bun to run the TypeScript entry point
    return [execPath, "run", process.argv[1]];
  }

  // In production, use the current executable path
  return [process.execPath];
}
