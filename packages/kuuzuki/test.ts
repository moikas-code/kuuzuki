import path from "path"
import { Decimal } from "decimal.js"
import { z, ZodSchema } from "zod"
import {
  generateText,
  LoadAPIKeyError,
  streamText,
  tool,
  wrapLanguageModel,
  type Tool as AITool,
  type LanguageModelUsage,
  type ProviderMetadata,
  type ModelMessage,
  stepCountIs,
  type StreamTextResult,
} from "ai"

import PROMPT_INITIALIZE from "../session/prompt/initialize.txt"
import { LegacyFiles } from "../config/legacy"
import PROMPT_PLAN from "../session/prompt/plan.txt"
import PROMPT_CHAT from "../session/prompt/chat.txt"

import { App } from "../app/app"
import { Bus } from "../bus"
import { Config } from "../config/config"
import { checkSubscription, showSubscriptionPrompt } from "../auth/subscription"
import { Flag } from "../flag/flag"
import { Identifier } from "../id/id"
import { Installation } from "../installation"
import { MCP } from "../mcp"
import { Provider } from "../provider/provider"
import { ProviderTransform } from "../provider/transform"
import type { ModelsDev } from "../provider/models"
import { Share } from "../share/share"
import { Snapshot } from "../snapshot"
import { Storage } from "../storage/storage"
import { Log } from "../util/log"
import { NamedError } from "../util/error"
import { SystemPrompt } from "./system"
import { FileTime } from "../file/time"
import { MessageV2 } from "./message-v2"
import { Mode } from "./mode"
import { LSP } from "../lsp"
import { ReadTool } from "../tool/read"
import { mergeDeep, pipe, splitWhen } from "remeda"
import { ToolRegistry } from "../tool/registry"
import { validateSessionID, validateMessageID } from "../util/id-validation"

export namespace Session {
  const log = Log.create({ service: "session" })

  const OUTPUT_TOKEN_MAX = 32_000

  // Message validation utility to prevent empty message arrays
  function validateMessages(messages: ModelMessage[], context: string, sessionID?: string): ModelMessage[] {
    if (!messages || messages.length === 0) {
      log.error("Empty messages array detected", {
        context,
        sessionID,
        stackTrace: new Error().stack,
        timestamp: new Date().toISOString(),
      })

      // Return minimal valid message to prevent API crash
      return [
        {
          role: "user" as const,
          content: "Please help me with my request.",
        },
      ]
    }

    // Log message array info for debugging
    log.debug("Message validation passed", {
      context,
      sessionID,
      messageCount: messages.length,
      roles: messages.map((m) => m.role),
      hasContent: messages.every(
        (m) => m.content && (typeof m.content === "string" ? m.content.length > 0 : m.content.length > 0),
      ),
    })

    return messages
  }

  /**
   * Estimates token count for text content
   * Uses rough approximation: 1 token ≈ 4 characters for English text
   */
  function estimateTokens(text: string): number {
    if (!text) return 0
    // More accurate estimation accounting for whitespace and punctuation
    return Math.ceil(text.length / 3.5)
  }

  /**
   * Estimates total tokens for a request before sending to AI
   */
  async function estimateRequestTokens(
}
