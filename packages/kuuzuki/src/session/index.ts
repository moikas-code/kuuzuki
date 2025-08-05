import path from "path";
import { Decimal } from "decimal.js";
import { z, ZodSchema } from "zod";
import {
  generateText,
  LoadAPIKeyError,
  NoSuchToolError,
  streamText,
  tool,
  wrapLanguageModel,
  type Tool as AITool,
  type LanguageModelUsage,
  type ProviderMetadata,
  type ModelMessage,
  stepCountIs,
  type StreamTextResult,
} from "ai";

import PROMPT_INITIALIZE from "../session/prompt/initialize.txt";
import { LegacyFiles } from "../config/legacy";
import PROMPT_PLAN from "../session/prompt/plan.txt";
import PROMPT_CHAT from "../session/prompt/chat.txt";

import { App } from "../app/app";
import { Bus } from "../bus";
import { Config } from "../config/config";
import {
  checkSubscription,
  showSubscriptionPrompt,
} from "../auth/subscription";
import { Flag } from "../flag/flag";
import { Identifier } from "../id/id";
import { Installation } from "../installation";
import { MCP } from "../mcp";
import { Provider } from "../provider/provider";
import { ProviderTransform } from "../provider/transform";
import type { ModelsDev } from "../provider/models";
import { Share } from "../share/share";
import { Snapshot } from "../snapshot";
import { Storage } from "../storage/storage";
import { Log } from "../util/log";
import { NamedError } from "../util/error";
import { SystemPrompt } from "./system";
import { FileTime } from "../file/time";
import { MessageV2 } from "./message-v2";
import { Mode } from "./mode";
import { LSP } from "../lsp";
import { ReadTool } from "../tool/read";
import { mergeDeep, pipe, splitWhen } from "remeda";
import { ToolRegistry } from "../tool/registry";
import { ToolInterceptor } from "../tool/interceptor";
import { ToolAnalytics } from "../tool/analytics";
import { ToolResolver } from "../tool/resolver";
import { validateSessionID, validateMessageID } from "../util/id-validation";
import { Plugin } from "../plugin";

export namespace Session {
  const log = Log.create({ service: "session" });

  const OUTPUT_TOKEN_MAX = 32_000;

  // Message validation utility to prevent empty message arrays
  function validateMessages(
    messages: ModelMessage[],
    context: string,
    sessionID?: string,
  ): ModelMessage[] {
    if (!messages || messages.length === 0) {
      log.error("Empty messages array detected", {
        context,
        sessionID,
        stackTrace: new Error().stack,
        timestamp: new Date().toISOString(),
      });

      // Return minimal valid message to prevent API crash
      return [
        {
          role: "user" as const,
          content: "Please help me with my request.",
        },
      ];
    }

    // Log message array info for debugging
    log.debug("Message validation passed", {
      context,
      sessionID,
      messageCount: messages.length,
      roles: messages.map((m) => m.role),
      hasContent: messages.every(
        (m) =>
          m.content &&
          (typeof m.content === "string"
            ? m.content.length > 0
            : m.content.length > 0),
      ),
    });

    return messages;
  }

  /**
   * Estimates token count for text content
   * Uses rough approximation: 1 token ≈ 4 characters for English text
   */
  function estimateTokens(text: string): number {
    if (!text) return 0;
    // More accurate estimation accounting for whitespace and punctuation
    return Math.ceil(text.length / 3.5);
  }

  /**
   * Estimates total tokens for a request before sending to AI
   */
  async function estimateRequestTokens(
    msgs: { info: MessageV2.Info; parts: MessageV2.Part[] }[],
    newUserInput: MessageV2.Part[],
    systemPrompts: string[],
  ): Promise<number> {
    let totalTokens = 0;

    // Count existing messages
    for (const msg of msgs) {
      // Convert to model message format to get accurate representation
      const modelMsgs = MessageV2.toModelMessage([msg]);
      for (const modelMsg of modelMsgs) {
        if (typeof modelMsg.content === "string") {
          totalTokens += estimateTokens(modelMsg.content);
        } else if (Array.isArray(modelMsg.content)) {
          for (const part of modelMsg.content) {
            if (part.type === "text") {
              totalTokens += estimateTokens(part.text);
            }
          }
        }
      }
    }

    // Count new user input
    for (const part of newUserInput) {
      if (part.type === "text") {
        totalTokens += estimateTokens(part.text);
      }
    }

    // Count system prompts
    totalTokens += estimateTokens(systemPrompts.join("\n"));

    // Add buffer for tool calls, formatting, JSON structure, etc.
    return Math.ceil(totalTokens * 1.25);
  }

  export const Info = z
    .object({
      id: Identifier.schema("session"),
      parentID: Identifier.schema("session").optional(),
      share: z
        .object({
          url: z.string(),
        })
        .optional(),
      title: z.string(),
      version: z.string(),
      time: z.object({
        created: z.number(),
        updated: z.number(),
      }),
      revert: z
        .object({
          messageID: z.string(),
          partID: z.string().optional(),
          snapshot: z.string().optional(),
        })
        .optional(),
    })
    .openapi({
      ref: "Session",
    });
  export type Info = z.output<typeof Info>;

  export const ShareInfo = z
    .object({
      secret: z.string(),
      url: z.string(),
    })
    .openapi({
      ref: "SessionShare",
    });
  export type ShareInfo = z.output<typeof ShareInfo>;

  export const Event = {
    Updated: Bus.event(
      "session.updated",
      z.object({
        info: Info,
      }),
    ),
    Deleted: Bus.event(
      "session.deleted",
      z.object({
        info: Info,
      }),
    ),
    Idle: Bus.event(
      "session.idle",
      z.object({
        sessionID: z.string(),
      }),
    ),
    Error: Bus.event(
      "session.error",
      z.object({
        sessionID: z.string().optional(),
        error: MessageV2.Assistant.shape.error,
      }),
    ),
  };

  const state = App.state(
    "session",
    () => {
      const sessions = new Map<string, Info>();
      const messages = new Map<string, MessageV2.Info[]>();
      const pending = new Map<string, AbortController>();
      const queued = new Map<
        string,
        {
          input: ChatInput;
          message: MessageV2.User;
          parts: MessageV2.Part[];
          processed: boolean;
          callback: (input: {
            info: MessageV2.Assistant;
            parts: MessageV2.Part[];
          }) => void;
        }[]
      >();

      // Track recent summarizations to prevent multiple summarizations
      const recentSummarizations = new Map<string, number>(); // sessionID -> timestamp

      return {
        sessions,
        messages,
        pending,
        queued,
        recentSummarizations,
      };
    },
    async (state) => {
      for (const [_, controller] of state.pending) {
        controller.abort();
      }
    },
  );

  export async function create(parentID?: string) {
    const result: Info = {
      id: Identifier.descending("session"),
      version: Installation.VERSION,
      parentID,
      title:
        (parentID ? "Child session - " : "New Session - ") +
        new Date().toISOString(),
      time: {
        created: Date.now(),
        updated: Date.now(),
      },
    };
    log.info("created", result);
    state().sessions.set(result.id, result);
    await Storage.writeJSON("session/info/" + result.id, result);
    const cfg = await Config.get();
    if (!result.parentID && (Flag.KUUZUKI_AUTO_SHARE || cfg.share === "auto"))
      share(result.id)
        .then((share) => {
          update(result.id, (draft) => {
            draft.share = share;
          });
        })
        .catch(() => {
          // Silently ignore sharing errors during session creation
        });
    Bus.publish(Event.Updated, {
      info: result,
    });
    return result;
  }

  export async function get(id: string) {
    const validId = validateSessionID(id);
    const result = state().sessions.get(validId);
    if (result) {
      return result;
    }
    const read = await Storage.readJSON<Info>("session/info/" + validId);
    state().sessions.set(validId, read);
    return read as Info;
  }

  export async function getShare(id: string) {
    const validId = validateSessionID(id);
    return Storage.readJSON<ShareInfo>("session/share/" + validId);
  }

  export async function share(id: string) {
    const validId = validateSessionID(id);
    const cfg = await Config.get();
    if (cfg.share === "disabled") {
      throw new Error("Sharing is disabled in configuration");
    }

    // Check subscription status
    const subscription = await checkSubscription();
    if (!subscription.hasSubscription) {
      showSubscriptionPrompt();
      throw new Error(
        subscription.message || "Kuuzuki Pro subscription required for sharing",
      );
    }

    const session = await get(validId);
    if (session.share) {
      // If already shared, get the full ShareInfo from storage
      const shareInfo = await Storage.readJSON<ShareInfo>(
        "session/share/" + validId,
      );
      if (shareInfo) {
        return shareInfo;
      }
      // If shareInfo is missing, fall through to create a new one
    }
    const share = await Share.create(validId);

    // Validate that we received a valid secret
    if (!share.secret || share.secret.trim() === "") {
      throw new Error("Session share failed: empty secret key received");
    }

    await update(id, (draft) => {
      draft.share = {
        url: share.url,
      };
    });
    await Storage.writeJSON<ShareInfo>("session/share/" + id, share);
    await Share.sync("session/info/" + id, session);
    for (const msg of await messages(id)) {
      await Share.sync("session/message/" + id + "/" + msg.info.id, msg.info);
      for (const part of msg.parts) {
        await Share.sync(
          "session/part/" + id + "/" + msg.info.id + "/" + part.id,
          part,
        );
      }
    }
    return share;
  }

  export async function unshare(id: string) {
    const share = await getShare(id);
    if (!share) return;
    await Storage.remove("session/share/" + id);
    await update(id, (draft) => {
      draft.share = undefined;
    });
    await Share.remove(id, share.secret);
  }

  export async function update(id: string, editor: (session: Info) => void) {
    const { sessions } = state();
    const session = await get(id);
    if (!session) return;
    editor(session);
    session.time.updated = Date.now();
    sessions.set(id, session);
    await Storage.writeJSON("session/info/" + id, session);
    Bus.publish(Event.Updated, {
      info: session,
    });
    return session;
  }

  export async function messages(sessionID: string) {
    const validSessionID = validateSessionID(sessionID);
    const result = [] as {
      info: MessageV2.Info;
      parts: MessageV2.Part[];
    }[];
    for (const p of await Storage.list("session/message/" + validSessionID)) {
      const read = await Storage.readJSON<MessageV2.Info>(p);
      result.push({
        info: read,
        parts: await getParts(validSessionID, read.id),
      });
    }
    result.sort((a, b) => (a.info.id > b.info.id ? 1 : -1));
    return result;
  }

  export async function getMessage(sessionID: string, messageID: string) {
    return Storage.readJSON<MessageV2.Info>(
      "session/message/" + sessionID + "/" + messageID,
    );
  }

  export async function getParts(sessionID: string, messageID: string) {
    const result = [] as MessageV2.Part[];
    for (const item of await Storage.list(
      "session/part/" + sessionID + "/" + messageID,
    )) {
      const read = await Storage.readJSON<MessageV2.Part>(item);
      result.push(read);
    }
    result.sort((a, b) => (a.id > b.id ? 1 : -1));
    return result;
  }

  export async function* list() {
    for (const item of await Storage.list("session/info")) {
      const sessionID = path.basename(item, ".json");
      yield get(sessionID);
    }
  }

  export async function children(parentID: string) {
    const result = [] as Info[];
    for (const item of await Storage.list("session/info")) {
      const sessionID = path.basename(item, ".json");
      const session = await get(sessionID);
      if (session.parentID !== parentID) continue;
      result.push(session);
    }
    return result;
  }

  export function abort(sessionID: string) {
    const controller = state().pending.get(sessionID);
    if (!controller) return false;
    controller.abort();
    state().pending.delete(sessionID);
    return true;
  }

  export async function remove(sessionID: string, emitEvent = true) {
    try {
      abort(sessionID);
      const session = await get(sessionID);
      for (const child of await children(sessionID)) {
        await remove(child.id, false);
      }
      // Critical cleanup operations - log failures but continue cleanup
      try {
        await unshare(sessionID);
      } catch (error) {
        log.error("Failed to unshare session during removal", {
          sessionID,
          error,
        });
      }

      try {
        await Storage.remove(`session/info/${sessionID}`);
      } catch (error) {
        log.error("Failed to remove session info from storage", {
          sessionID,
          error,
        });
      }

      try {
        await Storage.removeDir(`session/message/${sessionID}/`);
      } catch (error) {
        log.error("Failed to remove session messages from storage", {
          sessionID,
          error,
        });
      }
      state().sessions.delete(sessionID);
      state().messages.delete(sessionID);
      if (emitEvent) {
        Bus.publish(Event.Deleted, {
          info: session,
        });
      }
    } catch (e) {
      log.error(e);
    }
  }

  export async function updateMessage(msg: MessageV2.Info) {
    await Storage.writeJSON(
      "session/message/" + msg.sessionID + "/" + msg.id,
      msg,
    );
    Bus.publish(MessageV2.Event.Updated, {
      info: msg,
    });
  }

  export async function updatePart(part: MessageV2.Part) {
    await Storage.writeJSON(
      ["session", "part", part.sessionID, part.messageID, part.id].join("/"),
      part,
    );
    Bus.publish(MessageV2.Event.PartUpdated, {
      part,
    });
    return part;
  }

  export const ChatInput = z.object({
    sessionID: Identifier.schema("session"),
    messageID: Identifier.schema("message").optional(),
    providerID: z.string(),
    modelID: z.string(),
    mode: z.string().optional(),
    system: z.string().optional(),
    tools: z.record(z.boolean()).optional(),
    parts: z.array(
      z.discriminatedUnion("type", [
        MessageV2.TextPart.omit({
          messageID: true,
          sessionID: true,
        })
          .partial({
            id: true,
          })
          .openapi({
            ref: "TextPartInput",
          }),
        MessageV2.FilePart.omit({
          messageID: true,
          sessionID: true,
        })
          .partial({
            id: true,
          })
          .openapi({
            ref: "FilePartInput",
          }),
      ]),
    ),
  });
  export type ChatInput = z.infer<typeof ChatInput>;

  /**
   * Add fallback tools for common missing tool patterns
   */
  function addFallbackTools(
    tools: Record<string, AITool>,
    availableToolNames: Set<string>,
    processor: any,
  ) {
    const commonMissingTools = [
      "kb_read",
      "kb_search",
      "kb_update",
      "kb_create",
      "kb_delete",
      "kb_status",
      "kb_issues",
      "kb_list",
      "kb",
      "moidvk_check_code_practices",
      "moidvk_format_code",
    ];

    for (const missingTool of commonMissingTools) {
      if (availableToolNames.has(missingTool)) continue;

      const resolution = ToolInterceptor.intercept(
        { name: missingTool, parameters: {} },
        availableToolNames,
      );

      if (resolution.success && resolution.resolvedCall) {
        // Create an alias tool that redirects to the resolved tool
        const resolvedToolName = resolution.resolvedCall.name;
        const resolvedTool = tools[resolvedToolName];

        if (resolvedTool) {
          tools[missingTool] = tool({
            id: missingTool as any,
            description: `Fallback for ${missingTool} - redirects to ${resolvedToolName}`,
            inputSchema: resolvedTool.inputSchema,
            async execute(args, options) {
              log.info(`Redirecting ${missingTool} to ${resolvedToolName}`, {
                args,
              });
              return await resolvedTool.execute(args, options);
            },
          });
          log.info(
            `Added fallback tool: ${missingTool} -> ${resolvedToolName}`,
          );
          ToolAnalytics.recordResolution(
            missingTool,
            true,
            "fallback-redirect",
            resolvedToolName,
          );
        }
      } else if (
        resolution.alternatives &&
        resolution.alternatives.length > 0
      ) {
        // Create a fallback tool that suggests alternatives
        tools[missingTool] = tool({
          id: missingTool as any,
          description: `Fallback for ${missingTool} - provides alternative suggestions`,
          inputSchema: z.object({}).passthrough(),
          async execute(args, options) {
            await processor.track(options.toolCallId);

            const errorMessage = ToolInterceptor.createErrorMessage(
              missingTool,
              {
                success: false,
                alternatives: resolution.alternatives,
              },
            );

            return {
              output: errorMessage,
              title: `Tool ${missingTool} not available`,
              metadata: {
                fallback: true,
                alternatives: resolution.alternatives,
              },
            };
          },
        });
        log.info(`Added alternative suggestion tool: ${missingTool}`);
        ToolAnalytics.recordResolution(
          missingTool,
          false,
          "fallback-suggestion",
        );
      }
    }
  }

  export async function chat(
    input: z.infer<typeof ChatInput>,
  ): Promise<{ info: MessageV2.Assistant; parts: MessageV2.Part[] }> {
    const l = log.clone().tag("session", input.sessionID);
    l.info("chatting");

    const inputMode = input.mode ?? "build";
    const userMsg: MessageV2.Info = {
      id: input.messageID ?? Identifier.ascending("message"),
      role: "user",
      sessionID: input.sessionID,
      time: {
        created: Date.now(),
      },
    };

    const app = App.info();
    const userParts = await Promise.all(
      input.parts.map(async (part): Promise<MessageV2.Part[]> => {
        if (part.type === "file") {
          const url = new URL(part.url);
          switch (url.protocol) {
            case "data:":
              if (part.mime === "text/plain") {
                return [
                  {
                    id: Identifier.ascending("part"),
                    messageID: userMsg.id,
                    sessionID: input.sessionID,
                    type: "text",
                    synthetic: true,
                    text: `Called the Read tool with the following input: ${JSON.stringify({ filePath: part.filename })}`,
                  },
                  {
                    id: Identifier.ascending("part"),
                    messageID: userMsg.id,
                    sessionID: input.sessionID,
                    type: "text",
                    synthetic: true,
                    text: Buffer.from(part.url, "base64url").toString(),
                  },
                  {
                    ...part,
                    id: part.id ?? Identifier.ascending("part"),
                    messageID: userMsg.id,
                    sessionID: input.sessionID,
                  },
                ];
              }
              break;
            case "file:":
              // have to normalize, symbol search returns absolute paths
              // Decode the pathname since URL constructor doesn't automatically decode it
              const pathname = decodeURIComponent(url.pathname);
              const relativePath = pathname.replace(app.path.cwd, ".");
              const filePath = path.join(app.path.cwd, relativePath);

              if (part.mime === "text/plain") {
                let offset: number | undefined = undefined;
                let limit: number | undefined = undefined;
                const range = {
                  start: url.searchParams.get("start"),
                  end: url.searchParams.get("end"),
                };
                if (range.start != null) {
                  const filePath = part.url.split("?")[0];
                  let start = parseInt(range.start);
                  let end = range.end ? parseInt(range.end) : undefined;
                  // some LSP servers (eg, gopls) don't give full range in
                  // workspace/symbol searches, so we'll try to find the
                  // symbol in the document to get the full range
                  if (start === end) {
                    const symbols = await LSP.documentSymbol(filePath);
                    for (const symbol of symbols) {
                      let range: LSP.Range | undefined;
                      if ("range" in symbol) {
                        range = symbol.range;
                      } else if ("location" in symbol) {
                        range = symbol.location.range;
                      }
                      if (range?.start?.line && range?.start?.line === start) {
                        start = range.start.line;
                        end = range?.end?.line ?? start;
                        break;
                      }
                    }
                    offset = Math.max(start - 2, 0);
                    if (end) {
                      limit = end - offset + 2;
                    }
                  }
                }
                const args = { filePath, offset, limit };
                const result = await ReadTool.init().then((t) =>
                  t.execute(args, {
                    sessionID: input.sessionID,
                    abort: new AbortController().signal,
                    messageID: userMsg.id,
                    toolCallID: "file-read",
                    metadata: async () => {},
                  }),
                );
                return [
                  {
                    id: Identifier.ascending("part"),
                    messageID: userMsg.id,
                    sessionID: input.sessionID,
                    type: "text",
                    synthetic: true,
                    text: `Called the Read tool with the following input: ${JSON.stringify(args)}`,
                  },
                  {
                    id: Identifier.ascending("part"),
                    messageID: userMsg.id,
                    sessionID: input.sessionID,
                    type: "text",
                    synthetic: true,
                    text: result.output,
                  },
                  {
                    ...part,
                    id: part.id ?? Identifier.ascending("part"),
                    messageID: userMsg.id,
                    sessionID: input.sessionID,
                  },
                ];
              }

              let file = Bun.file(filePath);
              FileTime.read(input.sessionID, filePath);
              return [
                {
                  id: Identifier.ascending("part"),
                  messageID: userMsg.id,
                  sessionID: input.sessionID,
                  type: "text",
                  text: `Called the Read tool with the following input: {\"filePath\":\"${pathname}\"}`,
                  synthetic: true,
                },
                {
                  id: part.id ?? Identifier.ascending("part"),
                  messageID: userMsg.id,
                  sessionID: input.sessionID,
                  type: "file",
                  url:
                    `data:${part.mime};base64,` +
                    Buffer.from(await file.bytes()).toString("base64"),
                  mime: part.mime,
                  filename: part.filename!,
                  source: part.source,
                },
              ];
          }
        }
        return [
          {
            id: Identifier.ascending("part"),
            ...part,
            messageID: userMsg.id,
            sessionID: input.sessionID,
          },
        ];
      }),
    ).then((x) => x.flat());
    if (inputMode === "plan")
      userParts.push({
        id: Identifier.ascending("part"),
        messageID: userMsg.id,
        sessionID: input.sessionID,
        type: "text",
        text: PROMPT_PLAN,
        synthetic: true,
      });
    if (inputMode === "chat")
      userParts.push({
        id: Identifier.ascending("part"),
        messageID: userMsg.id,
        sessionID: input.sessionID,
        type: "text",
        text: PROMPT_CHAT,
        synthetic: true,
      });

    await updateMessage(userMsg);
    for (const part of userParts) {
      await updatePart(part);
    }

    // Trigger plugin hook for new chat message
    await Plugin.trigger(
      "chat.message",
      {},
      { message: userMsg, parts: userParts.flat() },
    );

    // mark session as updated since a message has been added to it
    await update(input.sessionID, (_draft) => {});

    // Acquire lock immediately to prevent race conditions
    let lockHandle;
    try {
      lockHandle = lock(input.sessionID);
    } catch (error) {
      if (error instanceof BusyError) {
        return new Promise((resolve) => {
          const queue = state().queued.get(input.sessionID) ?? [];
          queue.push({
            input: input,
            message: userMsg,
            parts: userParts,
            processed: false,
            callback: resolve,
          });
          state().queued.set(input.sessionID, queue);
        });
      }
      throw error;
    }

    // Use the lock handle for the rest of the function
    using abortSignal = lockHandle;

    const model = await Provider.getModel(input.providerID, input.modelID);
    let msgs = await messages(input.sessionID);
    const session = await get(input.sessionID);

    if (session.revert) {
      const messageID = session.revert.messageID;
      const [preserve, remove] = splitWhen(
        msgs,
        (x) => x.info.id === messageID,
      );
      msgs = preserve;
      for (const msg of remove) {
        await Storage.remove(
          `session/message/${input.sessionID}/${msg.info.id}`,
        );
        await Bus.publish(MessageV2.Event.Removed, {
          sessionID: input.sessionID,
          messageID: msg.info.id,
        });
      }
      const last = preserve.at(-1);
      if (session.revert.partID && last) {
        const partID = session.revert.partID;
        const [preserveParts, removeParts] = splitWhen(
          last.parts,
          (x) => x.id === partID,
        );
        last.parts = preserveParts;
        for (const part of removeParts) {
          await Storage.remove(
            `session/part/${input.sessionID}/${last.info.id}/${part.id}`,
          );
          await Bus.publish(MessageV2.Event.PartRemoved, {
            messageID: last.info.id,
            partID: part.id,
          });
        }
      }
    }

    const previous = msgs.filter((x) => x.info.role === "assistant").at(-1)
      ?.info as MessageV2.Assistant;
    const outputLimit =
      Math.min(model.info.limit.output, OUTPUT_TOKEN_MAX) || OUTPUT_TOKEN_MAX;
    const systemPrompts: string[] = [];

    // Get mode early to avoid temporal dead zone
    const mode = await Mode.get(inputMode);

    // PROACTIVE CHECK: Estimate tokens before making the request
    if (model.info.limit.context) {
      systemPrompts.push(
        ...(() => {
          if (input.system) return [input.system];
          if (mode.prompt) return [mode.prompt];
          return SystemPrompt.provider(input.modelID);
        })(),
      );
      systemPrompts.push(...(await SystemPrompt.environment()));
      systemPrompts.push(...(await SystemPrompt.custom()));

      const estimatedInputTokens = await estimateRequestTokens(
        msgs,
        userParts,
        systemPrompts,
      );
      const safetyThreshold = model.info.limit.context * 0.85; // More conservative than 90%
      const totalEstimated = estimatedInputTokens + outputLimit;

      if (totalEstimated > safetyThreshold) {
        log.info("proactive summarization triggered", {
          estimatedTokens: totalEstimated,
          threshold: safetyThreshold,
          contextLimit: model.info.limit.context,
          outputLimit,
        });
        await summarize({
          sessionID: input.sessionID,
          providerID: input.providerID,
          modelID: input.modelID,
        });
        return chat(input);
      }
    }

    // REACTIVE CHECK: Keep existing logic as fallback
    if (previous && previous.tokens) {
      const tokens =
        previous.tokens.input +
        previous.tokens.cache.read +
        previous.tokens.cache.write +
        previous.tokens.output;
      if (
        model.info.limit.context &&
        tokens > Math.max((model.info.limit.context - outputLimit) * 0.9, 0)
      ) {
        log.info("reactive summarization triggered", {
          actualTokens: tokens,
          threshold: Math.max(
            (model.info.limit.context - outputLimit) * 0.9,
            0,
          ),
          contextLimit: model.info.limit.context,
        });
        await summarize({
          sessionID: input.sessionID,
          providerID: input.providerID,
          modelID: input.modelID,
        });
        return chat(input);
      }
    }

    // Lock already acquired above

    const lastSummary = msgs.findLast(
      (msg) => msg.info.role === "assistant" && msg.info.summary === true,
    );
    if (lastSummary)
      msgs = msgs.filter((msg) => msg.info.id >= lastSummary.info.id);

    if (msgs.length === 1 && !session.parentID) {
      const small = (await Provider.getSmallModel(input.providerID)) ?? model;

      const titleMessages = [
        ...SystemPrompt.title(input.providerID).map(
          (x): ModelMessage => ({
            role: "system",
            content: x,
          }),
        ),
        ...MessageV2.toModelMessage([
          {
            info: {
              id: Identifier.ascending("message"),
              role: "user",
              sessionID: input.sessionID,
              time: {
                created: Date.now(),
              },
            },
            parts: userParts,
          },
        ]),
      ];

      const validatedMessages = validateMessages(
        titleMessages,
        "generateText-title",
        input.sessionID,
      );

      generateText({
        maxOutputTokens: small.info.reasoning ? 1024 : 20,
        providerOptions: {
          [input.providerID]: small.info.options,
        },
        messages: validatedMessages,
        model: small.language,
      })
        .then((result) => {
          if (result.text)
            return update(input.sessionID, (draft) => {
              draft.title = result.text;
            });
        })
        .catch((error) => {
          log.error("Failed to generate session title", {
            sessionID: input.sessionID,
            error,
          });
        });
    }

    let system = SystemPrompt.header(input.providerID);
    system.push(
      ...(() => {
        if (input.system) return [input.system];
        if (mode.prompt) return [mode.prompt];
        return SystemPrompt.provider(input.modelID);
      })(),
    );
    system.push(...(await SystemPrompt.environment()));
    system.push(...(await SystemPrompt.custom()));

    // max 2 system prompt messages for caching purposes
    const [first, ...rest] = system;
    system = [first, rest.join("\n")];

    const assistantMsg: MessageV2.Info = {
      id: Identifier.ascending("message"),
      role: "assistant",
      system,
      mode: inputMode,
      path: {
        cwd: app.path.cwd,
        root: app.path.root,
      },
      cost: 0,
      tokens: {
        input: 0,
        output: 0,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      },
      modelID: input.modelID,
      providerID: input.providerID,
      time: {
        created: Date.now(),
      },
      sessionID: input.sessionID,
    };
    await updateMessage(assistantMsg);
    const tools: Record<string, AITool> = {};

    const processor = createProcessor(assistantMsg, model.info);

    const enabledTools = pipe(
      mode.tools,
      mergeDeep(ToolRegistry.enabled(input.providerID, input.modelID)),
      mergeDeep(input.tools ?? {}),
    );
    for (const item of await ToolRegistry.tools(
      input.providerID,
      input.modelID,
    )) {
      if (enabledTools[item.id] === false) continue;
      tools[item.id] = tool({
        id: item.id as any,
        description: item.description,
        inputSchema: item.parameters as ZodSchema,
        async execute(args, options) {
          await processor.track(options.toolCallId);

          // Add validation error handling for tool parameters
          let validatedArgs = args;
          try {
            // If the tool has parameters schema, validate and potentially fix
            if (item.parameters && "parse" in item.parameters) {
              validatedArgs = item.parameters.parse(args);
            }
          } catch (validationError: any) {
            log.warn(`Tool parameter validation error for ${item.id}:`, {
              error: validationError.message,
              args,
              tool: item.id,
            });

            // For TodoWrite tool, handle common validation errors gracefully
            if (
              item.id === "TodoWrite" &&
              validationError.message?.includes("Invalid enum value")
            ) {
              // Try to fix common issues like invalid priority values
              if (args.todos && Array.isArray(args.todos)) {
                validatedArgs = {
                  ...args,
                  todos: args.todos.map((todo: any) => ({
                    ...todo,
                    // Default invalid priority to 'medium'
                    priority: ["high", "medium", "low", "critical"].includes(
                      todo.priority,
                    )
                      ? todo.priority
                      : "medium",
                  })),
                };

                // Try parsing again with fixed values
                try {
                  validatedArgs = item.parameters.parse(validatedArgs);
                } catch (e) {
                  // If still failing, return error to AI
                  return {
                    error: `Tool validation failed: ${validationError.message}. Please check your parameters.`,
                    suggestion:
                      "For TodoWrite, use priority values: 'high', 'medium', 'low', or 'critical'",
                  };
                }
              }
            } else {
              // For other validation errors, return helpful message
              return {
                error: `Tool validation failed: ${validationError.message}`,
                suggestion: "Please check the tool parameters and try again.",
              };
            }
          }

          // Trigger plugin hook before tool execution
          const toolArgs = { args: validatedArgs };
          await Plugin.trigger(
            "tool.execute.before",
            {
              tool: item.id,
              sessionID: input.sessionID,
              callID: options.toolCallId,
            },
            toolArgs,
          );

          const result = await item.execute(toolArgs.args, {
            sessionID: input.sessionID,
            abort: abortSignal.signal,
            messageID: assistantMsg.id,
            toolCallID: options.toolCallId,
            metadata: async (val) => {
              const match = processor.partFromToolCall(options.toolCallId);
              if (match && match.state.status === "running") {
                await updatePart({
                  ...match,
                  state: {
                    title: val.title,
                    metadata: val.metadata,
                    status: "running",
                    input: args,
                    time: {
                      start: Date.now(),
                    },
                  },
                });
              }
            },
          });

          // Trigger plugin hook after tool execution
          await Plugin.trigger(
            "tool.execute.after",
            {
              tool: item.id,
              sessionID: input.sessionID,
              callID: options.toolCallId,
            },
            {
              title: result.title || item.id,
              output: result.output || "",
              metadata: result.metadata || {},
            },
          );

          return result;
        },
        toModelOutput(result) {
          return {
            type: "text",
            value: result.output,
          };
        },
      });
    }

    for (const [key, item] of Object.entries(await MCP.tools())) {
      if (mode.tools[key] === false) continue;
      const execute = item.execute;
      if (!execute) continue;
      item.execute = async (args, opts) => {
        await processor.track(opts.toolCallId);

        // Trigger plugin hook before MCP tool execution
        const toolArgs = { args };
        await Plugin.trigger(
          "tool.execute.before",
          {
            tool: key,
            sessionID: input.sessionID,
            callID: opts.toolCallId,
          },
          toolArgs,
        );

        const result = await execute(toolArgs.args, opts);
        const output = result.content
          .filter((x: any) => x.type === "text")
          .map((x: any) => x.text)
          .join("\n\n");

        // Trigger plugin hook after MCP tool execution
        await Plugin.trigger(
          "tool.execute.after",
          {
            tool: key,
            sessionID: input.sessionID,
            callID: opts.toolCallId,
          },
          {
            title: key,
            output,
            metadata: result.metadata || {},
          },
        );

        return {
          output,
        };
      };
      item.toModelOutput = (result) => {
        return {
          type: "text",
          value: result.output,
        };
      };
      tools[key] = item;
    }

    // Add fallback tools for common missing tool patterns
    const availableToolNames = new Set(Object.keys(tools));
    addFallbackTools(tools, availableToolNames, processor);

    // SMART CONTEXT COMPACTION: Intelligent task-aware context management
    const contextLimit = model.info.limit.context || 200000;
    const safetyMargin = 0.85; // Use 85% of context limit for safety
    const maxSafeTokens = Math.floor(contextLimit * safetyMargin);
    const reservedForOutput = outputLimit;
    const maxInputTokens = maxSafeTokens - reservedForOutput;

    // Use SmartContextManager for intelligent compaction
    const { SmartContextManager } = await import(
      "./context/SmartContextManager"
    );
    const contextManager = new SmartContextManager();

    const compactionOptions = {
      maxTokens: maxInputTokens,
      safetyMargin,
      preserveTaskContext: true,
      preserveToolOutputs: true,
      preserveErrors: true,
      minRecentMessages: 5,
      taskContinuationPrompts: true,
    };

    const compactionResult = await contextManager.compactContext(
      msgs,
      compactionOptions,
    );

    // Update msgs to use the intelligently trimmed version
    msgs = compactionResult.trimmedMessages;

    // Log the smart compaction results
    log.info("smart context compaction completed", {
      originalMessages:
        msgs.length +
        (compactionResult.tokensRemoved > 0
          ? Math.ceil(compactionResult.tokensRemoved / 100)
          : 0),
      preservedMessages: msgs.length,
      tokensRemoved: compactionResult.tokensRemoved,
      preservationRatio: compactionResult.preservationRatio,
      strategy: compactionResult.compactionStrategy,
      activeTasks: compactionResult.preservedTasks.length,
      sessionID: input.sessionID,
    });

    // Add continuation prompt if there are incomplete tasks
    if (compactionResult.continuationPrompt) {
      // Inject continuation prompt as a system message
      system.push(
        `\n--- TASK CONTINUATION ---\n${compactionResult.continuationPrompt}`,
      );

      log.info("added task continuation prompt", {
        sessionID: input.sessionID,
        activeTasks: compactionResult.preservedTasks.length,
      });
    }

    const stream = streamText({
      onError(error) {
        log.error("Stream error", { error, sessionID: input.sessionID });
        throw error;
      },
      async prepareStep({ messages }) {
        const queue = (state().queued.get(input.sessionID) ?? []).filter(
          (x) => !x.processed,
        );
        if (queue.length) {
          for (const item of queue) {
            if (item.processed) continue;
            messages.push(
              ...MessageV2.toModelMessage([
                {
                  info: item.message,
                  parts: item.parts,
                },
              ]),
            );
            item.processed = true;
          }
          assistantMsg.time.completed = Date.now();
          await updateMessage(assistantMsg);
          Object.assign(assistantMsg, {
            id: Identifier.ascending("message"),
            role: "assistant",
            system,
            path: {
              cwd: app.path.cwd,
              root: app.path.root,
            },
            cost: 0,
            tokens: {
              input: 0,
              output: 0,
              reasoning: 0,
              cache: { read: 0, write: 0 },
            },
            modelID: input.modelID,
            providerID: input.providerID,
            mode: inputMode,
            time: {
              created: Date.now(),
            },
            sessionID: input.sessionID,
          });
          await updateMessage(assistantMsg);
        }
        return {
          messages,
        };
      },
      maxRetries: 10,
      maxOutputTokens: outputLimit,
      abortSignal: abortSignal.signal,
      stopWhen: stepCountIs(1000),
      providerOptions: {
        [input.providerID]: model.info.options,
      },
      messages: [
        ...system.map(
          (x): ModelMessage => ({
            role: "system",
            content: x,
          }),
        ),
        ...MessageV2.toModelMessage(msgs),
      ],
      temperature: await (async () => {
        // Calculate initial temperature
        const initialTemp = model.info.temperature
          ? (mode.temperature ??
            ProviderTransform.temperature(input.providerID, input.modelID))
          : undefined;

        // Create parameters object for plugin modification
        const params = {
          temperature: initialTemp,
        };

        // Trigger plugin hook to allow parameter modification
        await Plugin.trigger(
          "chat.params",
          {
            model: model.info,
            provider: {
              id: input.providerID,
              name: input.providerID,
              type: input.providerID,
            },
            message: userMsg,
          },
          params,
        );

        return params.temperature;
      })(),
      tools: model.info.tool_call === false ? undefined : tools,
      model: wrapLanguageModel({
        model: model.language,
        middleware: [
          {
            async transformParams(args) {
              if (args.type === "stream") {
                // @ts-expect-error
                args.params.prompt = ProviderTransform.message(
                  args.params.prompt,
                  input.providerID,
                  input.modelID,
                );
              }
              return args.params;
            },
          },
        ],
      }),
    });
    const result = await processor.process(stream);
    const queued = state().queued.get(input.sessionID) ?? [];
    const unprocessed = queued.find((x) => !x.processed);
    if (unprocessed) {
      unprocessed.processed = true;
      return chat(unprocessed.input);
    }
    for (const item of queued) {
      item.callback(result);
    }
    state().queued.delete(input.sessionID);
    return result;
  }

  function createProcessor(
    assistantMsg: MessageV2.Assistant,
    model: ModelsDev.Model,
  ) {
    const toolCalls: Record<string, MessageV2.ToolPart> = {};
    const snapshots: Record<string, string> = {};
    return {
      async track(toolCallID: string) {
        const hash = await Snapshot.track();
        if (hash) snapshots[toolCallID] = hash;
      },
      partFromToolCall(toolCallID: string) {
        return toolCalls[toolCallID];
      },
      async process(stream: StreamTextResult<Record<string, AITool>, never>) {
        try {
          let currentText: MessageV2.TextPart | undefined;

          for await (const value of stream.fullStream) {
            log.info("part", {
              type: value.type,
            });
            switch (value.type) {
              case "start":
                break;

              case "tool-input-start":
                const part = await updatePart({
                  id: Identifier.ascending("part"),
                  messageID: assistantMsg.id,
                  sessionID: assistantMsg.sessionID,
                  type: "tool",
                  tool: value.toolName,
                  callID: value.id,
                  state: {
                    status: "pending",
                  },
                });
                toolCalls[value.id] = part as MessageV2.ToolPart;
                break;

              case "tool-input-delta":
                break;

              case "tool-input-end":
                break;

              case "tool-call": {
                const match = toolCalls[value.toolCallId];
                if (match) {
                  const part = await updatePart({
                    ...match,
                    state: {
                      status: "running",
                      input: value.input,
                      time: {
                        start: Date.now(),
                      },
                    },
                  });
                  toolCalls[value.toolCallId] = part as MessageV2.ToolPart;
                }
                break;
              }
              case "tool-result": {
                const match = toolCalls[value.toolCallId];
                if (match && match.state.status === "running") {
                  await updatePart({
                    ...match,
                    state: {
                      status: "completed",
                      input: value.input,
                      output: value.output.output,
                      metadata: value.output.metadata,
                      title: value.output.title,
                      time: {
                        start: match.state.time.start,
                        end: Date.now(),
                      },
                    },
                  });
                  delete toolCalls[value.toolCallId];
                  const snapshot = snapshots[value.toolCallId];
                  if (snapshot) {
                    const patch = await Snapshot.patch(snapshot);
                    if (patch.files.length) {
                      await updatePart({
                        id: Identifier.ascending("part"),
                        messageID: assistantMsg.id,
                        sessionID: assistantMsg.sessionID,
                        type: "patch",
                        hash: patch.hash,
                        files: patch.files,
                      });
                    }
                  }
                }
                break;
              }

              case "tool-error": {
                const match = toolCalls[value.toolCallId];
                if (match && match.state.status === "running") {
                  await updatePart({
                    ...match,
                    state: {
                      status: "error",
                      input: value.input,
                      error: (value.error as any).toString(),
                      time: {
                        start: match.state.time.start,
                        end: Date.now(),
                      },
                    },
                  });
                  delete toolCalls[value.toolCallId];
                  const snapshot = snapshots[value.toolCallId];
                  if (snapshot) {
                    const patch = await Snapshot.patch(snapshot);
                    await updatePart({
                      id: Identifier.ascending("part"),
                      messageID: assistantMsg.id,
                      sessionID: assistantMsg.sessionID,
                      type: "patch",
                      hash: patch.hash,
                      files: patch.files,
                    });
                  }
                }
                break;
              }

              case "error":
                throw value.error;

              case "start-step":
                await updatePart({
                  id: Identifier.ascending("part"),
                  messageID: assistantMsg.id,
                  sessionID: assistantMsg.sessionID,
                  type: "step-start",
                });
                break;

              case "finish-step":
                const usage = getUsage(
                  model,
                  value.usage,
                  value.providerMetadata,
                );
                assistantMsg.cost += usage.cost;
                assistantMsg.tokens = usage.tokens;
                await updatePart({
                  id: Identifier.ascending("part"),
                  messageID: assistantMsg.id,
                  sessionID: assistantMsg.sessionID,
                  type: "step-finish",
                  tokens: usage.tokens,
                  cost: usage.cost,
                });
                await updateMessage(assistantMsg);
                break;

              case "text-start":
                currentText = {
                  id: Identifier.ascending("part"),
                  messageID: assistantMsg.id,
                  sessionID: assistantMsg.sessionID,
                  type: "text",
                  text: "",
                  time: {
                    start: Date.now(),
                  },
                };
                break;

              case "text-delta":
                if (currentText) {
                  currentText.text += (value as any).textDelta;
                  await updatePart(currentText);
                }
                break;

              case "text-end":
                if (currentText && currentText.text) {
                  currentText.time = {
                    start: Date.now(),
                    end: Date.now(),
                  };
                  currentText.text = currentText.text.trimEnd();
                  await updatePart(currentText);
                }
                currentText = undefined;
                break;

              case "finish":
                assistantMsg.time.completed = Date.now();
                await updateMessage(assistantMsg);
                break;

              default:
                log.info("unhandled", {
                  ...value,
                });
                continue;
            }
          }
        } catch (e) {
          log.error("", {
            error: e,
          });
          switch (true) {
            case e instanceof DOMException && e.name === "AbortError":
              assistantMsg.error = new MessageV2.AbortedError(
                { message: e.message },
                {
                  cause: e,
                },
              ).toObject();
              break;
            case MessageV2.OutputLengthError.isInstance(e):
              assistantMsg.error = e;
              break;
            case LoadAPIKeyError.isInstance(e):
              assistantMsg.error = new MessageV2.AuthError(
                {
                  providerID: model.id,
                  message: e.message,
                },
                { cause: e },
              ).toObject();
              break;
            case NoSuchToolError.isInstance(e): {
              // Handle missing tools with dynamic suggestions
              const toolError = e as NoSuchToolError;
              const requestedTool = toolError.toolName;
              const availableTools = new Set(toolError.availableTools || []);

              log.info("handling missing tool with dynamic resolution", {
                requestedTool,
                availableToolsCount: availableTools.size,
              });

              // Use existing ToolResolver to find alternatives
              const resolution = ToolResolver.resolve(
                requestedTool,
                availableTools,
              );

              if (resolution.success && resolution.resolvedTool) {
                // High confidence match found
                log.info("resolved tool found", {
                  requestedTool,
                  resolvedTool: resolution.resolvedTool,
                });

                // For now, provide a helpful message suggesting the correct tool
                // Future enhancement: implement actual auto-retry logic
                const suggestionMessage = `Tool '${requestedTool}' not found. Did you mean '${resolution.resolvedTool}'? This tool provides the same functionality.`;

                assistantMsg.error = new NamedError.Unknown(
                  { message: suggestionMessage },
                  { cause: e },
                ).toObject();
              } else {
                // No direct match - provide helpful suggestions
                let suggestionMessage = `Tool '${requestedTool}' is not available.`;

                if (
                  resolution.alternatives &&
                  resolution.alternatives.length > 0
                ) {
                  suggestionMessage += ` Here are some alternatives that can achieve similar functionality:\n\n`;
                  resolution.alternatives.forEach((alt, index) => {
                    suggestionMessage += `${index + 1}. ${alt.description}\n   Tools: ${alt.tools.join(", ")}\n   Strategy: ${alt.strategy}\n\n`;
                  });
                } else if (resolution.fallbackSuggestion) {
                  suggestionMessage += `\n\n${resolution.fallbackSuggestion}`;
                } else {
                  // Show some available tools as a last resort
                  const toolList = Array.from(availableTools)
                    .slice(0, 15)
                    .join(", ");
                  suggestionMessage += `\n\nAvailable tools include: ${toolList}${availableTools.size > 15 ? ", and more..." : ""}`;
                }

                log.warn("no suitable tool resolution found", {
                  requestedTool,
                  alternativesCount: resolution.alternatives?.length || 0,
                });

                assistantMsg.error = new NamedError.Unknown(
                  { message: suggestionMessage },
                  { cause: e },
                ).toObject();
              }
              break;
            }
            case e instanceof Error:
              assistantMsg.error = new NamedError.Unknown(
                { message: e.toString() },
                { cause: e },
              ).toObject();
              break;
            default:
              assistantMsg.error = new NamedError.Unknown(
                { message: JSON.stringify(e) },
                { cause: e },
              );
          }
          Bus.publish(Event.Error, {
            sessionID: assistantMsg.sessionID,
            error: assistantMsg.error,
          });
        }
        const p = await getParts(assistantMsg.sessionID, assistantMsg.id);
        for (const part of p) {
          if (part.type === "tool" && part.state.status !== "completed") {
            updatePart({
              ...part,
              state: {
                status: "error",
                error: "Tool execution aborted",
                time: {
                  start: Date.now(),
                  end: Date.now(),
                },
                input: {},
              },
            });
          }
        }
        assistantMsg.time.completed = Date.now();
        await updateMessage(assistantMsg);
        return { info: assistantMsg, parts: p };
      },
    };
  }

  export const RevertInput = z.object({
    sessionID: Identifier.schema("session"),
    messageID: Identifier.schema("message"),
    partID: Identifier.schema("part").optional(),
  });
  export type RevertInput = z.infer<typeof RevertInput>;

  export async function revert(input: RevertInput) {
    const all = await messages(input.sessionID);
    let lastUser: MessageV2.User | undefined;
    const session = await get(input.sessionID);

    let revert: Info["revert"];
    const patches: Snapshot.Patch[] = [];
    for (const msg of all) {
      if (msg.info.role === "user") lastUser = msg.info;
      const remaining = [];
      for (const part of msg.parts) {
        if (revert) {
          if (part.type === "patch") {
            patches.push(part);
          }
          continue;
        }

        if (!revert) {
          if (
            (msg.info.id === input.messageID && !input.partID) ||
            part.id === input.partID
          ) {
            // if no useful parts left in message, same as reverting whole message
            const partID = remaining.some((item) =>
              ["text", "tool"].includes(item.type),
            )
              ? input.partID
              : undefined;
            revert = {
              messageID: !partID && lastUser ? lastUser.id : msg.info.id,
              partID,
            };
          }
          remaining.push(part);
        }
      }
    }

    if (revert) {
      const session = await get(input.sessionID);
      revert.snapshot = session.revert?.snapshot ?? (await Snapshot.track());
      await Snapshot.revert(patches);
      return update(input.sessionID, (draft) => {
        draft.revert = revert;
      });
    }
    return session;
  }

  export async function unrevert(input: { sessionID: string }) {
    log.info("unreverting", input);
    const session = await get(input.sessionID);
    if (!session.revert) return session;
    if (session.revert.snapshot)
      await Snapshot.restore(session.revert.snapshot);
    const next = await update(input.sessionID, (draft) => {
      draft.revert = undefined;
    });
    return next;
  }

  export async function summarize(input: {
    sessionID: string;
    providerID: string;
    modelID: string;
  }) {
    // Check if we've summarized recently to prevent multiple summarizations
    const now = Date.now();
    const lastSummarization = state().recentSummarizations.get(input.sessionID);
    const SUMMARIZATION_COOLDOWN = 30000; // 30 seconds cooldown

    if (lastSummarization && now - lastSummarization < SUMMARIZATION_COOLDOWN) {
      log.info("skipping summarization due to recent summarization", {
        sessionID: input.sessionID,
        lastSummarization,
        cooldownRemaining: SUMMARIZATION_COOLDOWN - (now - lastSummarization),
      });
      return; // Skip summarization if done recently
    }

    // Track this summarization attempt
    state().recentSummarizations.set(input.sessionID, now);

    using abortSignal = lock(input.sessionID);
    const msgs = await messages(input.sessionID);
    const lastSummary = msgs.findLast(
      (msg) => msg.info.role === "assistant" && msg.info.summary === true,
    );
    const filtered = msgs.filter(
      (msg) => !lastSummary || msg.info.id >= lastSummary.info.id,
    );
    const model = await Provider.getModel(input.providerID, input.modelID);
    const app = App.info();
    const system = [
      ...SystemPrompt.summarize(input.providerID),
      ...(await SystemPrompt.environment()),
      ...(await SystemPrompt.custom()),
    ];

    const next: MessageV2.Info = {
      id: Identifier.ascending("message"),
      role: "assistant",
      sessionID: input.sessionID,
      system,
      mode: "build",
      path: {
        cwd: app.path.cwd,
        root: app.path.root,
      },
      summary: true,
      cost: 0,
      modelID: input.modelID,
      providerID: input.providerID,
      tokens: {
        input: 0,
        output: 0,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      },
      time: {
        created: Date.now(),
      },
    };
    await updateMessage(next);

    const processor = createProcessor(next, model.info);

    // Context limit protection for summarization
    const outputLimit = 4000; // Conservative estimate for summary output
    const contextLimit = model.info.limit.context || 200000;
    const safetyThreshold = contextLimit * 0.8; // Conservative threshold for summarization

    // Estimate tokens for system prompts and summary request
    const systemTokens = estimateTokens(system.join("\n"));
    const summaryRequestTokens = estimateTokens(
      "Provide a detailed but concise summary of our conversation above. Focus on information that would be helpful for continuing the conversation, including what we did, what we're doing, which files we're working on, and what we're going to do next.",
    );
    const fixedTokens = systemTokens + summaryRequestTokens + outputLimit;

    // Calculate available tokens for conversation history
    const availableTokens = safetyThreshold - fixedTokens;

    // Intelligently truncate messages if needed
    let messagesToSummarize = filtered;
    if (availableTokens > 0) {
      let currentTokens = 0;
      const truncatedMessages = [];

      // Start from the most recent messages and work backwards
      for (let i = filtered.length - 1; i >= 0; i--) {
        const msg = filtered[i];
        const modelMsgs = MessageV2.toModelMessage([msg]);
        let msgTokens = 0;

        for (const modelMsg of modelMsgs) {
          if (typeof modelMsg.content === "string") {
            msgTokens += estimateTokens(modelMsg.content);
          } else if (Array.isArray(modelMsg.content)) {
            for (const part of modelMsg.content) {
              if (part.type === "text") {
                msgTokens += estimateTokens(part.text);
              }
            }
          }
        }

        if (currentTokens + msgTokens <= availableTokens) {
          truncatedMessages.unshift(msg);
          currentTokens += msgTokens;
        } else {
          // Log truncation for debugging
          log.info("summarization message truncation", {
            sessionID: input.sessionID,
            totalMessages: filtered.length,
            includedMessages: truncatedMessages.length,
            truncatedMessages: i + 1,
            availableTokens,
            usedTokens: currentTokens,
          });
          break;
        }
      }

      messagesToSummarize = truncatedMessages;
    }

    const summaryMessages = [
      ...system.map(
        (x): ModelMessage => ({
          role: "system",
          content: x,
        }),
      ),
      ...MessageV2.toModelMessage(messagesToSummarize),
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text: "Provide a detailed but concise summary of our conversation above. Focus on information that would be helpful for continuing the conversation, including what we did, what we're doing, which files we're working on, and what we're going to do next.",
          },
        ],
      },
    ];

    const validatedSummaryMessages = validateMessages(
      summaryMessages,
      "streamText-summarize",
      input.sessionID,
    );

    const stream = streamText({
      maxRetries: 10,
      abortSignal: abortSignal.signal,
      model: model.language,
      messages: validatedSummaryMessages,
      maxOutputTokens: outputLimit,
    });

    const result = await processor.process(stream);
    return result;
  }

  export class BusyError extends Error {
    constructor(public readonly sessionID: string) {
      super(`Session ${sessionID} is busy`);
    }
  }

  export function isLocked(sessionID: string) {
    return state().pending.has(sessionID);
  }

  export function lock(sessionID: string) {
    log.info("locking", { sessionID });
    if (state().pending.has(sessionID)) throw new BusyError(sessionID);
    const controller = new AbortController();
    state().pending.set(sessionID, controller);
    return {
      signal: controller.signal,
      [Symbol.dispose]() {
        log.info("unlocking", { sessionID });
        state().pending.delete(sessionID);
        Bus.publish(Event.Idle, {
          sessionID,
        });
      },
    };
  }

  function getUsage(
    model: ModelsDev.Model,
    usage: LanguageModelUsage,
    metadata?: ProviderMetadata,
  ) {
    const tokens = {
      input: usage.inputTokens ?? 0,
      output: usage.outputTokens ?? 0,
      reasoning: 0,
      cache: {
        write: (metadata?.["anthropic"]?.["cacheCreationInputTokens"] ??
          metadata?.["bedrock"]?.["usage"]?.["cacheWriteInputTokens"] ??
          0) as number,
        read: usage.cachedInputTokens ?? 0,
      },
    };
    return {
      cost: new Decimal(0)
        .add(new Decimal(tokens.input).mul(model.cost.input).div(1_000_000))
        .add(new Decimal(tokens.output).mul(model.cost.output).div(1_000_000))
        .add(
          new Decimal(tokens.cache.read)
            .mul(model.cost.cache_read ?? 0)
            .div(1_000_000),
        )
        .add(
          new Decimal(tokens.cache.write)
            .mul(model.cost.cache_write ?? 0)
            .div(1_000_000),
        )
        .toNumber(),
      tokens,
    };
  }

  export async function initialize(input: {
    sessionID: string;
    modelID: string;
    providerID: string;
    messageID: string;
  }) {
    const app = App.info();

    // Get legacy file context to help with .agentrc generation
    const legacyContext = await LegacyFiles.createContextSummary();

    // Combine the base prompt with legacy file context
    const fullPrompt = [
      PROMPT_INITIALIZE.replace("${path}", app.path.root),
      legacyContext,
    ]
      .filter(Boolean)
      .join("\n\n");

    await chat({
      sessionID: input.sessionID,
      messageID: input.messageID,
      providerID: input.providerID,
      modelID: input.modelID,
      parts: [
        {
          id: Identifier.ascending("part"),
          type: "text",
          text: fullPrompt,
        },
      ],
    });
    await App.initialize();
  }
}
