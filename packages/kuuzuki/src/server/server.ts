import { Log } from "../util/log"
import { Bus } from "../bus"
import { describeRoute, generateSpecs, openAPISpecs } from "hono-openapi"
import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { Session } from "../session"
import { resolver, validator as zValidator } from "hono-openapi/zod"
import { z } from "zod"
import { Provider } from "../provider/provider"
import { App } from "../app/app"
import { mapValues } from "remeda"
import { NamedError } from "../util/error"
import { ModelsDev } from "../provider/models"
import { Ripgrep } from "../file/ripgrep"
import { Config } from "../config/config"
import { File } from "../file"
import { LSP } from "../lsp"
import { MessageV2 } from "../session/message-v2"
import { Mode } from "../session/mode"
import { callTui, TuiRoute } from "./tui"
import { Monitor, Cache } from "../performance"
import { webhookHandler } from "./billing"

const ERRORS = {
  400: {
    description: "Bad request",
    content: {
      "application/json": {
        schema: resolver(
          z
            .object({
              data: z.record(z.string(), z.any()),
            })
            .openapi({
              ref: "Error",
            }),
        ),
      },
    },
  },
} as const

export namespace Server {
  const log = Log.create({ service: "server" })

  export type Routes = ReturnType<typeof app>

  function app() {
    const app = new Hono()

    const result = app
      .onError((err, c) => {
        // Enhanced error logging for debugging
        log.error("Request error", {
          error: err,
          path: c.req.path,
          method: c.req.method,
          errorMessage: err.message,
          errorStack: err.stack,
        })
        
        if (err instanceof NamedError) {
          return c.json(err.toObject(), {
            status: 400,
          })
        }
        return c.json(new NamedError.Unknown({ message: err.toString() }).toObject(), {
          status: 400,
        })
      })
      .use(async (c, next) => {
        const skipLogging = c.req.path === "/log"
        if (!skipLogging) {
          log.info("request", {
            method: c.req.method,
            path: c.req.path,
          })
        }
        const start = Date.now()
        await next()
        const duration = Date.now() - start

        // Record performance metrics
        Monitor.Performance.recordRequestTime(duration)

        if (!skipLogging) {
          log.info("response", {
            duration,
          })
        }
      })
      .get(
        "/doc",
        openAPISpecs(app, {
          documentation: {
            info: {
              title: "kuuzuki",
              version: "0.0.3",
              description: "kuuzuki api",
            },
            openapi: "3.0.0",
          },
        }),
      )
      .get(
        "/event",
        describeRoute({
          description: "Get events",
          responses: {
            200: {
              description: "Event stream",
              content: {
                "application/json": {
                  schema: resolver(
                    Bus.payloads().openapi({
                      ref: "Event",
                    }),
                  ),
                },
              },
            },
          },
        }),
        async (c) => {
          log.info("event connected")
          return streamSSE(c, async (stream) => {
            stream.writeSSE({
              data: JSON.stringify({}),
            })
            const unsub = Bus.subscribeAll(async (event) => {
              await stream.writeSSE({
                data: JSON.stringify(event),
              })
            })
            await new Promise<void>((resolve) => {
              stream.onAbort(() => {
                unsub()
                resolve()
                log.info("event disconnected")
              })
            })
          })
        },
      )
      .get(
        "/app",
        describeRoute({
          description: "Get app info",
          responses: {
            200: {
              description: "200",
              content: {
                "application/json": {
                  schema: resolver(App.Info),
                },
              },
            },
          },
        }),
        async (c) => {
          return c.json(App.info())
        },
      )
      .post(
        "/app/init",
        describeRoute({
          description: "Initialize the app",
          responses: {
            200: {
              description: "Initialize the app",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        async (c) => {
          await App.initialize()
          return c.json(true)
        },
      )
      .get(
        "/config",
        describeRoute({
          description: "Get config info",
          responses: {
            200: {
              description: "Get config info",
              content: {
                "application/json": {
                  schema: resolver(Config.Info),
                },
              },
            },
          },
        }),
        async (c) => {
          return c.json(await Config.get())
        },
      )
      .get(
        "/session",
        describeRoute({
          description: "List all sessions",
          responses: {
            200: {
              description: "List of sessions",
              content: {
                "application/json": {
                  schema: resolver(Session.Info.array()),
                },
              },
            },
          },
        }),
        async (c) => {
          const sessions = await Array.fromAsync(Session.list())
          sessions.sort((a, b) => b.time.updated - a.time.updated)
          return c.json(sessions)
        },
      )
      .post(
        "/session",
        describeRoute({
          description: "Create a new session",
          responses: {
            ...ERRORS,
            200: {
              description: "Successfully created session",
              content: {
                "application/json": {
                  schema: resolver(Session.Info),
                },
              },
            },
          },
        }),
        async (c) => {
          const session = await Session.create()
          return c.json(session)
        },
      )
      .delete(
        "/session/:id",
        describeRoute({
          description: "Delete a session and all its data",
          responses: {
            200: {
              description: "Successfully deleted session",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          }),
        ),
        async (c) => {
          await Session.remove(c.req.valid("param").id)
          return c.json(true)
        },
      )
      .post(
        "/session/:id/init",
        describeRoute({
          description: "Analyze the app and create an AGENTS.md file",
          responses: {
            200: {
              description: "200",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string().openapi({ description: "Session ID" }),
          }),
        ),
        zValidator(
          "json",
          z.object({
            messageID: z.string(),
            providerID: z.string(),
            modelID: z.string(),
          }),
        ),
        async (c) => {
          const sessionID = c.req.valid("param").id
          const body = c.req.valid("json")
          await Session.initialize({ 
            sessionID,
            messageID: body.messageID,
            providerID: body.providerID,
            modelID: body.modelID
          })
          return c.json(true)
        },
      )
      .post(
        "/session/:id/abort",
        describeRoute({
          description: "Abort a session",
          responses: {
            200: {
              description: "Aborted session",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          }),
        ),
        async (c) => {
          return c.json(Session.abort(c.req.valid("param").id))
        },
      )
      .post(
        "/session/:id/share",
        describeRoute({
          description: "Share a session",
          responses: {
            200: {
              description: "Successfully shared session",
              content: {
                "application/json": {
                  schema: resolver(Session.Info),
                },
              },
            },
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          }),
        ),
        async (c) => {
          const id = c.req.valid("param").id
          await Session.share(id)
          const session = await Session.get(id)
          return c.json(session)
        },
      )
      .delete(
        "/session/:id/share",
        describeRoute({
          description: "Unshare the session",
          responses: {
            200: {
              description: "Successfully unshared session",
              content: {
                "application/json": {
                  schema: resolver(Session.Info),
                },
              },
            },
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          }),
        ),
        async (c) => {
          const id = c.req.valid("param").id
          await Session.unshare(id)
          const session = await Session.get(id)
          return c.json(session)
        },
      )
      .post(
        "/session/:id/summarize",
        describeRoute({
          description: "Summarize the session",
          responses: {
            200: {
              description: "Summarized session",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string().openapi({ description: "Session ID" }),
          }),
        ),
        zValidator(
          "json",
          z.object({
            providerID: z.string(),
            modelID: z.string(),
          }),
        ),
        async (c) => {
          const id = c.req.valid("param").id
          const body = c.req.valid("json")
          await Session.summarize({ 
            sessionID: id,
            providerID: body.providerID,
            modelID: body.modelID
          })
          return c.json(true)
        },
      )
      .get(
        "/session/:id/message",
        describeRoute({
          description: "List messages for a session",
          responses: {
            200: {
              description: "List of messages",
              content: {
                "application/json": {
                  schema: resolver(
                    z
                      .object({
                        info: MessageV2.Info,
                        parts: MessageV2.Part.array(),
                      })
                      .array(),
                  ),
                },
              },
            },
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string().openapi({ description: "Session ID" }),
          }),
        ),
        async (c) => {
          const messages = await Session.messages(c.req.valid("param").id)
          return c.json(messages)
        },
      )
      .post(
        "/session/:id/message",
        describeRoute({
          description: "Create and send a new message to a session",
          responses: {
            200: {
              description: "Created message",
              content: {
                "application/json": {
                  schema: resolver(MessageV2.Assistant),
                },
              },
            },
          },
        }),
        // Add raw body logging middleware
        async (c, next) => {
          try {
            const rawBody = await c.req.text()
            log.info("Raw chat request body", {
              path: c.req.path,
              rawBody,
              contentType: c.req.header("content-type"),
            })
            // Restore body for subsequent middleware
            c.req.raw = new Request(c.req.raw.url, {
              ...c.req.raw,
              body: rawBody,
              headers: c.req.raw.headers,
            })
          } catch (e) {
            log.error("Failed to log raw body", { error: e })
          }
          await next()
        },
        zValidator(
          "param",
          z.object({
            id: z.string().openapi({ description: "Session ID" }),
          }),
        ),
        zValidator("json", Session.ChatInput.omit({ sessionID: true })),
        async (c) => {
          const sessionID = c.req.valid("param").id
          const body = c.req.valid("json")
          
          // Debug logging for chat request
          log.info("Chat request received", {
            sessionID,
            body: JSON.stringify(body),
            bodyKeys: Object.keys(body),
            partsCount: body.parts?.length,
            firstPartType: body.parts?.[0]?.type,
          })
          
          const msg = await Session.chat({ ...body, sessionID })
          return c.json(msg)
        },
      )
      .post(
        "/session/:id/revert",
        describeRoute({
          description: "Revert a message",
          responses: {
            200: {
              description: "Updated session",
              content: {
                "application/json": {
                  schema: resolver(Session.Info),
                },
              },
            },
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          }),
        ),
        zValidator("json", Session.RevertInput.omit({ sessionID: true })),
        async (c) => {
          const id = c.req.valid("param").id
          log.info("revert", c.req.valid("json"))
          const session = await Session.revert({ sessionID: id, ...c.req.valid("json") })
          return c.json(session)
        },
      )
      .post(
        "/session/:id/unrevert",
        describeRoute({
          description: "Restore all reverted messages",
          responses: {
            200: {
              description: "Updated session",
              content: {
                "application/json": {
                  schema: resolver(Session.Info),
                },
              },
            },
          },
        }),
        zValidator(
          "param",
          z.object({
            id: z.string(),
          }),
        ),
        async (c) => {
          const id = c.req.valid("param").id
          const session = await Session.unrevert({ sessionID: id })
          return c.json(session)
        },
      )
      .get(
        "/config/providers",
        describeRoute({
          description: "List all providers",
          responses: {
            200: {
              description: "List of providers",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      providers: ModelsDev.Provider.array(),
                      default: z.record(z.string(), z.string()),
                    }),
                  ),
                },
              },
            },
          },
        }),
        async (c) => {
          const providers = await Provider.list().then((x) => mapValues(x, (item) => item.info))
          return c.json({
            providers: Object.values(providers),
            default: mapValues(providers, (item) => Provider.sort(Object.values(item.models))[0].id),
          })
        },
      )
      .get(
        "/find",
        describeRoute({
          description: "Find text in files",
          responses: {
            200: {
              description: "Matches",
              content: {
                "application/json": {
                  schema: resolver(Ripgrep.Match.shape.data.array()),
                },
              },
            },
          },
        }),
        zValidator(
          "query",
          z.object({
            pattern: z.string(),
          }),
        ),
        async (c) => {
          const app = App.info()
          const pattern = c.req.valid("query").pattern
          const result = await Ripgrep.search({
            cwd: app.path.cwd,
            pattern,
            limit: 10,
          })
          return c.json(result)
        },
      )
      .get(
        "/find/file",
        describeRoute({
          description: "Find files",
          responses: {
            200: {
              description: "File paths",
              content: {
                "application/json": {
                  schema: resolver(z.string().array()),
                },
              },
            },
          },
        }),
        zValidator(
          "query",
          z.object({
            query: z.string(),
          }),
        ),
        async (c) => {
          const query = c.req.valid("query").query
          const app = App.info()
          const result = await Ripgrep.files({
            cwd: app.path.cwd,
            query,
            limit: 10,
          })
          return c.json(result)
        },
      )
      .get(
        "/find/symbol",
        describeRoute({
          description: "Find workspace symbols",
          responses: {
            200: {
              description: "Symbols",
              content: {
                "application/json": {
                  schema: resolver(LSP.Symbol.array()),
                },
              },
            },
          },
        }),
        zValidator(
          "query",
          z.object({
            query: z.string(),
          }),
        ),
        async (c) => {
          const query = c.req.valid("query").query
          const result = await LSP.workspaceSymbol(query)
          return c.json(result)
        },
      )
      .get(
        "/file",
        describeRoute({
          description: "Read a file",
          responses: {
            200: {
              description: "File content",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      type: z.enum(["raw", "patch"]),
                      content: z.string(),
                    }),
                  ),
                },
              },
            },
          },
        }),
        zValidator(
          "query",
          z.object({
            path: z.string(),
          }),
        ),
        async (c) => {
          const path = c.req.valid("query").path
          const content = await File.read(path)
          log.info("read file", {
            path,
            content: content.content,
          })
          return c.json(content)
        },
      )
      .get(
        "/file/status",
        describeRoute({
          description: "Get file status",
          responses: {
            200: {
              description: "File status",
              content: {
                "application/json": {
                  schema: resolver(File.Info.array()),
                },
              },
            },
          },
        }),
        async (c) => {
          const content = await File.status()
          return c.json(content)
        },
      )
      .post(
        "/log",
        describeRoute({
          description: "Write a log entry to the server logs",
          responses: {
            200: {
              description: "Log entry written successfully",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        zValidator(
          "json",
          z.object({
            service: z.string().openapi({ description: "Service name for the log entry" }),
            level: z.enum(["debug", "info", "error", "warn"]).openapi({ description: "Log level" }),
            message: z.string().openapi({ description: "Log message" }),
            extra: z
              .record(z.string(), z.any())
              .optional()
              .openapi({ description: "Additional metadata for the log entry" }),
          }),
        ),
        async (c) => {
          const { service, level, message, extra } = c.req.valid("json")
          const logger = Log.create({ service })

          switch (level) {
            case "debug":
              logger.debug(message, extra)
              break
            case "info":
              logger.info(message, extra)
              break
            case "error":
              logger.error(message, extra)
              break
            case "warn":
              logger.warn(message, extra)
              break
          }

          return c.json(true)
        },
      )
      .get(
        "/mode",
        describeRoute({
          description: "List all modes",
          responses: {
            200: {
              description: "List of modes",
              content: {
                "application/json": {
                  schema: resolver(Mode.Info.array()),
                },
              },
            },
          },
        }),
        async (c) => {
          return App.provide({ cwd: process.cwd() }, async () => {
            const modes = await Mode.list()
            return c.json(modes)
          })
        },
      )
      .post(
        "/tui/append-prompt",
        describeRoute({
          description: "Append prompt to the TUI",
          responses: {
            200: {
              description: "Prompt processed successfully",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        zValidator(
          "json",
          z.object({
            text: z.string(),
          }),
        ),
        async (c) => c.json(await callTui(c)),
      )
      .post(
        "/tui/open-help",
        describeRoute({
          description: "Open the help dialog",
          responses: {
            200: {
              description: "Help dialog opened successfully",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
          },
        }),
        async (c) => c.json(await callTui(c)),
      )
      .route("/tui/control", TuiRoute)
      .post(
        "/billing/webhook",
        describeRoute({
          description: "Handle Stripe billing webhooks",
          responses: {
            200: {
              description: "Webhook processed successfully",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      received: z.boolean(),
                    }),
                  ),
                },
              },
            },
            400: {
              description: "Bad request - invalid signature or missing headers",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      error: z.string(),
                    }),
                  ),
                },
              },
            },
            500: {
              description: "Internal server error",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      error: z.string(),
                    }),
                  ),
                },
              },
            },
          },
        }),
        webhookHandler,
      )
      .get(
        "/health",
        describeRoute({
          description: "Health check endpoint",
          responses: {
            200: {
              description: "Server is healthy",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      status: z.literal("ok"),
                      timestamp: z.string(),
                      version: z.string().optional(),
                    }),
                  ),
                },
              },
            },
          },
        }),
        async (c) => {
          return c.json({
            status: "ok" as const,
            timestamp: new Date().toISOString(),
            version: process.env["KUUZUKI_VERSION"] || "dev",
          })
        },
      )
      .get(
        "/performance",
        describeRoute({
          description: "Get performance metrics and statistics",
          responses: {
            200: {
              description: "Performance statistics",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      monitor: z.any(),
                      cache: z.any(),
                      optimizer: z.any(),
                    }),
                  ),
                },
              },
            },
          },
        }),
        async (c) => {
          try {
            const stats = {
              monitor: Monitor.getStats(),
              cache: Cache.getStats(),
              optimizer: { uptime: Date.now() - Date.now() }, // Placeholder
            }
            return c.json(stats)
          } catch (error) {
            log.error("Failed to get performance stats", error as Error)
            return c.json({ error: "Failed to get performance stats" }, 500)
          }
        },
      )

    return result
  }

  export async function openapi() {
    const a = app()
    const result = await generateSpecs(a, {
      documentation: {
        info: {
          title: "kuuzuki",
          version: "1.0.0",
          description: "kuuzuki api",
        },
        openapi: "3.0.0",
      },
    })
    return result
  }

  export function listen(opts: { port: number; hostname: string }) {
    const server = Bun.serve({
      port: opts.port,
      hostname: opts.hostname,
      idleTimeout: 0,
      fetch: app().fetch,
    })
    return server
  }
}
