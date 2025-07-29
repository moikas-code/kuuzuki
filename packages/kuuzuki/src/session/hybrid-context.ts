import { z } from "zod"
import { Identifier } from "../id/id"
import { MessageV2 } from "./message-v2"

/**
 * Hybrid Context Management System
 *
 * This module implements a sophisticated context management system that replaces
 * crude token-based summarization with semantic compression and multi-tier storage.
 *
 * Key concepts:
 * - SemanticFact: Extracted knowledge that persists across compressions
 * - CompressedMessage: Messages compressed while preserving semantic meaning
 * - ContextTier: Different levels of context storage (recent, compressed, semantic, pinned)
 * - HybridContextManager: Orchestrates the entire system
 */

export namespace HybridContext {
  /**
   * Types of semantic facts that can be extracted from conversations
   */
  export const SemanticFactType = z.enum([
    "architecture", // System architecture and design patterns
    "pattern", // Code patterns and conventions
    "decision", // Important decisions and their rationale
    "relationship", // File/component relationships and dependencies
    "error_solution", // Error patterns and their solutions
    "tool_usage", // Important tool usage patterns
    "file_structure", // Project structure insights
    "configuration", // Configuration and setup insights
  ])

  export type SemanticFactType = z.infer<typeof SemanticFactType>

  /**
   * Importance levels for semantic facts and messages
   */
  export const ImportanceLevel = z.enum([
    "critical", // Never compress, always preserve
    "high", // Preserve as long as possible
    "medium", // Compress when needed
    "low", // First to be compressed
  ])

  export type ImportanceLevel = z.infer<typeof ImportanceLevel>

  /**
   * Compression levels for messages
   */
  export const CompressionLevel = z.enum([
    "none", // Full detail preserved
    "light", // Remove verbose outputs, keep decisions
    "medium", // Summarize outputs, extract key facts
    "heavy", // Keep only outcomes and critical decisions
    "emergency", // Ultra-minimal essential context only
  ])

  export type CompressionLevel = z.infer<typeof CompressionLevel>

  /**
   * A semantic fact extracted from conversation messages
   */
  export const SemanticFact = z.object({
    id: z.string().describe("Unique fact identifier"),
    type: SemanticFactType,
    content: z.string().describe("The actual fact or insight"),
    importance: ImportanceLevel,
    extractedFrom: z.array(Identifier.schema("message")).describe("Source message IDs"),
    timestamp: z.number().describe("When this fact was extracted"),
    projectContext: z.string().optional().describe("Project path or context identifier"),
    confidence: z.number().min(0).max(1).default(1).describe("Confidence in this fact (0-1)"),
    tags: z.array(z.string()).default([]).describe("Additional tags for categorization"),
    relatedFacts: z.array(z.string()).default([]).describe("Related fact IDs"),
  })

  export type SemanticFact = z.infer<typeof SemanticFact>

  /**
   * A message that has been compressed while preserving semantic meaning
   */
  export const CompressedMessage = z.object({
    id: z.string().describe("Unique compressed message identifier"),
    originalId: Identifier.schema("message"),
    sessionID: Identifier.schema("session"),
    semanticSummary: z.string().describe("Human-readable summary preserving key information"),
    extractedFacts: z.array(z.string()).describe("Facts extracted from this message"),
    tokensSaved: z.number().describe("Number of tokens saved by compression"),
    originalTokens: z.number().describe("Original token count before compression"),
    compressionLevel: CompressionLevel,
    compressedAt: z.number().describe("Timestamp when compression occurred"),
    preservedElements: z.array(z.string()).default([]).describe("Key elements that were preserved"),
  })

  export type CompressedMessage = z.infer<typeof CompressedMessage>

  /**
   * A tier in the context hierarchy
   */
  export const ContextTier = z.object({
    name: z.enum(["recent", "compressed", "semantic", "pinned"]),
    maxTokens: z.number().describe("Maximum tokens allowed in this tier"),
    currentTokens: z.number().describe("Current token usage"),
    messageCount: z.number().describe("Number of items in this tier"),
    lastCompressed: z.number().optional().describe("Last compression timestamp"),
  })

  export type ContextTier = z.infer<typeof ContextTier>

  /**
   * Pinned context that should never be compressed
   */
  export const PinnedContext = z.object({
    messageId: Identifier.schema("message"),
    reason: z.string().describe("Why this context was pinned"),
    pinnedAt: z.number().describe("When this was pinned"),
    pinnedBy: z.string().optional().describe("Who pinned this (user/system)"),
    neverCompress: z.boolean().default(true),
  })

  export type PinnedContext = z.infer<typeof PinnedContext>

  /**
   * Compression metrics for analytics
   */
  export const CompressionMetrics = z.object({
    totalOriginalTokens: z.number(),
    totalCompressedTokens: z.number(),
    compressionRatio: z.number().describe("Ratio of compressed to original tokens"),
    factsExtracted: z.number(),
    lastCompressionTime: z.number(),
    compressionEvents: z.number().default(0),
    averageCompressionRatio: z.number().default(0),
  })

  export type CompressionMetrics = z.infer<typeof CompressionMetrics>

  /**
   * Extended session info with hybrid context data
   */
  export const SessionV3 = z.object({
    // Inherit from existing session structure
    id: Identifier.schema("session"),

    // Context tiers
    contextTiers: z.object({
      recent: z.object({
        messages: z.array(Identifier.schema("message")),
        tokenCount: z.number(),
        maxTokens: z.number().default(30000),
      }),
      compressed: z.object({
        messages: z.array(z.string()),
        tokenCount: z.number(),
        maxTokens: z.number().default(40000),
      }),
      semantic: z.object({
        facts: z.array(z.string()),
        tokenCount: z.number(),
        maxTokens: z.number().default(20000),
      }),
      pinned: z.object({
        contexts: z.array(Identifier.schema("message")),
        tokenCount: z.number(),
        maxTokens: z.number().default(15000),
      }),
    }),

    // Metrics and metadata
    compressionMetrics: CompressionMetrics,
    hybridContextEnabled: z.boolean().default(false),
    version: z.literal("v3").default("v3"),
  })

  export type SessionV3 = z.infer<typeof SessionV3>

  /**
   * Context reconstruction request
   */
  export const ContextRequest = z.object({
    sessionID: Identifier.schema("session"),
    includeRecent: z.boolean().default(true),
    includeCompressed: z.boolean().default(true),
    includeSemantic: z.boolean().default(true),
    includePinned: z.boolean().default(true),
    maxTokens: z.number().optional(),
    prioritizeTypes: z.array(SemanticFactType).default([]),
  })

  export type ContextRequest = z.infer<typeof ContextRequest>

  /**
   * Reconstructed context for AI requests
   */
  export const ReconstructedContext = z.object({
    messages: z.array(z.union([MessageV2.Info, CompressedMessage])),
    semanticFacts: z.array(SemanticFact),
    pinnedContext: z.array(MessageV2.Info),
    totalTokens: z.number(),
    compressionSummary: z.string().optional(),
  })

  export type ReconstructedContext = z.infer<typeof ReconstructedContext>

  /**
   * Extraction pattern for semantic facts
   */
  export const ExtractionPattern = z.object({
    type: SemanticFactType,
    patterns: z.array(z.string()).describe("Regex patterns to match"),
    importance: ImportanceLevel,
    extractionFunction: z.string().optional().describe("Custom extraction function name"),
  })

  export type ExtractionPattern = z.infer<typeof ExtractionPattern>

  /**
   * Compression strategy configuration
   */
  export const CompressionStrategy = z.object({
    level: CompressionLevel,
    triggers: z.object({
      tokenThreshold: z.number().describe("Token count that triggers this level"),
      timeThreshold: z.number().optional().describe("Age threshold for messages"),
      importanceThreshold: ImportanceLevel.optional(),
    }),
    preserveElements: z.array(z.string()).describe("Elements to always preserve"),
    compressionRatio: z.number().describe("Target compression ratio"),
  })

  export type CompressionStrategy = z.infer<typeof CompressionStrategy>
}
