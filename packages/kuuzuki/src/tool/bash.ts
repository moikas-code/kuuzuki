import { z } from "zod";
import { exec } from "child_process";
import { text } from "stream/consumers";
import { Tool } from "./tool";
import DESCRIPTION from "./bash.txt";
import { App } from "../app/app";
import { Config } from "../config/config";
import { Permission } from "../permission";
import { Wildcard } from "../util/wildcard";
import { Filesystem } from "../util/filesystem";
import { Parser } from "../util/parser";
import { Log } from "../util/log";

const MAX_OUTPUT_LINES = 1000;
const MAX_OUTPUT_LENGTH = 30000; // Keep for maxBuffer compatibility
const MAX_OUTPUT_CHARS = 30000; // Character-based truncation limit
const DEFAULT_TIMEOUT = 1 * 60 * 1000;
const MAX_TIMEOUT = 10 * 60 * 1000;

const log = Log.create({ service: "bash-tool" });

export const BashTool = Tool.define("bash", {
  description: DESCRIPTION,
  parameters: z.object({
    command: z.string().describe("The command to execute"),
    timeout: z
      .number()
      .min(0)
      .max(MAX_TIMEOUT)
      .describe("Optional timeout in milliseconds")
      .optional(),
    description: z
      .string()
      .describe(
        "Clear, concise description of what this command does in 5-10 words. Examples:\nInput: ls\nOutput: Lists files in current directory\n\nInput: git status\nOutput: Shows working tree status\n\nInput: npm install\nOutput: Installs package dependencies\n\nInput: mkdir foo\nOutput: Creates directory 'foo'",
      ),
  }),
  async execute(params, ctx) {
    const timeout = Math.min(params.timeout ?? DEFAULT_TIMEOUT, MAX_TIMEOUT);
    const app = App.info();
    const config = await Config.get();

    // Parse command with AST for security analysis
    const commandParts = await Parser.parseCommandParts(params.command);

    // Validate filesystem boundaries for file operations
    for (const parts of commandParts) {
      if (parts.length === 0) continue;

      const commandName = parts[0];
      const args = parts.slice(1);

      // Check filesystem boundaries for file operations
      if (
        ["cd", "rm", "cp", "mv", "mkdir", "touch", "chmod", "chown"].includes(
          commandName,
        )
      ) {
        for (const arg of args) {
          if (
            arg.startsWith("-") ||
            (commandName === "chmod" && arg.startsWith("+"))
          )
            continue;

          try {
            // Resolve path and check if it's within project boundaries
            const resolved = await Bun.$`realpath ${arg}`
              .text()
              .then((x) => x.trim())
              .catch(() => arg);
            log.info("resolved path", { arg, resolved });

            if (!Filesystem.contains(app.path.cwd, resolved)) {
              throw new Error(
                `This command references paths outside of ${app.path.cwd} so it is not allowed to be executed.`,
              );
            }
          } catch (error) {
            if (
              error instanceof Error &&
              error.message.includes("outside of")
            ) {
              throw error; // Re-throw filesystem boundary errors
            }
            // Continue if path resolution fails (might be a non-existent path)
          }
        }
      }
    }

    // Check permissions using enhanced agent-aware system
    const agentName = ctx.extra?.agentName as string | undefined;
    const permissionResult = Permission.checkPermission({
      type: "bash",
      pattern: params.command,
      agentName,
      config,
    });

    // Handle permission result
    if (permissionResult === "deny") {
      throw new Error(`Bash execution denied by permission configuration: ${params.command}`);
    }

    const needsPermission = permissionResult === "ask";

    // Ask for permission if needed
    if (needsPermission) {
      await Permission.ask({
        type: "bash",
        pattern: params.command.split(" ").slice(0, 2).join(" ").trim(),
        agentName: ctx.extra?.agentName as string | undefined,
        sessionID: ctx.sessionID,
        messageID: ctx.messageID,
        callID: ctx.toolCallID,
        title: "Run this command: " + params.command,
        metadata: {
          command: params.command,
          description: params.description,
        },
      });
    }

    // Execute the command using Node's exec for better stderr handling
    const process = exec(params.command, {
      cwd: app.path.cwd,
      signal: ctx.abort,
      maxBuffer: MAX_OUTPUT_LENGTH,
      timeout,
    });
    
    // Progressive output streaming with enhanced real-time indicators
    let stdoutLines: string[] = [];
    let stderrLines: string[] = [];
    let stdoutBuffer = "";
    let stderrBuffer = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let stdoutCharCount = 0;
    let stderrCharCount = 0;
    let startTime = Date.now();
    let lastUpdateTime = Date.now();
    let totalBytesReceived = 0;
    
    // Enhanced streaming indicators
    const getStreamingIndicator = (elapsed: number): string => {
      const dots = "●".repeat((Math.floor(elapsed / 500) % 3) + 1);
      return `${dots} Streaming...`;
    };
    
    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const timeSinceLastUpdate = Date.now() - lastUpdateTime;
      
      // Update metadata progressively for real-time display
      ctx.metadata({
        title: `${params.command} ${getStreamingIndicator(elapsed)}`,
        metadata: {
          stdout: stdoutLines.join("\n") + (stdoutBuffer ? "\n" + stdoutBuffer : ""),
          stderr: stderrLines.join("\n") + (stderrBuffer ? "\n" + stderrBuffer : ""),
          description: params.description,
          streaming: true,
          streamingIndicator: getStreamingIndicator(elapsed),
          progress: {
            stdoutLines: stdoutLines.length,
            stderrLines: stderrLines.length,
            truncated: { stdout: stdoutTruncated, stderr: stderrTruncated },
            elapsed: Math.round(elapsed / 1000),
            bytesReceived: totalBytesReceived,
            lastUpdate: new Date().toISOString(),
          },
          performance: {
            startTime,
            elapsed,
            timeSinceLastUpdate,
            avgBytesPerSecond: totalBytesReceived > 0 ? Math.round(totalBytesReceived / (elapsed / 1000)) : 0,
          },
        },
      });
      lastUpdateTime = Date.now();
    };
    
    // Stream stdout with enhanced progress tracking
    process.stdout?.on("data", (chunk: Buffer) => {
      if (stdoutTruncated) return;
      
      const chunkSize = chunk.length;
      totalBytesReceived += chunkSize;
      
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() || ""; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (stdoutLines.length >= MAX_OUTPUT_LINES || stdoutCharCount + line.length > MAX_OUTPUT_CHARS) {
          stdoutTruncated = true;
          break;
        }
        stdoutLines.push(line);
        stdoutCharCount += line.length + 1; // +1 for newline
      }
      
      updateProgress();
    });
    
    // Stream stderr with enhanced progress tracking
    process.stderr?.on("data", (chunk: Buffer) => {
      if (stderrTruncated) return;
      
      const chunkSize = chunk.length;
      totalBytesReceived += chunkSize;
      
      stderrBuffer += chunk.toString();
      const lines = stderrBuffer.split("\n");
      stderrBuffer = lines.pop() || ""; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (stderrLines.length >= MAX_OUTPUT_LINES || stderrCharCount + line.length > MAX_OUTPUT_CHARS) {
          stderrTruncated = true;
          break;
        }
        stderrLines.push(line);
        stderrCharCount += line.length + 1; // +1 for newline
      }
      
      updateProgress();
    });
    
    // Periodic progress updates for long-running commands
    const progressInterval = setInterval(() => {
      if (process.exitCode === null) {
        updateProgress();
      }
    }, 1000);
    
    // Handle process errors
    process.on("error", (error) => {
      clearInterval(progressInterval);
      log.error("Process error during bash execution", {
        command: params.command,
        error: error.message,
        sessionID: ctx.sessionID,
      });
      
      ctx.metadata({
        title: `${params.command} [ERROR]`,
        metadata: {
          stdout: stdoutLines.join("\n"),
          stderr: stderrLines.join("\n") + `\nProcess Error: ${error.message}`,
          description: params.description,
          streaming: false,
          error: true,
          errorMessage: error.message,
        },
      });
    });
    
    // Handle abort signal
    ctx.abort.addEventListener("abort", () => {
      clearInterval(progressInterval);
      if (process.pid) {
        try {
          process.kill("SIGTERM");
          setTimeout(() => {
            if (process.exitCode === null) {
              process.kill("SIGKILL");
            }
          }, 5000); // Give 5 seconds for graceful shutdown
        } catch (error) {
          log.warn("Failed to kill process on abort", { error });
        }
      }
    });
    
    let exitCode: number | null = null;
    await new Promise<void>((resolve) => {
      process.on("close", (code) => {
        exitCode = code;
        clearInterval(progressInterval);
        
        // Add any remaining buffer content
        if (stdoutBuffer && !stdoutTruncated && stdoutLines.length < MAX_OUTPUT_LINES) {
          stdoutLines.push(stdoutBuffer);
        }
        if (stderrBuffer && !stderrTruncated && stderrLines.length < MAX_OUTPUT_LINES) {
          stderrLines.push(stderrBuffer);
        }
        
        // Final progress update
        const totalElapsed = Date.now() - startTime;
        ctx.metadata({
          title: params.command,
          metadata: {
            stdout: stdoutLines.join("\n"),
            stderr: stderrLines.join("\n"),
            description: params.description,
            streaming: false,
            completed: true,
            progress: {
              stdoutLines: stdoutLines.length,
              stderrLines: stderrLines.length,
              truncated: { stdout: stdoutTruncated, stderr: stderrTruncated },
              elapsed: Math.round(totalElapsed / 1000),
              bytesReceived: totalBytesReceived,
              completedAt: new Date().toISOString(),
            },
            performance: {
              startTime,
              totalElapsed,
              avgBytesPerSecond: totalBytesReceived > 0 ? Math.round(totalBytesReceived / (totalElapsed / 1000)) : 0,
            },
          },
        });
        
        resolve();
      });
    });
    
    // Prepare final output with truncation messages
    let stdout = stdoutLines.join("\n");
    let stderr = stderrLines.join("\n");
    
    if (stdoutTruncated) {
      const reason = stdoutLines.length >= MAX_OUTPUT_LINES ? 
        `${MAX_OUTPUT_LINES} lines` : 
        `${MAX_OUTPUT_CHARS} characters`;
      stdout += `\n\n[Output truncated after ${reason}. Use pagination or filtering to see more.]`;
    }
    
    if (stderrTruncated) {
      const reason = stderrLines.length >= MAX_OUTPUT_LINES ? 
        `${MAX_OUTPUT_LINES} lines` : 
        `${MAX_OUTPUT_CHARS} characters`;
      stderr += `\n\n[Error output truncated after ${reason}. Use pagination or filtering to see more.]`;
    }

    return {
      title: params.command,
      metadata: {
        stderr,
        stdout,
        exit: exitCode,
        description: params.description,
        truncated: stdoutTruncated || stderrTruncated,
        lines: {
          stdout: stdoutLines.length,
          stderr: stderrLines.length,
        },
      },
      output: [
        `<stdout>`,
        stdout ?? "",
        `</stdout>`,
        `<stderr>`,
        stderr ?? "",
        `</stderr>`,
      ].join("\n"),
    };
  },
});
