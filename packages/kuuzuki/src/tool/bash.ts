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

const MAX_OUTPUT_LENGTH = 30000;
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

    // Check permissions using hybrid approach
    let needsPermission = false;

    if (config.permission) {
      if (Array.isArray(config.permission)) {
        // kuuzuki simple array format
        needsPermission = Wildcard.matchAny(config.permission, params.command);
      } else if (
        typeof config.permission === "object" &&
        config.permission.bash
      ) {
        // OpenCode object format
        const bashPerms = config.permission.bash;

        if (typeof bashPerms === "string") {
          // Global bash permission setting
          needsPermission = bashPerms === "ask";
        } else {
          // Pattern-based bash permissions
          needsPermission = false; // Default to allow

          // Check each command part against patterns
          for (const parts of commandParts) {
            if (parts.length === 0) continue;

            const commandText = parts.join(" ");

            // Always allow cd if it passes filesystem check
            if (parts[0] === "cd") continue;

            // Check patterns in order
            let matched = false;
            for (const [pattern, action] of Object.entries(bashPerms)) {
              if (Wildcard.matchOpenCode(commandText, pattern)) {
                log.info("checking", {
                  text: commandText.trim(),
                  pattern,
                  match: true,
                  action,
                });
                needsPermission = action === "ask";
                matched = true;
                break;
              }
            }

            // If no pattern matched, default to ask
            if (!matched) {
              needsPermission = true;
            }

            // If any command needs permission, we need to ask
            if (needsPermission) break;
          }
        }
      }
    }

    // Ask for permission if needed
    if (needsPermission) {
      await Permission.ask({
        type: "bash",
        pattern: params.command.split(" ").slice(0, 2).join(" ").trim(),
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
    
    const stdoutPromise = text(process.stdout!);
    const stderrPromise = text(process.stderr!);
    
    let exitCode: number | null = null;
    await new Promise<void>((resolve) => {
      process.on("close", (code) => {
        exitCode = code;
        resolve();
      });
    });
    
    const stdout = await stdoutPromise;
    const stderr = await stderrPromise;

    return {
      title: params.command,
      metadata: {
        stderr,
        stdout,
        exit: exitCode,
        description: params.description,
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
