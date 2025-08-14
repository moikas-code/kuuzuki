import { experimental_createMCPClient, type Tool } from "ai";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { App } from "../app/app";
import { Config } from "../config/config";
import { Log } from "../util/log";
import { NamedError } from "../util/error";
import { z } from "zod";
import { Session } from "../session";
import { Bus } from "../bus";

export namespace MCP {
  const log = Log.create({ service: "mcp" });

  export const Failed = NamedError.create(
    "MCPFailed",
    z.object({
      name: z.string(),
    }),
  );

  const state = App.state(
    "mcp",
    async () => {
      const cfg = await Config.get();
      const clients: {
        [name: string]: Awaited<
          ReturnType<typeof experimental_createMCPClient>
        >;
      } = {};
      for (const [key, mcpConfig] of Object.entries(cfg.mcp ?? {})) {
        // Type assertion to ensure mcpConfig conforms to expected MCP config structure
        const mcp = mcpConfig as {
          enabled?: boolean;
          type: "remote" | "local";
          url?: string;
          headers?: Record<string, string>;
          command?: string[];
          environment?: Record<string, string>;
        };

        if (mcp.enabled === false) {
          log.info("mcp server disabled", { key });
          continue;
        }
        log.info("found", { key, type: mcp.type });
        if (mcp.type === "remote") {
          const transports = [
            new StreamableHTTPClientTransport(new URL(mcp.url!), {
              requestInit: {
                headers: mcp.headers,
              },
            }),
            new SSEClientTransport(new URL(mcp.url!), {
              requestInit: {
                headers: mcp.headers,
              },
            }),
          ];
          for (const transport of transports) {
            const client = await experimental_createMCPClient({
              name: key,
              transport,
            }).catch(() => {});
            if (!client) continue;
            clients[key] = client;
            break;
          }
          if (!clients[key])
            Bus.publish(Session.Event.Error, {
              error: {
                name: "UnknownError",
                data: {
                  message: `MCP server ${key} failed to start`,
                },
              },
            });
        }

        if (mcp.type === "local") {
          const [cmd, ...args] = mcp.command!;

          // Add timeout for MCP client creation
          const timeoutMs = 10000; // 10 seconds timeout
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error(`MCP server ${key} initialization timed out`));
            }, timeoutMs);
          });

          try {
            const client = await Promise.race([
              experimental_createMCPClient({
                name: key,
                transport: new StdioClientTransport({
                  stderr: "ignore",
                  command: cmd,
                  args,
                  env: {
                    ...process.env,
                    ...(cmd === "kuuzuki" ? { BUN_BE_BUN: "1" } : {}),
                    ...mcp.environment,
                  },
                }),
              }),
              timeoutPromise,
            ]);

            clients[key] = client;
            log.info("MCP server started successfully", { key });
          } catch (error) {
            log.warn("MCP server failed to start", {
              key,
              error: error.message,
            });
            Bus.publish(Session.Event.Error, {
              error: {
                name: "UnknownError",
                data: {
                  message: `MCP server ${key} failed to start: ${error.message}`,
                },
              },
            });
            continue;
          }
        }
      }

      return {
        clients,
      };
    },
    async (state) => {
      for (const client of Object.values(state.clients)) {
        client.close();
      }
    },
  );

  export async function clients() {
    return state().then((state) => state.clients);
  }

  export async function tools() {
    const result: Record<string, Tool> = {};
    for (const [clientName, client] of Object.entries(await clients())) {
      for (const [toolName, tool] of Object.entries(await client.tools())) {
        const sanitizedClientName = clientName.replace(/\s+/g, "_");
        const sanitizedToolName = toolName.replace(/[-\s]+/g, "_");
        const fullToolName = `${sanitizedClientName}_${sanitizedToolName}`;
        result[fullToolName] = tool;
      }
    }
    return result;
  }

  /**
   * Sanitize tool names for consistency and compatibility
   * - Replace spaces and special characters with underscores
   * - Convert to lowercase for consistency
   * - Remove consecutive underscores
   * - Ensure valid identifier format
   */
  function sanitizeToolName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_") // Replace non-alphanumeric chars with underscore
      .replace(/_+/g, "_") // Replace consecutive underscores with single
      .replace(/^_|_$/g, ""); // Remove leading/trailing underscores
  }
}
