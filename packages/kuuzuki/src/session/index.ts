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

  // Keep full output token capacity - the issue is with INPUT tokens
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
   * Smart token estimation that learns from actual API responses
   * Starts with better default (2.2) and improves over time
   */
  function smartEstimateTokens(text: string, sessionID?: string): number {
    if (!text) return 0;
    
    // Get learned ratio for this session
    const learning = sessionID ? state().tokenLearning.get(sessionID) : null;
    
    // Use learned ratio if confident, otherwise use improved default
    const ratio = learning && learning.confidence > 0.8 
      ? learning.currentRatio 
      : 2.2; // Better default than 3.5 based on actual data
    
    const estimated = Math.ceil(text.length / ratio);
    
    // Log for debugging (only for significant text)
    if (text.length > 1000) {
      log.debug("Smart token estimation", {
        sessionID,
        textLength: text.length,
        ratio,
        estimated,
        confidence: learning?.confidence || 0,
        isLearned: !!(learning && learning.confidence > 0.8)
      });
    }
    
    return estimated;
  }
  
  /**
   * Legacy token estimation - now uses smart estimation
   */
  function estimateTokens(text: string): number {
    // Use smart estimation without session ID for backwards compatibility
    return smartEstimateTokens(text);
  }

  /**
   * Get dynamic threshold ratio based on token estimation confidence
   */
  function getDynamicThresholdRatio(sessionID: string): number {
    const learning = state().tokenLearning.get(sessionID);
    const confidence = learning?.confidence || 0;
    // Use 70% when learning, 90% when confident
    return confidence >= 0.8 ? 0.9 : 0.7;
  }

  // Enhanced context estimation utilities
  function estimateQueueTokens(queue: any[]): number {
    let total = 0;
    for (const item of queue) {
      if (item.processed) continue;
      for (const part of item.parts) {
        if (part.type === "text") {
          total += estimateTokens(part.text);
        }
      }
    }
    return total;
  }

  async function estimateContextUsage(sessionID: string, newParts: any[]): Promise<number> {
    const msgs = await messages(sessionID);
    let totalTokens = 0;
    
    // Estimate existing messages
    for (const msg of msgs) {
      for (const part of msg.parts) {
        if (part.type === "text") {
          totalTokens += estimateTokens(part.text);
        }
      }
    }
    
    // Estimate new parts
    for (const part of newParts) {
      if (part.type === "text") {
        totalTokens += estimateTokens(part.text);
      }
    }
    
    // Estimate queued messages
    const queue = state().queued.get(sessionID) ?? [];
    totalTokens += estimateQueueTokens(queue);
    
    return totalTokens;
  }

  /**
   * Estimates total tokens for a request before sending to AI
   * Uses actual token counts from assistant messages when available for better accuracy
   */
  async function estimateRequestTokens(
    msgs: { info: MessageV2.Info; parts: MessageV2.Part[] }[],
    newUserInput: MessageV2.Part[],
    systemPrompts: string[],
  ): Promise<number> {
    let totalTokens = 0;
    let lastActualTokenPosition = -1;
    
    // First pass: Find the most recent assistant message with actual tokens
    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i];
      if (msg.info.role === "assistant" && (msg.info as any).tokens > 0) {
        // We have actual token count up to this message
        totalTokens = (msg.info as any).tokens;
        lastActualTokenPosition = i;
        log.debug("Using actual token count from assistant message", {
          messageId: msg.info.id,
          actualTokens: totalTokens,
          position: i
        });
        break;
      }
    }
    
    // Second pass: Estimate tokens for messages after the last actual count
    if (lastActualTokenPosition >= 0) {
      // Only estimate messages after the last actual token count
      for (let i = lastActualTokenPosition + 1; i < msgs.length; i++) {
        const msg = msgs[i];
        const modelMsgs = MessageV2.toModelMessage([msg]);
        for (const modelMsg of modelMsgs) {
          if (typeof modelMsg.content === "string") {
            totalTokens += smartEstimateTokens(modelMsg.content, msg.info.sessionID);
          } else if (Array.isArray(modelMsg.content)) {
            for (const part of modelMsg.content) {
              if (part.type === "text") {
                totalTokens += smartEstimateTokens(part.text, msg.info.sessionID);
              }
            }
          }
        }
      }
    } else {
      // No actual tokens found, estimate all messages
      for (const msg of msgs) {
        const modelMsgs = MessageV2.toModelMessage([msg]);
        for (const modelMsg of modelMsgs) {
          if (typeof modelMsg.content === "string") {
            totalTokens += smartEstimateTokens(modelMsg.content, msg.info.sessionID);
          } else if (Array.isArray(modelMsg.content)) {
            for (const part of modelMsg.content) {
              if (part.type === "text") {
                totalTokens += smartEstimateTokens(part.text, msg.info.sessionID);
              }
            }
          }
        }
      }
    }
    
    // Count new user input
    const sessionID = msgs.length > 0 ? msgs[0].info.sessionID : undefined;
    for (const part of newUserInput) {
      if (part.type === "text") {
        totalTokens += smartEstimateTokens(part.text, sessionID);
      }
    }
    
    // Count system prompts
    totalTokens += smartEstimateTokens(systemPrompts.join("\n"), sessionID);
    
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
          id: string; // Add unique ID for each queue item
          input: ChatInput;
          message: MessageV2.User;
          parts: MessageV2.Part[];
          processed: boolean;
          timestamp: number;
          timeoutHandle?: NodeJS.Timeout; // Handle to clear timeout when processed
          callback: (input: {
            info: MessageV2.Assistant;
            parts: MessageV2.Part[];
          }) => void;
          reject?: (error: Error) => void; // Reject function for promise
        }[]
      >();
      const queueLocks = new Map<string, Promise<void>>();

      // Track recent summarizations to prevent multiple summarizations
      const recentSummarizations = new Map<string, number>(); // sessionID -> timestamp
      
      // Track compaction state for user notifications
      const compacting = new Set<string>(); // sessionIDs currently being compacted
      const compactionNotified = new Set<string>(); // sessionIDs that have been notified
      const compactionStartTime = new Map<string, number>(); // sessionID -> start timestamp
      
      // Track token learning for accurate estimation
      const tokenLearning = new Map<string, {
        samples: Array<{
          estimated: number;
          actual: number;
          charCount: number;
          ratio: number;
          timestamp: number;
        }>;
        currentRatio: number;
        confidence: number;
      }>();

      // Clean up any stale locks from previous sessions on startup
      log.info("Session state initialized, cleaning up any stale locks");

      // Initialize the session system with cleanup
      setTimeout(() => {
        initializeSystem();
      }, 100); // Small delay to ensure state is fully initialized

      return {
        sessions,
        messages,
        pending,
        queued,
        queueLocks,
        recentSummarizations,
        compacting,
        compactionNotified,
        compactionStartTime,
        tokenLearning,
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

    // Get model info early for context checking
    const model = await Provider.getModel(input.providerID, input.modelID);

    // Acquire lock immediately to prevent race conditions
    let lockHandle;
    try {
      lockHandle = lock(input.sessionID);
    } catch (error) {
      if (error instanceof BusyError) {
        // PROACTIVE CONTEXT CHECK: Check context usage before queuing
        const contextUsage = await estimateContextUsage(input.sessionID, input.parts);
        const contextLimit = model.info.limit.context || 200000;
        const usageRatio = contextUsage / contextLimit;
        
        log.info("context usage check before queuing", {
          sessionID: input.sessionID,
          contextUsage,
          contextLimit,
          usageRatio: Math.round(usageRatio * 100) + "%"
        });
        
        // REMOVED: No longer forcing summarization before queuing
        // Instead, we rely on:
        // 1. Smart batching (3 messages at a time)
        // 2. Context check in prepareStep (70% threshold)
        // 3. Reactive summarization after responses
        // 4. Better chunking strategies
        
        if (usageRatio > 0.80) {
          // Only warn if context is very high, but still queue the message
          log.warn("high context usage detected while queuing", {
            sessionID: input.sessionID,
            usageRatio: Math.round(usageRatio * 100) + "%",
            warning: "Message queued but may need summarization soon"
          });
        }
        
        return new Promise((resolve, reject) => {
          const queue = state().queued.get(input.sessionID) ?? [];

          // IMPROVED QUEUE MANAGEMENT: Allow unlimited queuing but process in batches
          // This prevents "Queue full" errors while maintaining stability
          if (queue.length >= 100) {
            // Only reject if queue is extremely large (potential DoS)
            reject(new Error("Queue overflow - too many pending requests (>100)"));
            return;
          }
          
          if (queue.length >= 20) {
            log.warn("Large queue detected, will process in batches", {
              sessionID: input.sessionID,
              queueLength: queue.length
            });
          }

          const queueItemId = crypto.randomUUID();
          const queueItem = {
            id: queueItemId,
            input: input,
            message: userMsg,
            parts: userParts,
            processed: false,
            timestamp: Date.now(),
            timeoutHandle: undefined as NodeJS.Timeout | undefined,
            callback: resolve,
            reject: reject, // Store reject function too
            retryCount: 0, // Track retry attempts
          };

          queue.push(queueItem);
          state().queued.set(input.sessionID, queue);

          log.info("Request queued", {
            sessionID: input.sessionID,
            queueItemId,
            queueLength: queue.length,
          });
          
          // Add notification if queue is getting large during compaction
          if (state().compacting.has(input.sessionID) && queue.length === 10) {
            const warningMsg: MessageV2.Info = {
              id: Identifier.ascending("message"),
              role: "assistant",
              sessionID: input.sessionID,
              system: [],
              mode: "chat",
              path: {
                cwd: process.cwd(),
                root: process.cwd(),
              },
              summary: false,
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
            
            updateMessage(warningMsg).then(() => {
              const warningPart: MessageV2.Part = {
                id: Identifier.ascending("part"),
                type: "text",
                text: "⏳ Multiple messages queued. They'll be processed after optimization completes...",
                messageID: warningMsg.id,
                sessionID: input.sessionID,
              };
              return updatePart(warningPart);
            }).catch(error => {
              log.error("Failed to create queue warning message", { error });
            });
          }

          // Single simple timeout for entire queue - 10 minutes
          if (queue.length === 1) {
            // First item, set queue timeout
            const timeoutHandle = setTimeout(
              () => {
                const q = state().queued.get(input.sessionID);
                if (q && q.length > 0) {
                  log.warn("Queue timeout - clearing all items", {
                    sessionID: input.sessionID,
                    queueLength: q.length,
                  });

                  // Reject all queued items
                  q.forEach((item) => {
                    if (!item.processed && item.reject) {
                      try {
                        item.reject(
                          new Error("Queue timeout after 10 minutes"),
                        );
                      } catch (e) {
                        log.error("Failed to reject on timeout", { error: e });
                      }
                    }
                  });

                  // Clear the queue
                  state().queued.delete(input.sessionID);
                }
              },
              10 * 60 * 1000,
            ); // 10 minutes for entire queue

            // Store timeout on first item
            queueItem.timeoutHandle = timeoutHandle;
          }
        });
      }
      throw error;
    }

    // Use the lock handle for the rest of the function
    using abortSignal = lockHandle;

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
    
    // DYNAMIC OUTPUT LIMITS: Adjust based on context usage
    const baseOutputLimit = Math.min(model.info.limit.output, OUTPUT_TOKEN_MAX) || OUTPUT_TOKEN_MAX;
    const contextUsage = await estimateContextUsage(input.sessionID, input.parts);
    const modelContextLimit = model.info.limit.context || 200000;
    const usageRatio = contextUsage / modelContextLimit;
    
    let outputLimit = baseOutputLimit;
    if (usageRatio > 0.9) {
      outputLimit = Math.min(baseOutputLimit, 4000); // Very short responses when near limit
      log.info("Reducing output limit due to high context usage", {
        sessionID: input.sessionID,
        usageRatio: Math.round(usageRatio * 100) + "%",
        baseOutput: baseOutputLimit,
        reducedOutput: outputLimit
      });
    } else if (usageRatio > 0.8) {
      outputLimit = Math.min(baseOutputLimit, 8000); // Short responses
    } else if (usageRatio > 0.7) {
      outputLimit = Math.min(baseOutputLimit, 16000); // Medium responses
    }
    
    // CHECK INPUT TOKENS: If we're getting close to limit, we need to chunk messages
    if (previous && previous.tokens && model.info.limit.context) {
      const usedTokens = previous.tokens.input + previous.tokens.cache.read + previous.tokens.cache.write;
      const contextLimit = model.info.limit.context;
      const remainingTokens = contextLimit - outputLimit; // Reserve space for output
      const usageRatio = usedTokens / remainingTokens;
      
      if (usageRatio > 0.85) {
        log.warn("input tokens approaching limit, may need chunking", {
          sessionID: input.sessionID,
          inputTokens: usedTokens,
          remainingSpace: remainingTokens,
          outputReserved: outputLimit,
          contextLimit,
          usageRatio: Math.round(usageRatio * 100) + "%"
        });
        
        // Trigger immediate chunking if we're too close to the limit
        if (usageRatio > 0.95) {
          log.info("proactively chunking messages to prevent overflow", {
            sessionID: input.sessionID,
            usageRatio: Math.round(usageRatio * 100) + "%"
          });
          
          // Remove oldest messages to make room
          const targetMessages = Math.floor(msgs.length * 0.5); // Keep only recent half
          msgs = msgs.slice(-targetMessages);
          
          log.info("chunked message history", {
            sessionID: input.sessionID,
            originalCount: msgs.length + targetMessages,
            keptCount: msgs.length
          });
        }
      }
    }
    const systemPrompts: string[] = [];

    // Get mode early to avoid temporal dead zone
    const mode = await Mode.get(inputMode);

    // REMOVED PROACTIVE SUMMARIZATION: This was causing double summarization and session busy errors
    // We now rely on:
    // 1. Better input chunking in prepareStep (processes in batches of 3)
    // 2. Reactive check after responses (90% threshold) 
    // 3. API error recovery with summarization as last resort
    // This prevents the double-summarization issue that was locking sessions
    
    // Still populate systemPrompts for later use
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
    }

    // REACTIVE CHECK: More aggressive threshold as fallback
    if (previous && previous.tokens) {
      const tokens =
        previous.tokens.input +
        previous.tokens.cache.read +
        previous.tokens.cache.write +
        previous.tokens.output;
      
      // Use OpenCode's 90% threshold for reactive check
      const reactiveThreshold = Math.max((model.info.limit.context - outputLimit) * 0.9, 0);
      
      log.info("reactive context check", {
        sessionID: input.sessionID,
        actualTokens: tokens,
        reactiveThreshold,
        contextLimit: model.info.limit.context,
        usageRatio: Math.round((tokens / model.info.limit.context) * 100) + "%",
        willTriggerSummarization: tokens > reactiveThreshold
      });
      
      if (model.info.limit.context && tokens > reactiveThreshold) {
        log.info("reactive summarization triggered", {
          actualTokens: tokens,
          threshold: Math.max(
            (model.info.limit.context - outputLimit) * 0.9,
            0,
          ),
          contextLimit: model.info.limit.context,
        });
        
        // FIXED: Don't call chat() recursively - this causes "session is busy"!
        // Instead, just trigger summarization and let it complete
        // The NEXT message will benefit from the reduced context
        
        // Run summarization asynchronously without waiting or retrying
        summarize({
          sessionID: input.sessionID,
          providerID: input.providerID,
          modelID: input.modelID,
        }).catch(error => {
          log.error("Background summarization failed", {
            error,
            sessionID: input.sessionID
          });
        });
        
        // Continue with current request - don't retry
        // The summarization will happen in background for next message
        log.info("continuing with current request while summarization runs", {
          sessionID: input.sessionID
        });
      }
    }

    // Lock already acquired above

    const lastSummary = msgs.findLast(
      (msg) => msg.info.role === "assistant" && msg.info.summary === true,
    );
    if (lastSummary) {
      msgs = msgs.filter((msg) => msg.info.id >= lastSummary.info.id);
      
      // SLIDING WINDOW CONTEXT: Apply aggressive truncation if still too large
      const estimatedTokens = await estimateRequestTokens(msgs, userParts, []);
      const windowContextLimit = model.info.limit.context || 200000;
      const usageRatio = estimatedTokens / windowContextLimit;
      
      if (usageRatio > 0.8) {
        log.info("Applying sliding window context management", {
          sessionID: input.sessionID,
          originalMessages: msgs.length,
          estimatedTokens,
          contextLimit: windowContextLimit,
          usageRatio: Math.round(usageRatio * 100) + "%"
        });
        
        // Keep summary and most recent messages only
        const summaryMsg = msgs.find(m => m.info.id === lastSummary.info.id);
        const otherMsgs = msgs.filter(m => m.info.id !== lastSummary.info.id);
        
        // Determine how many recent messages we can keep
        const maxRecentMessages = usageRatio > 0.9 ? 3 : 5;
        const recentMsgs = otherMsgs.slice(-maxRecentMessages);
        
        // Rebuild message list with summary + recent only
        msgs = summaryMsg ? [summaryMsg, ...recentMsgs] : recentMsgs;
        
        log.info("Sliding window applied", {
          sessionID: input.sessionID,
          keptMessages: msgs.length,
          droppedMessages: otherMsgs.length - recentMsgs.length,
          summaryIncluded: !!summaryMsg
        });
      }
    }

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

    // Calculate estimated input tokens before creating processor
    const estimatedInputTokens = await estimateRequestTokens(msgs, userParts, system);

    const processor = createProcessor(assistantMsg, model.info, estimatedInputTokens);

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

    log.debug("Creating streamText with messages", { 
      sessionID: input.sessionID,
      messageCount: msgs.length,
      systemCount: system.length,
      totalMessages: system.length + msgs.length
    });

    // PRE-FLIGHT CHECK: Detect if input is too large before sending to AI
    // Note: estimatedInputTokens already calculated above for createProcessor
    const totalEstimatedTokens = estimatedInputTokens + outputLimit;
    
    log.debug("Pre-flight token check", {
      sessionID: input.sessionID,
      estimatedInputTokens,
      outputLimit,
      totalEstimatedTokens,
      contextLimit: model.info.limit.context,
      willExceed: totalEstimatedTokens > model.info.limit.context
    });
    
    if (totalEstimatedTokens > model.info.limit.context) {
      log.info("🔄 Input too large - initiating smart chunking", {
        sessionID: input.sessionID,
        inputTokens: estimatedInputTokens,
        outputTokens: outputLimit,
        totalTokens: totalEstimatedTokens,
        contextLimit: model.info.limit.context,
        overflow: totalEstimatedTokens - model.info.limit.context
      });
      
      // Handle large input with intelligent chunking
      return await handleLargeInputChunking(input, msgs, system, model.info, assistantMsg);
    }
    
    // PROACTIVE COMPACTION: Check if we should compact before processing
    // Use confidence-based threshold: 70% when learning, 90% when confident
    const learning = state().tokenLearning.get(input.sessionID);
    const confidence = learning?.confidence || 0;
    const thresholdRatio = getDynamicThresholdRatio(input.sessionID);
    const compactionThreshold = model.info.limit.context * thresholdRatio;
    
    log.debug("Dynamic compaction threshold", {
      sessionID: input.sessionID,
      confidence: Math.round(confidence * 100) + "%",
      thresholdRatio: Math.round(thresholdRatio * 100) + "%",
      compactionThreshold
    });
    
    if (estimatedInputTokens > compactionThreshold) {
      log.info("🔄 Proactive compaction triggered before processing", {
        sessionID: input.sessionID,
        currentTokens: estimatedInputTokens,
        threshold: compactionThreshold,
        contextLimit: model.info.limit.context,
        usageRatio: Math.round((estimatedInputTokens / model.info.limit.context) * 100) + "%"
      });
      
      // Check if we already have a recent summary
      const recentSummary = msgs.findLast(
        (msg) => msg.info.role === "assistant" && msg.info.summary === true
      );
      
      if (recentSummary) {
        // We already have a summary but still near limit - need meta-summary
        log.info("Creating meta-summary due to continued growth", {
          sessionID: input.sessionID,
          messagesSinceSummary: msgs.filter(m => m.info.id > recentSummary.info.id).length
        });
        
        // For now, do regular summarization (meta-summary will be implemented next)
        await summarize({
          sessionID: input.sessionID,
          providerID: input.providerID,
          modelID: input.modelID,
          autoCompactionOverride: true
        });
        
        // Refresh messages after summarization
        msgs = await messages(input.sessionID);
        const newLastSummary = msgs.findLast(
          (msg) => msg.info.role === "assistant" && msg.info.summary === true
        );
        if (newLastSummary) {
          msgs = msgs.filter((msg) => msg.info.id >= newLastSummary.info.id);
        }
      } else {
        // No summary yet, create one
        await summarize({
          sessionID: input.sessionID,
          providerID: input.providerID,
          modelID: input.modelID,
          autoCompactionOverride: true
        });
        
        // Refresh messages after summarization
        msgs = await messages(input.sessionID);
        const newLastSummary = msgs.findLast(
          (msg) => msg.info.role === "assistant" && msg.info.summary === true
        );
        if (newLastSummary) {
          msgs = msgs.filter((msg) => msg.info.id >= newLastSummary.info.id);
        }
      }
      
      // Recalculate tokens after compaction
      const newEstimatedTokens = await estimateRequestTokens(msgs, userParts, system);
      log.info("Proactive compaction completed", {
        sessionID: input.sessionID,
        oldTokens: estimatedInputTokens,
        newTokens: newEstimatedTokens,
        reduction: estimatedInputTokens - newEstimatedTokens,
        newUsageRatio: Math.round((newEstimatedTokens / model.info.limit.context) * 100) + "%"
      });
    }

    let stream;
    try {
      stream = streamText({
        onError(error) {
          const errorObj = error?.error || error;
          log.error("Stream error in onError handler", { 
            error: errorObj, 
            errorMessage: errorObj instanceof Error ? errorObj.message : String(errorObj),
            errorName: errorObj instanceof Error ? errorObj.name : '',
            sessionID: input.sessionID 
          });
          throw errorObj; // Re-enable error propagation for auto-compaction
        },
      async prepareStep({ messages }) {
        // Check if compacting - pause all queue processing during compaction
        if (state().compacting.has(input.sessionID)) {
          const compactingDuration = Date.now() - (state().compactionStartTime.get(input.sessionID) ?? Date.now());
          log.info("Queue processing paused - compaction in progress", {
            sessionID: input.sessionID,
            compactingDuration,
            compactingForSeconds: Math.round(compactingDuration / 1000)
          });
          return; // Skip all queue processing during compaction
        }
        
        // OPENCODE-INSPIRED QUEUE PROCESSING: Process queued messages within the same stream
        // This eliminates the need for recursive chat() calls and prevents context overflow
        
        const allQueuedItems = state().queued.get(input.sessionID) ?? [];
        const queue = allQueuedItems.filter((x) => !x.processed);
        
        // Spam detection
        const timeSinceLastMessage = queue.length > 0 && queue[queue.length - 1].timestamp
          ? Date.now() - queue[queue.length - 1].timestamp
          : Infinity;
          
        const isSpamming = queue.length > 10 || 
          (queue.length > 5 && timeSinceLastMessage < 1000);
        
        if (isSpamming) {
          log.warn("Spam detected - adjusting processing strategy", {
            sessionID: input.sessionID,
            queueLength: queue.length,
            timeSinceLastMessage
          });
        }
        
        // BATCH PROCESSING: Process only a safe batch size at a time
        // This prevents context overflow and ensures stable processing
        let BATCH_SIZE = isSpamming ? 1 : 3; // Process fewer messages when spamming
        
        if (queue.length > BATCH_SIZE) {
          log.info("batching queued items for safe processing", {
            sessionID: input.sessionID,
            totalQueue: queue.length,
            batchSize: BATCH_SIZE,
            remainingAfterBatch: queue.length - BATCH_SIZE,
            isSpamming
          });
          // Process only the first batch, leave the rest for next iteration
          queue.splice(BATCH_SIZE); // Keep only first BATCH_SIZE items
        }
        
        if (queue.length > 0) {
          // Check for stuck queue items (older than 5 minutes)
          const now = Date.now();
          const stuckItems = queue.filter(item => now - item.timestamp > 5 * 60 * 1000);
          if (stuckItems.length > 0) {
            log.warn("detected stuck queue items, marking as processed", {
              sessionID: input.sessionID,
              stuckCount: stuckItems.length,
              totalQueue: queue.length
            });
            for (const item of stuckItems) {
              item.processed = true;
            }
          }
          
          log.info("processing queued messages in prepareStep", {
            sessionID: input.sessionID,
            queueLength: queue.length,
            currentMessages: messages.length,
            stuckItemsCleared: stuckItems.length
          });
          
          // Estimate total context usage including queued messages
          const currentTokens = messages.reduce((total, msg) => {
            if (typeof msg.content === 'string') {
              return total + estimateTokens(msg.content);
            } else if (Array.isArray(msg.content)) {
              return total + msg.content.reduce((subtotal, part) => {
                if (part.type === 'text') {
                  return subtotal + estimateTokens(part.text);
                }
                return subtotal;
              }, 0);
            }
            return total;
          }, 0);
          
          const queueTokens = estimateQueueTokens(queue);
          const totalInputTokens = currentTokens + queueTokens;
          const contextLimit = model.info.limit.context || 200000;
          const outputLimit = Math.min(model.info.limit.output, OUTPUT_TOKEN_MAX) || OUTPUT_TOKEN_MAX;
          // Account for output tokens when checking if we'll fit
          const totalWithOutput = totalInputTokens + outputLimit;
          const usageRatio = totalWithOutput / contextLimit;
          
          log.info("context usage analysis in prepareStep", {
            sessionID: input.sessionID,
            currentTokens,
            queueTokens,
            totalInputTokens,
            outputReserved: outputLimit,
            totalWithOutput,
            contextLimit,
            usageRatio: Math.round(usageRatio * 100) + "%",
            batchSize: queue.length
          });
          
          // SMART THRESHOLD: Dynamic based on confidence
          const learning = state().tokenLearning.get(input.sessionID);
          const confidence = learning?.confidence || 0;
          const queueThreshold = getDynamicThresholdRatio(input.sessionID);
          
          if (usageRatio > queueThreshold) {
            log.warn("context usage too high, skipping queue processing in prepareStep", {
              sessionID: input.sessionID,
              usageRatio: Math.round(usageRatio * 100) + "%",
              threshold: Math.round(queueThreshold * 100) + "%",
              confidence: Math.round(confidence * 100) + "%"
            });
            
            // Mark queue items as processed to prevent infinite loops
            for (const item of queue) {
              item.processed = true;
            }
            
            log.info("queue items marked as processed due to high context usage", {
              sessionID: input.sessionID,
              skippedItems: queue.length
            });
            
            return { messages };
          }
          
          // Safe to add queued messages to current context
          for (const item of queue) {
            if (item.processed) continue;
            
            try {
              messages.push(...MessageV2.toModelMessage([{
                info: item.message,
                parts: item.parts,
              }]));
              
              item.processed = true;
              
              log.info("added queued message to stream", {
                sessionID: input.sessionID,
                messageId: item.message.id,
                queueItemId: item.id,
                totalMessages: messages.length
              });
            } catch (error) {
              log.error("failed to add queued message to stream", {
                error,
                sessionID: input.sessionID,
                queueItemId: item.id
              });
              item.processed = true; // Mark as processed to prevent retry loops
            }
          }
          
          // Create new assistant message for the batch processing
          assistantMsg.time.completed = Date.now();
          await updateMessage(assistantMsg);
          
          // Reset assistant message for new batch
          Object.assign(assistantMsg, {
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
          });
          
          await updateMessage(assistantMsg);
          
          // Check if there are more items remaining in the queue
          const remainingUnprocessed = allQueuedItems.filter(x => !x.processed).length;
          
          log.info("queue batch processing completed in prepareStep", {
            sessionID: input.sessionID,
            processedInBatch: queue.length,
            remainingInQueue: remainingUnprocessed,
            finalMessageCount: messages.length
          });
          
          // If there are still unprocessed items, they'll be handled in the next chat() call
          if (remainingUnprocessed > 0) {
            log.info("queue has remaining items for next batch", {
              sessionID: input.sessionID,
              remainingItems: remainingUnprocessed
            });
          }
        }

        log.debug("prepareStep completed", {
          sessionID: input.sessionID,
          messageCount: messages.length,
          queueProcessed: queue.length
        });

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
    } catch (streamCreationError) {
      log.error("Error creating streamText", {
        error: streamCreationError,
        errorMessage: streamCreationError?.message,
        errorName: streamCreationError?.name,
        sessionID: input.sessionID
      });
      
      // Check if this is a context error during stream creation
      const errorMsg = streamCreationError instanceof Error ? streamCreationError.message : String(streamCreationError);
      if (errorMsg.includes('prompt is too long') || errorMsg.includes('tokens') || errorMsg.includes('exceed')) {
        log.info("🔄 Context overflow during stream creation - attempting auto-compaction", {
          error: errorMsg,
          sessionID: input.sessionID,
        });
        
        try {
          const autoCompactResult = await handleSeamlessAutoCompaction(input, streamCreationError);
          if (autoCompactResult) {
            return autoCompactResult;
          }
        } catch (compactionError) {
          log.warn("Auto-compaction failed during stream creation", {
            error: compactionError instanceof Error ? compactionError.message : compactionError,
            sessionID: input.sessionID,
          });
        }
      }
      
      throw streamCreationError;
    }
    
    let result;
    log.debug("About to process stream", { sessionID: input.sessionID });
    try {
      result = await processor.process(stream);
    } catch (error) {
      log.debug("Caught error in stream processing", { 
        sessionID: input.sessionID,
        errorType: error?.constructor?.name,
        hasError: !!error 
      });
      // Enhanced context limit error detection for multiple providers
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : '';
      
      // Debug logging to track all errors
      log.debug("Stream processing error caught", {
        errorName,
        errorMessage,
        errorType: error?.constructor?.name,
        sessionID: input.sessionID,
      });
      
      const isContextLimitError = (
        errorMessage.includes('context limit') || 
        errorMessage.includes('exceed') ||
        errorMessage.includes('max_tokens') ||
        errorMessage.includes('context_length_exceeded') ||
        errorMessage.includes('maximum context length') ||
        errorMessage.includes('context window') ||
        errorMessage.includes('token limit') ||
        errorMessage.includes('prompt is too long') ||
        (errorMessage.includes('tokens') && errorMessage.includes('maximum')) ||
        errorName.includes('APICallError')
      );
      
      if (isContextLimitError) {
        const queue = state().queued.get(input.sessionID) ?? [];
        const queuedCount = queue.filter(item => !item.processed).length;
        
        // Check if already compacting
        if (state().compacting.has(input.sessionID)) {
          throw new Error(`⏳ Currently optimizing. ${queuedCount} messages waiting...`);
        }
        
        log.info("🔄 Context overflow detected - attempting seamless auto-compaction", {
          error: errorMessage,
          errorName: errorName,
          sessionID: input.sessionID,
          timestamp: new Date().toISOString(),
          queuedMessages: queuedCount
        });
        
        // SEAMLESS AUTO-COMPACTION: Try automatic summarization first
        try {
          const autoCompactResult = await handleSeamlessAutoCompaction(input, error);
          if (autoCompactResult) {
            return autoCompactResult;
          }
        } catch (compactionError) {
          log.warn("Auto-compaction failed, falling back to progressive chunking", {
            error: compactionError instanceof Error ? compactionError.message : compactionError,
            sessionID: input.sessionID,
          });
          
          // If compaction error is user-friendly, re-throw it
          if (compactionError instanceof Error && 
              (compactionError.message.includes('📊') || 
               compactionError.message.includes('⏳'))) {
            throw compactionError;
          }
        }
        
        log.info("Falling back to progressive chunking", {
          sessionID: input.sessionID,
        });
        
        // PROGRESSIVE CHUNKING: Fallback strategy when auto-compaction fails
        const chunkingTargets = [0.65, 0.50, 0.35];
        
        for (let i = 0; i < chunkingTargets.length; i++) {
          const target = chunkingTargets[i];
          log.info(`attempting chunking with ${Math.round(target * 100)}% target`, {
            sessionID: input.sessionID,
            attempt: i + 1,
            targetPercentage: Math.round(target * 100) + "%"
          });
          
          try {
            // Pass the target percentage to the chunking function
            return await handleContextOverflowWithChunking(input, error, target);
          } catch (chunkingError) {
            log.warn(`chunking failed at ${Math.round(target * 100)}%`, {
              error: chunkingError,
              sessionID: input.sessionID,
              attempt: i + 1
            });
            
            // If this wasn't the last attempt, try again with more aggressive chunking
            if (i < chunkingTargets.length - 1) {
              continue;
            }
            
            // All recovery strategies failed
            log.error("All context recovery strategies failed", {
              error: chunkingError,
              sessionID: input.sessionID,
              attempts: chunkingTargets.length
            });
            
            // Return a helpful error message to the user
            const errorResult = {
              info: {
                id: Identifier.ascending("message"),
                role: "assistant" as const,
                sessionID: input.sessionID,
                time: { created: Date.now() },
                error: {
                  name: "ContextLimitError" as const,
                  data: { 
                    message: "Context limit exceeded. Please start a new session or manually trigger summarization.",
                    originalError: error.message
                  },
                },
              },
              parts: [{
                id: Identifier.ascending("part"),
                type: "text" as const,
                text: "📊 Let me optimize our conversation to continue...",
                messageID: Identifier.ascending("message"),
                sessionID: input.sessionID
              }],
            };
            
            return errorResult as any;
          }
        }
      }
      
      log.error("Error processing stream", {
        error,
        sessionID: input.sessionID,
      });

      // Clean up any pending queue items on error
      const currentQueue = state().queued.get(input.sessionID) ?? [];
      if (currentQueue.length > 0) {
        log.info("Cleaning up queue due to processing error", {
          sessionID: input.sessionID,
          queueLength: currentQueue.length,
        });

        // Call callbacks with error to prevent hanging promises
        for (const item of currentQueue) {
          try {
            // Create a minimal error result to satisfy the callback type
            const errorResult = {
              info: {
                id: Identifier.ascending("message"),
                role: "assistant" as const,
                sessionID: input.sessionID,
                time: { created: Date.now() },
                error: {
                  name: "UnknownError" as const,
                  data: { message: error.message },
                },
              },
              parts: [],
            };
            item.callback(errorResult);
          } catch (callbackError) {
            log.error("Error calling queue callback", {
              callbackError,
              sessionID: input.sessionID,
            });
          }
        }

        // Clear the queue
        state().queued.delete(input.sessionID);
      }

      throw error;
    }

    // BATCH-AWARE QUEUE COMPLETION: Handle queue callbacks after successful batch processing
    const processedQueue = state().queued.get(input.sessionID) ?? [];
    const processedItems = processedQueue.filter(item => item.processed);
    const unprocessedItems = processedQueue.filter(item => !item.processed);
    
    log.info("queue callback processing", {
      sessionID: input.sessionID,
      totalQueue: processedQueue.length,
      processedCount: processedItems.length,
      unprocessedCount: unprocessedItems.length
    });
    
    if (processedItems.length > 0) {
      log.info("completing callbacks for processed batch", {
        sessionID: input.sessionID,
        processedCount: processedItems.length
      });
      
      // Call callbacks for all processed items
      let successfulCallbacks = 0;
      for (const item of processedItems) {
        try {
          item.callback(result);
          successfulCallbacks++;
          log.debug("queue callback completed", {
            sessionID: input.sessionID,
            itemId: item.id
          });
        } catch (callbackError) {
          log.error("Error calling queue callback", {
            callbackError,
            sessionID: input.sessionID,
            itemId: item.id
          });
        }
      }
      
      // Remove processed items from queue
      if (unprocessedItems.length === 0) {
        state().queued.delete(input.sessionID);
        log.info("queue completely cleared", { sessionID: input.sessionID });
      } else {
        state().queued.set(input.sessionID, unprocessedItems);
        log.info("queue updated with remaining items", {
          sessionID: input.sessionID,
          remainingItems: unprocessedItems.length
        });
        
        // AUTOMATIC BATCH PROCESSING: Trigger next batch if session is no longer locked
        // This ensures all queued messages eventually get processed
        setTimeout(() => {
          // Double-check that session is truly not locked before retrying
          if (!state().pending.has(input.sessionID) && unprocessedItems.length > 0) {
            log.info("triggering next batch processing", {
              sessionID: input.sessionID,
              remainingItems: unprocessedItems.length
            });
            
            // Process next batch by calling chat with a synthetic trigger
            // The first unprocessed item will be picked up in the next prepareStep
            const firstUnprocessed = unprocessedItems[0];
            if (firstUnprocessed && !firstUnprocessed.processed) {
              // Add another check right before calling chat
              if (!state().pending.has(input.sessionID)) {
                chat(firstUnprocessed.input).catch(error => {
                  log.error("Failed to process next batch", {
                    error,
                    sessionID: input.sessionID
                  });
                });
              } else {
                log.info("skipping batch retry - session became busy", {
                  sessionID: input.sessionID
                });
              }
            }
          }
        }, 500); // Increased delay to 500ms to avoid race conditions
      }
      
      log.info("queue batch cleanup completed", {
        sessionID: input.sessionID,
        processedItems: processedItems.length,
        successfulCallbacks,
        remainingItems: unprocessedItems.length
      });
    } else if (processedQueue.length > 0) {
      log.warn("queue has items but none marked as processed in this batch", {
        sessionID: input.sessionID,
        queueLength: processedQueue.length
      });
    }

    return result;
  }

  function createProcessor(
    assistantMsg: MessageV2.Assistant,
    model: ModelsDev.Model,
    estimatedInputTokens: number,
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
                
                // Track token accuracy for learning
                if (estimatedInputTokens > 0 && value.usage.inputTokens) {
                  log.debug("Tracking token accuracy", {
                    sessionID: assistantMsg.sessionID,
                    estimatedInputTokens,
                    actualInputTokens: value.usage.inputTokens,
                    actualOutputTokens: value.usage.outputTokens,
                    cachedTokens: value.usage.cachedInputTokens || 0
                  });
                  trackTokenAccuracy(assistantMsg.sessionID, estimatedInputTokens, {
                    input: value.usage.inputTokens || 0,
                    cache: {
                      read: value.usage.cachedInputTokens || 0,
                      write: 0
                    }
                  });
                }
                
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
                  const textDelta =
                    (value as any).textDelta || (value as any).text || "";
                  currentText.text += textDelta;
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
    autoCompactionOverride?: boolean; // Allow bypassing cooldown for auto-compaction
  }) {
    // Check if we've summarized recently to prevent multiple summarizations
    const now = Date.now();
    const lastSummarization = state().recentSummarizations.get(input.sessionID);
    const SUMMARIZATION_COOLDOWN = 30000; // 30 seconds cooldown

    // Allow auto-compaction to bypass cooldown for seamless user experience
    if (!input.autoCompactionOverride && lastSummarization && now - lastSummarization < SUMMARIZATION_COOLDOWN) {
      log.info("skipping summarization due to recent summarization", {
        sessionID: input.sessionID,
        lastSummarization,
        cooldownRemaining: SUMMARIZATION_COOLDOWN - (now - lastSummarization),
      });
      return; // Skip summarization if done recently
    }
    
    if (input.autoCompactionOverride) {
      log.info("Auto-compaction override: bypassing summarization cooldown", {
        sessionID: input.sessionID,
        timeSinceLastSummary: lastSummarization ? now - lastSummarization : "never"
      });
    }
    
    // CHECK LOCK BEFORE ATTEMPTING: Prevent "session is busy" errors
    if (state().pending.has(input.sessionID)) {
      log.info("skipping summarization - session is busy", {
        sessionID: input.sessionID
      });
      return; // Don't try to summarize if session is locked
    }

    // Track this summarization attempt
    state().recentSummarizations.set(input.sessionID, now);
    
    // Set compacting flag
    state().compacting.add(input.sessionID);
    state().compactionStartTime.set(input.sessionID, now);
    
    // Create user notification if not already notified
    if (!state().compactionNotified.has(input.sessionID)) {
      const queue = state().queued.get(input.sessionID) ?? [];
      const queuedCount = queue.filter(item => !item.processed).length;
      
      // Create user-visible notification message
      const notificationMsg: MessageV2.Info = {
        id: Identifier.ascending("message"),
        role: "assistant",
        sessionID: input.sessionID,
        system: [],
        mode: "chat",
        path: {
          cwd: process.cwd(),
          root: process.cwd(),
        },
        summary: false,
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
      
      await updateMessage(notificationMsg);
      
      const notificationPart: MessageV2.Part = {
        id: Identifier.ascending("part"),
        type: "text",
        text: queuedCount > 0 
          ? `🔄 Optimizing conversation memory (${queuedCount} messages waiting)...`
          : `🔄 Optimizing conversation memory...`,
        messageID: notificationMsg.id,
        sessionID: input.sessionID,
      };
      
      await updatePart(notificationPart);
      state().compactionNotified.add(input.sessionID);
    }

    using abortSignal = lock(input.sessionID);
    
    try {
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

    const processor = createProcessor(next, model.info, 0);

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
      
      // Add completion notification
      if (state().compactionNotified.has(input.sessionID)) {
        const queue = state().queued.get(input.sessionID) ?? [];
        const queuedCount = queue.filter(item => !item.processed).length;
        
        const completionMsg: MessageV2.Info = {
          id: Identifier.ascending("message"),
          role: "assistant",
          sessionID: input.sessionID,
          system: [],
          mode: "chat",
          path: {
            cwd: process.cwd(),
            root: process.cwd(),
          },
          summary: false,
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
        
        await updateMessage(completionMsg);
        
        const completionPart: MessageV2.Part = {
          id: Identifier.ascending("part"),
          type: "text",
          text: queuedCount > 0
            ? `✅ Conversation optimized! Processing your ${queuedCount} messages...`
            : `✅ Conversation optimized! You can continue normally.`,
          messageID: completionMsg.id,
          sessionID: input.sessionID,
        };
        
        await updatePart(completionPart);
        
        // Clear notification flag after cooldown
        setTimeout(() => {
          state().compactionNotified.delete(input.sessionID);
        }, 60000); // 1 minute cooldown
      }
      
      return result;
    } finally {
      // Always clear compacting flag, even if error occurs
      state().compacting.delete(input.sessionID);
    }
  }

  // Old processQueue function removed - replaced with simpler processNextInQueue

  export class BusyError extends Error {
    constructor(public readonly sessionID: string) {
      super(`Session ${sessionID} is busy`);
    }
  }

  export function isLocked(sessionID: string) {
    return state().pending.has(sessionID);
  }

  // Export state for testing and debugging
  export function getState() {
    return state();
  }

  // Force cleanup for testing
  export function forceCleanup(sessionID?: string) {
    const currentState = state();

    if (sessionID) {
      // Clean up specific session
      if (currentState.pending.has(sessionID)) {
        const controller = currentState.pending.get(sessionID);
        controller?.abort();
        currentState.pending.delete(sessionID);
        log.info("Force cleaned up session", { sessionID });
      }

      if (currentState.queued.has(sessionID)) {
        // Clear timeouts for all queued items
        const queuedItems = currentState.queued.get(sessionID) ?? [];
        queuedItems.forEach((item) => {
          if (item.timeoutHandle) {
            clearTimeout(item.timeoutHandle);
          }
        });
        currentState.queued.delete(sessionID);
        log.info("Force cleaned up queue", { sessionID });
      }
    } else {
      // Clean up all sessions
      const pendingCount = currentState.pending.size;
      const queuedCount = currentState.queued.size;

      for (const [id, controller] of currentState.pending) {
        controller.abort();
      }
      currentState.pending.clear();

      // Clear all timeouts before clearing queues
      for (const [sessionID, queuedItems] of currentState.queued) {
        queuedItems.forEach((item) => {
          if (item.timeoutHandle) {
            clearTimeout(item.timeoutHandle);
          }
        });
      }
      currentState.queued.clear();

      log.info("Force cleaned up all sessions", { pendingCount, queuedCount });
    }
  }

  // Initialize session system and clean up stale locks
  export function initializeSystem() {
    log.info("Initializing session system");

    // Force cleanup any stale state from previous runs
    forceCleanup();

    // Clear any stale summarization tracking
    const currentState = state();
    currentState.recentSummarizations.clear();

    log.info("Session system initialized and cleaned up");
  }
  export function lock(sessionID: string) {
    // Input validation for security
    if (!sessionID || typeof sessionID !== "string") {
      throw new Error("Invalid sessionID");
    }

    log.info("locking", { sessionID });

    if (state().pending.has(sessionID)) {
      throw new BusyError(sessionID);
    }

    const controller = new AbortController();
    state().pending.set(sessionID, controller);
    
    // AUTO-UNLOCK TIMEOUT: Prevent locks from being held forever during errors
    // This helps prevent "session is busy" errors from stuck locks
    const lockTimeout = setTimeout(() => {
      if (state().pending.has(sessionID)) {
        log.warn("auto-unlocking session due to timeout", {
          sessionID,
          timeout: "5 minutes"
        });
        state().pending.delete(sessionID);
        controller.abort();
        Bus.publish(Event.Idle, { sessionID });
      }
    }, 5 * 60 * 1000); // 5 minute timeout

    return {
      signal: controller.signal,
      [Symbol.dispose]() {
        log.info("unlocking", { sessionID });
        clearTimeout(lockTimeout); // Clear the timeout when lock is released normally
        state().pending.delete(sessionID);

        // Queue processing now happens in prepareStep - no need for recursive processing
        // Just publish idle event
        Bus.publish(Event.Idle, { sessionID });
      },
    };
  }

  // REMOVED: processNextInQueue function - replaced with OpenCode-style prepareStep processing
  // Queue processing now happens within the same stream in prepareStep, eliminating recursion
  // This prevents the 70% context issue and improves performance

  /**
   * Seamless Auto-Compaction: Handle context overflow by automatically summarizing
   * the conversation and retrying the user's message with compacted context.
   * This provides a transparent user experience without showing context errors.
   */
  async function handleSeamlessAutoCompaction(
    input: z.infer<typeof ChatInput>,
    originalError: Error
  ): Promise<{ info: MessageV2.Assistant; parts: MessageV2.Part[] } | null> {
    log.info("Starting seamless auto-compaction", {
      sessionID: input.sessionID,
      originalError: originalError.message
    });
    
    // Check if we're already compacting
    if (state().compacting.has(input.sessionID)) {
      log.info("Auto-compaction skipped - already compacting", {
        sessionID: input.sessionID,
        compactingDuration: Date.now() - (state().compactionStartTime.get(input.sessionID) ?? 0)
      });
      throw new Error("⏳ Currently optimizing conversation. Please wait a moment...");
    }

    try {
      // Check if we recently summarized to avoid infinite loops
      const now = Date.now();
      const lastSummarization = state().recentSummarizations.get(input.sessionID);
      const ENHANCED_COOLDOWN = 60000; // 1 minute for auto-compaction to prevent loops
      
      if (lastSummarization && now - lastSummarization < ENHANCED_COOLDOWN) {
        log.warn("Auto-compaction skipped - too recent", {
          sessionID: input.sessionID,
          timeSinceLastSummary: now - lastSummarization,
          cooldown: ENHANCED_COOLDOWN
        });
        
        // Return user-friendly error
        throw new Error("📊 Conversation is very long. Please start a new session or wait a moment before continuing.");
      }

      // Get current messages to check if summarization would help
      const msgs = await messages(input.sessionID);
      if (msgs.length < 10) {
        log.info("Auto-compaction skipped - not enough messages to summarize", {
          sessionID: input.sessionID,
          messageCount: msgs.length
        });
        return null;
      }

      log.info("Triggering automatic summarization", {
        sessionID: input.sessionID,
        messageCount: msgs.length
      });

      // Trigger summarization with override for auto-compaction
      await summarize({
        sessionID: input.sessionID,
        providerID: input.providerID,
        modelID: input.modelID,
        autoCompactionOverride: true // Special flag to bypass cooldown
      });

      log.info("Auto-compaction summarization completed, retrying user request", {
        sessionID: input.sessionID
      });

      // Retry the original request with compacted context
      return await chat(input);
      
    } catch (error) {
      log.error("Auto-compaction failed", {
        error: error instanceof Error ? error.message : error,
        sessionID: input.sessionID
      });
      
      // Return null to indicate auto-compaction failed, fallback to chunking
      return null;
    }
  }

  /**
   * Handle Large Input Chunking: Process oversized user inputs by intelligently
   * splitting them into manageable chunks and processing sequentially.
   * This enables handling of arbitrarily large files and content.
   */
  async function handleLargeInputChunking(
    input: z.infer<typeof ChatInput>,
    msgs: { info: MessageV2.Info; parts: MessageV2.Part[] }[],
    system: string[],
    model: ModelsDev.Model,
    assistantMsg: MessageV2.Assistant
  ): Promise<{ info: MessageV2.Assistant; parts: MessageV2.Part[] }> {
    log.info("Starting large input chunking", {
      sessionID: input.sessionID,
      originalParts: input.parts.length
    });

    // Separate file parts from other parts
    const fileParts = input.parts.filter(p => p.type === 'file') as Array<z.infer<typeof MessageV2.FilePart>>;
    const textParts = input.parts.filter(p => p.type === 'text') as Array<z.infer<typeof MessageV2.TextPart>>;
    const otherParts = input.parts.filter(p => p.type !== 'file' && p.type !== 'text');
    
    // Calculate base context size (messages + system prompts)
    const baseTokens = await estimateRequestTokens(msgs, [], system);
    const outputBuffer = model.limit.output || OUTPUT_TOKEN_MAX;
    const contextLimit = model.limit.context || 200000;
    const availableForInput = contextLimit - baseTokens - outputBuffer;
    
    log.info("Chunking calculation", {
      sessionID: input.sessionID,
      baseTokens,
      outputBuffer,
      contextLimit,
      availableForInput,
      fileParts: fileParts.length,
      textParts: textParts.length
    });

    // Create chunks of input that fit within available space
    const chunks = await createInputChunks(
      fileParts, 
      textParts, 
      availableForInput,
      input.sessionID
    );
    
    if (chunks.length === 0) {
      log.error("Failed to create any chunks from input", {
        sessionID: input.sessionID
      });
      throw new Error("Input too large to process even in chunks");
    }

    log.info("Created input chunks", {
      sessionID: input.sessionID,
      chunkCount: chunks.length,
      chunksInfo: chunks.map(c => ({
        files: c.fileParts.length,
        texts: c.textParts.length,
        estimatedTokens: c.estimatedTokens
      }))
    });

    // Process each chunk sequentially
    const responses: { info: MessageV2.Assistant; parts: MessageV2.Part[] }[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isFirstChunk = i === 0;
      const isLastChunk = i === chunks.length - 1;
      
      log.info(`Processing chunk ${i + 1} of ${chunks.length}`, {
        sessionID: input.sessionID,
        chunkTokens: chunk.estimatedTokens
      });

      // Create input for this chunk
      const chunkInput: z.infer<typeof ChatInput> = {
        ...input,
        parts: [
          ...otherParts, // Always include other parts (like images)
          ...chunk.textParts,
          ...chunk.fileParts
        ]
      };

      // Add context about chunking if multiple chunks
      if (chunks.length > 1) {
        const chunkContext = {
          id: Identifier.ascending("part"),
          type: "text" as const,
          text: `📦 Processing chunk ${i + 1} of ${chunks.length}. ${
            isFirstChunk ? "This is the first chunk." :
            isLastChunk ? "This is the final chunk." :
            "More chunks will follow."
          }`,
          messageID: Identifier.ascending("message"),
          sessionID: input.sessionID,
          synthetic: true
        };
        chunkInput.parts.unshift(chunkContext);
      }

      try {
        // Process this chunk
        const chunkResponse = await chat(chunkInput);
        responses.push(chunkResponse);
        
        // If not the last chunk and context is getting full, summarize
        if (!isLastChunk && i % 2 === 1) { // Summarize every 2 chunks
          log.info("Auto-compacting between chunks", {
            sessionID: input.sessionID,
            afterChunk: i + 1
          });
          
          await summarize({
            sessionID: input.sessionID,
            providerID: input.providerID,
            modelID: input.modelID,
            autoCompactionOverride: true
          });
        }
      } catch (error) {
        log.error(`Failed to process chunk ${i + 1}`, {
          error,
          sessionID: input.sessionID,
          chunkIndex: i
        });
        
        // Create error response for this chunk
        const errorPart: MessageV2.Part = {
          id: Identifier.ascending("part"),
          type: "text" as const,
          text: `❌ Error processing chunk ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`,
          messageID: assistantMsg.id,
          sessionID: input.sessionID
        };
        
        responses.push({
          info: assistantMsg,
          parts: [errorPart]
        });
      }
    }

    // Aggregate all responses
    return aggregateChunkedResponses(responses, assistantMsg, input.sessionID);
  }

  /**
   * Create chunks from file and text parts that fit within token limits
   */
  async function createInputChunks(
    fileParts: Array<z.infer<typeof MessageV2.FilePart>>,
    textParts: Array<z.infer<typeof MessageV2.TextPart>>,
    maxTokensPerChunk: number,
    sessionID: string
  ): Promise<Array<{
    fileParts: Array<z.infer<typeof MessageV2.FilePart>>,
    textParts: Array<z.infer<typeof MessageV2.TextPart>>,
    estimatedTokens: number
  }>> {
    const chunks: Array<{
      fileParts: Array<z.infer<typeof MessageV2.FilePart>>,
      textParts: Array<z.infer<typeof MessageV2.TextPart>>,
      estimatedTokens: number
    }> = [];
    
    let currentChunk = {
      fileParts: [] as Array<z.infer<typeof MessageV2.FilePart>>,
      textParts: [] as Array<z.infer<typeof MessageV2.TextPart>>,
      estimatedTokens: 0
    };

    // Process text parts first (usually smaller)
    for (const textPart of textParts) {
      const textTokens = estimateTokens(textPart.text);
      
      if (textTokens > maxTokensPerChunk) {
        // Split large text into smaller parts
        const splitTexts = splitLargeText(textPart.text, maxTokensPerChunk);
        for (const splitText of splitTexts) {
          const splitPart = { ...textPart, text: splitText };
          const splitTokens = estimateTokens(splitText);
          
          if (currentChunk.estimatedTokens + splitTokens > maxTokensPerChunk && 
              (currentChunk.fileParts.length > 0 || currentChunk.textParts.length > 0)) {
            chunks.push({ ...currentChunk });
            currentChunk = {
              fileParts: [],
              textParts: [splitPart],
              estimatedTokens: splitTokens
            };
          } else {
            currentChunk.textParts.push(splitPart);
            currentChunk.estimatedTokens += splitTokens;
          }
        }
      } else if (currentChunk.estimatedTokens + textTokens > maxTokensPerChunk && 
                 (currentChunk.fileParts.length > 0 || currentChunk.textParts.length > 0)) {
        chunks.push({ ...currentChunk });
        currentChunk = {
          fileParts: [],
          textParts: [textPart],
          estimatedTokens: textTokens
        };
      } else {
        currentChunk.textParts.push(textPart);
        currentChunk.estimatedTokens += textTokens;
      }
    }

    // Process file parts
    for (const filePart of fileParts) {
      // Extract file content to estimate tokens
      const fileContent = await extractFileContent(filePart);
      const fileTokens = estimateTokens(fileContent);
      
      if (fileTokens > maxTokensPerChunk) {
        // File too large for single chunk - split it
        log.info("Splitting large file", {
          sessionID,
          filename: filePart.filename || "unknown",
          fileTokens,
          maxTokensPerChunk
        });
        
        const splitFiles = await splitLargeFile(filePart, fileContent, maxTokensPerChunk);
        for (const splitFile of splitFiles) {
          const splitTokens = estimateTokens(await extractFileContent(splitFile));
          
          if (currentChunk.estimatedTokens + splitTokens > maxTokensPerChunk && 
              (currentChunk.fileParts.length > 0 || currentChunk.textParts.length > 0)) {
            chunks.push({ ...currentChunk });
            currentChunk = {
              fileParts: [splitFile],
              textParts: [],
              estimatedTokens: splitTokens
            };
          } else {
            currentChunk.fileParts.push(splitFile);
            currentChunk.estimatedTokens += splitTokens;
          }
        }
      } else if (currentChunk.estimatedTokens + fileTokens > maxTokensPerChunk && 
                 (currentChunk.fileParts.length > 0 || currentChunk.textParts.length > 0)) {
        chunks.push({ ...currentChunk });
        currentChunk = {
          fileParts: [filePart],
          textParts: [],
          estimatedTokens: fileTokens
        };
      } else {
        currentChunk.fileParts.push(filePart);
        currentChunk.estimatedTokens += fileTokens;
      }
    }

    // Add final chunk if not empty
    if (currentChunk.fileParts.length > 0 || currentChunk.textParts.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Extract content from a file part
   */
  async function extractFileContent(filePart: z.infer<typeof MessageV2.FilePart>): Promise<string> {
    if (filePart.type !== 'file') return '';
    
    // Handle data URLs
    if (filePart.url?.startsWith('data:')) {
      try {
        const base64Data = filePart.url.split(',')[1] || filePart.url;
        return Buffer.from(base64Data, 'base64').toString('utf-8');
      } catch (error) {
        log.error("Failed to extract file content from data URL", {
          error,
          filename: filePart.filename
        });
        return '';
      }
    }
    
    // For file:// URLs, would need to read from disk
    // For now, return empty string for unknown URL types
    return '';
  }

  /**
   * Split large text into smaller chunks at natural boundaries
   */
  function splitLargeText(text: string, maxTokensPerChunk: number): string[] {
    const chunks: string[] = [];
    const maxCharsPerChunk = Math.floor(maxTokensPerChunk * 3.5); // Rough estimate
    
    // Try to split at natural boundaries
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > maxCharsPerChunk && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = paragraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    // If we still have chunks that are too large, split them further
    const finalChunks: string[] = [];
    for (const chunk of chunks) {
      if (estimateTokens(chunk) > maxTokensPerChunk) {
        // Forcefully split at character boundary
        const subChunks = [];
        for (let i = 0; i < chunk.length; i += maxCharsPerChunk) {
          subChunks.push(chunk.slice(i, i + maxCharsPerChunk));
        }
        finalChunks.push(...subChunks);
      } else {
        finalChunks.push(chunk);
      }
    }
    
    return finalChunks;
  }

  /**
   * Split a large file into smaller chunks
   */
  async function splitLargeFile(
    filePart: z.infer<typeof MessageV2.FilePart>,
    content: string,
    maxTokensPerChunk: number
  ): Promise<Array<z.infer<typeof MessageV2.FilePart>>> {
    const chunks = splitLargeText(content, maxTokensPerChunk);
    
    return chunks.map((chunk, index) => ({
      ...filePart,
      url: `data:text/plain;base64,${Buffer.from(chunk).toString('base64')}`,
      // Chunk metadata could be stored elsewhere if needed
      filename: `${filePart.filename} (chunk ${index + 1}/${chunks.length})`
    }));
  }

  /**
   * Aggregate responses from multiple chunks into a single response
   */
  function aggregateChunkedResponses(
    responses: { info: MessageV2.Assistant; parts: MessageV2.Part[] }[],
    assistantMsg: MessageV2.Assistant,
    sessionID: string
  ): { info: MessageV2.Assistant; parts: MessageV2.Part[] } {
    if (responses.length === 0) {
      return {
        info: assistantMsg,
        parts: [{
          id: Identifier.ascending("part"),
          type: "text" as const,
          text: "No responses generated from chunks.",
          messageID: assistantMsg.id,
          sessionID
        }]
      };
    }

    // Combine all parts from all responses
    const allParts: MessageV2.Part[] = [];
    let totalCost = 0;
    let totalTokens = {
      input: 0,
      output: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 }
    };

    // Add header if multiple chunks
    if (responses.length > 1) {
      allParts.push({
        id: Identifier.ascending("part"),
        type: "text" as const,
        text: `📦 Processed ${responses.length} chunks. Here's the combined response:\n\n`,
        messageID: assistantMsg.id,
        sessionID,
        synthetic: true
      });
    }

    // Aggregate all response parts
    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      
      // Add chunk separator if multiple chunks
      if (responses.length > 1 && i > 0) {
        allParts.push({
          id: Identifier.ascending("part"),
          type: "text" as const,
          text: `\n---\n`,
          messageID: assistantMsg.id,
          sessionID,
          synthetic: true
        });
      }
      
      // Add all parts from this response
      allParts.push(...response.parts);
      
      // Aggregate costs and tokens
      if (response.info.cost) totalCost += response.info.cost;
      if (response.info.tokens) {
        totalTokens.input += response.info.tokens.input || 0;
        totalTokens.output += response.info.tokens.output || 0;
        totalTokens.reasoning += response.info.tokens.reasoning || 0;
        totalTokens.cache.read += response.info.tokens.cache?.read || 0;
        totalTokens.cache.write += response.info.tokens.cache?.write || 0;
      }
    }

    // Update assistant message with aggregated data
    const aggregatedInfo: MessageV2.Assistant = {
      ...assistantMsg,
      cost: totalCost,
      tokens: totalTokens,
      time: {
        ...assistantMsg.time,
        completed: Date.now()
      }
    };

    return {
      info: aggregatedInfo,
      parts: allParts
    };
  }

  async function handleContextOverflowWithChunking(
    input: z.infer<typeof ChatInput>,
    originalError: Error,
    targetRatio: number = 0.65
  ): Promise<{ info: MessageV2.Assistant; parts: MessageV2.Part[] }> {
    log.info("implementing improved context overflow chunking strategy", {
      sessionID: input.sessionID,
      originalError: originalError.message,
      targetRatio
    });

    // Get current messages and model info
    const msgs = await messages(input.sessionID);
    const model = await Provider.getModel(input.providerID, input.modelID);
    const contextLimit = model.info.limit.context || 200000;
    const outputLimit = Math.min(model.info.limit.output, OUTPUT_TOKEN_MAX) || OUTPUT_TOKEN_MAX;
    
    // IMPORTANT: Reserve space for output tokens when calculating input limit
    // The error "196454 + 32000 > 200000" shows we need to account for output
    const availableForInput = contextLimit - outputLimit;
    const targetTokens = Math.floor(availableForInput * targetRatio);
    
    // Find the last summary to use as a baseline
    const lastSummary = msgs.findLast(
      (msg) => msg.info.role === "assistant" && msg.info.summary === true
    );
    
    // SMART CHUNKING STRATEGY: Keep important context
    let chunkedMsgs = [...msgs];
    let currentTokens = await estimateRequestTokens(chunkedMsgs, input.parts, []);
    
    // Strategy 1: If we have a summary, start from there
    if (lastSummary && currentTokens + outputLimit > targetTokens) {
      const summaryIndex = msgs.findIndex(msg => msg.info.id === lastSummary.info.id);
      chunkedMsgs = msgs.slice(summaryIndex); // Keep everything after the summary
      currentTokens = await estimateRequestTokens(chunkedMsgs, input.parts, []);
      
      log.info("using summary as baseline for chunking", {
        sessionID: input.sessionID,
        summaryId: lastSummary.info.id,
        messagesAfterSummary: chunkedMsgs.length,
        estimatedTokens: currentTokens
      });
    }
    
    // Strategy 2: Smart removal - keep most recent and important messages
    if (currentTokens + outputLimit > targetTokens && chunkedMsgs.length > 1) {
      // Keep the most recent N messages that fit
      const recentMessages = [];
      let tokensUsed = 0;
      
      // Work backwards from most recent
      for (let i = chunkedMsgs.length - 1; i >= 0; i--) {
        const msg = chunkedMsgs[i];
        const msgTokens = await estimateRequestTokens([msg], [], []);
        
        if (tokensUsed + msgTokens + outputLimit <= targetTokens) {
          recentMessages.unshift(msg);
          tokensUsed += msgTokens;
        } else if (i === chunkedMsgs.length - 1) {
          // Always keep the most recent message, even if truncated
          recentMessages.unshift(msg);
          break;
        } else {
          // Stop adding older messages
          break;
        }
      }
      
      chunkedMsgs = recentMessages;
      currentTokens = tokensUsed;
      
      log.info("smart chunking completed", {
        sessionID: input.sessionID,
        originalMessages: msgs.length,
        keptMessages: chunkedMsgs.length,
        estimatedTokens: currentTokens
      });
    }

    // Strategy 3: If input is too large, intelligently truncate it
    if (currentTokens + outputLimit > targetTokens) {
      log.warn("truncating input parts due to context overflow", {
        sessionID: input.sessionID,
        originalParts: input.parts.length
      });
      
      const maxInputTokens = Math.floor((targetTokens - currentTokens) * 0.5); // Use 50% of remaining space
      const truncatedParts = [];
      let partsTokens = 0;
      
      // Prioritize keeping file parts and recent text
      for (const part of input.parts) {
        if (part.type === 'file') {
          // Always keep file parts if possible (they're important context)
          truncatedParts.push(part);
        } else if (part.type === 'text') {
          const partTokens = estimateTokens(part.text);
          if (partsTokens + partTokens <= maxInputTokens) {
            truncatedParts.push(part);
            partsTokens += partTokens;
          } else if (partsTokens < maxInputTokens * 0.8) {
            // Truncate this text part to fit
            const remainingTokens = maxInputTokens - partsTokens;
            const maxChars = Math.floor(remainingTokens * 3.5);
            if (maxChars > 200) { // Only include if meaningful
              truncatedParts.push({
                ...part,
                text: part.text.substring(0, maxChars) + "\n\n[Message truncated due to length]"
              });
              partsTokens += remainingTokens;
            }
          }
        } else {
          // Keep other part types if space allows
          const partTokens = 100; // Estimate for non-text parts
          if (partsTokens + partTokens <= maxInputTokens) {
            truncatedParts.push(part);
            partsTokens += partTokens;
          }
        }
      }
      
      input.parts = truncatedParts;
    }

    log.info("context chunking completed", {
      sessionID: input.sessionID,
      finalMessages: chunkedMsgs.length,
      finalParts: input.parts.length,
      estimatedTokens: await estimateRequestTokens(chunkedMsgs, input.parts, []),
      targetTokens,
      contextLimit
    });

    // Create a new chat request with chunked context
    const chunkedInput = {
      ...input,
      parts: input.parts
    };

    // Only add warning if we actually removed significant content
    if (msgs.length - chunkedMsgs.length > 2) {
      chunkedInput.parts.unshift({
        id: Identifier.ascending("part"),
        type: "text" as const,
        text: `📝 Context optimized: Showing recent ${chunkedMsgs.length} of ${msgs.length} messages to stay within limits.`,
        synthetic: true
      });
    }

    // Retry with chunked context
    return chat(chunkedInput);
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

  /**
   * Helper function to calculate variance for confidence scoring
   */
  function calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 1;
    const mean = numbers.reduce((a, b) => a + b) / numbers.length;
    const variance = numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length;
    return Math.min(variance / mean, 1); // Normalize to 0-1
  }

  /**
   * Track token estimation accuracy and learn from actual API responses
   */
  function trackTokenAccuracy(
    sessionID: string,
    estimatedTokens: number,
    actualUsage: { input: number; cache: { read: number; write: number } }
  ) {
    const actualTotal = actualUsage.input + actualUsage.cache.read + actualUsage.cache.write;
    
    log.info("Learning from token usage", {
      sessionID,
      estimatedTokens,
      actualTotal,
      actualInput: actualUsage.input,
      actualCache: actualUsage.cache.read,
      accuracy: Math.round((Math.min(estimatedTokens, actualTotal) / Math.max(estimatedTokens, actualTotal)) * 100) + "%"
    });
    
    // Get or create learning data
    let learning = state().tokenLearning.get(sessionID);
    if (!learning) {
      learning = {
        samples: [],
        currentRatio: 2.2,
        confidence: 0
      };
      state().tokenLearning.set(sessionID, learning);
    }
    
    // Calculate character count from our estimate (reverse engineering)
    const charCount = estimatedTokens * learning.currentRatio;
    
    // Add new sample
    learning.samples.push({
      estimated: estimatedTokens,
      actual: actualTotal,
      charCount,
      ratio: charCount / actualTotal,
      timestamp: Date.now()
    });
    
    // Keep only recent samples (last 20)
    if (learning.samples.length > 20) {
      learning.samples = learning.samples.slice(-20);
    }
    
    // Update ratio using weighted average (recent samples matter more)
    let weightedSum = 0;
    let totalWeight = 0;
    const now = Date.now();
    
    for (let i = 0; i < learning.samples.length; i++) {
      const sample = learning.samples[i];
      const age = (now - sample.timestamp) / 1000 / 60; // minutes
      const weight = Math.exp(-age / 30); // 30 minute half-life
      
      weightedSum += sample.ratio * weight;
      totalWeight += weight;
    }
    
    if (totalWeight > 0) {
      learning.currentRatio = weightedSum / totalWeight;
    }
    
    // Update confidence based on sample count and consistency
    const ratios = learning.samples.map(s => s.ratio);
    const variance = calculateVariance(ratios);
    learning.confidence = Math.min(
      learning.samples.length / 20, // More samples = higher confidence
      1 - variance // Less variance = higher confidence
    );
    
    // Log accuracy improvement
    const accuracy = Math.abs(1 - (estimatedTokens / actualTotal));
    log.info("Token estimation accuracy", {
      sessionID,
      estimated: estimatedTokens,
      actual: actualTotal,
      accuracy: Math.round((1 - accuracy) * 100) + "%",
      learnedRatio: learning.currentRatio,
      confidence: Math.round(learning.confidence * 100) + "%",
      samples: learning.samples.length,
      improvement: Math.round((1 - Math.abs(1 - 2.2/learning.currentRatio)) * 100) + "%"
    });
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
