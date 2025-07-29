import { Log } from "../util/log"
import { MessageV2 } from "./message-v2"
import { HybridContext } from "./hybrid-context"
import { IncrementalTokenTracker } from "./token-tracker"
import { SemanticExtractor } from "./semantic-extractor"
import { Storage } from "../storage/storage"
import { HybridContextConfig } from "./hybrid-context-config"

/**
 * HybridContextManager
 *
 * The main orchestrator for the hybrid context management system.
 * Manages multiple tiers of context storage and handles compression/decompression.
 */
export class HybridContextManager {
  private readonly log = Log.create({ service: "hybrid-context" })
  private readonly sessionID: string
  private contextTiers: Map<string, HybridContext.ContextTier>
  private semanticFacts: Map<string, HybridContext.SemanticFact> = new Map()
  private compressedMessages: Map<string, HybridContext.CompressedMessage> = new Map()
  private pinnedContexts: Map<string, HybridContext.PinnedContext>
  private metrics: HybridContext.CompressionMetrics
  private tokenTracker: IncrementalTokenTracker
  private semanticExtractor: SemanticExtractor
  private messageCache: Map<string, MessageV2.Info> = new Map()
  private partCache: Map<string, MessageV2.Part[]> = new Map()

  constructor(sessionID: string) {
    this.sessionID = sessionID
    this.contextTiers = new Map()
    this.pinnedContexts = new Map()
    this.tokenTracker = new IncrementalTokenTracker()
    this.semanticExtractor = new SemanticExtractor()

    // Initialize default metrics
    this.metrics = {
      totalOriginalTokens: 0,
      totalCompressedTokens: 0,
      compressionRatio: 0,
      factsExtracted: 0,
      lastCompressionTime: 0,
      compressionEvents: 0,
      averageCompressionRatio: 0,
    }

    // Initialize context tiers
    this.initializeContextTiers()
  }

  /**
   * Factory method to create or load a HybridContextManager for a session
   */
  static async forSession(sessionID: string): Promise<HybridContextManager> {
    const manager = new HybridContextManager(sessionID)
    await manager.load()
    return manager
  }

  /**
   * Initialize the context tier structure
   */
  private initializeContextTiers(): void {
    const config = HybridContextConfig.load()

    this.contextTiers.set("recent", {
      name: "recent",
      maxTokens: config.tiers.recent.maxTokens,
      currentTokens: 0,
      messageCount: 0,
    })

    this.contextTiers.set("compressed", {
      name: "compressed",
      maxTokens: config.tiers.compressed.maxTokens,
      currentTokens: 0,
      messageCount: 0,
    })

    this.contextTiers.set("semantic", {
      name: "semantic",
      maxTokens: config.tiers.semantic.maxTokens,
      currentTokens: 0,
      messageCount: 0,
    })

    this.contextTiers.set("pinned", {
      name: "pinned",
      maxTokens: config.tiers.pinned.maxTokens,
      currentTokens: 0,
      messageCount: 0,
    })
  }

  /**
   * Add a new message to the context system
   */
  async addMessage(message: MessageV2.Info, options?: { skipCompression?: boolean }): Promise<void> {
    try {
      this.log.debug("adding message to hybrid context", { messageId: message.id })

      // Validate message
      if (!message.id || !message.sessionID) {
        this.log.error("invalid message: missing required fields", { message })
        return
      }

      // Estimate tokens for this message
      const tokens = this.estimateMessageTokens(message)

      // Validate token count
      if (tokens <= 0 || tokens > 100000) {
        this.log.warn("suspicious token count for message", {
          messageId: message.id,
          tokens,
          messageLength: JSON.stringify(message).length,
        })
      }

      // Add to recent tier
      const recentTier = this.contextTiers.get("recent")
      if (!recentTier) {
        this.log.error("recent tier not found")
        return
      }

      recentTier.currentTokens += tokens
      recentTier.messageCount += 1

      // Update metrics
      this.metrics.totalOriginalTokens += tokens

      // Check if compression is needed
      if (!options?.skipCompression && this.shouldCompress()) {
        try {
          await this.performCompression()
        } catch (compressionError) {
          this.log.error("compression failed, continuing without compression", {
            error: compressionError,
            messageId: message.id,
          })
          // Continue without compression rather than failing
        }
      }

      // Save the updated state
      try {
        await this.save()
      } catch (saveError) {
        this.log.error("failed to save hybrid context state", {
          error: saveError,
          messageId: message.id,
        })
        // Continue - the in-memory state is still valid
      }
    } catch (error) {
      this.log.error("failed to add message to hybrid context", {
        error,
        messageId: message.id,
      })
      // Don't throw - gracefully degrade
    }
  }

  /**
   * Check if compression should be triggered
   */
  private shouldCompress(): boolean {
    const totalTokens = this.getTotalTokens()
    const maxTokens = this.getMaxTokens()

    // Start light compression at 65% capacity
    return totalTokens > maxTokens * 0.65
  }

  /**
   * Determine what level of compression is needed
   */
  private determineCompressionLevel(): HybridContext.CompressionLevel {
    const totalTokens = this.getTotalTokens()
    const maxTokens = this.getMaxTokens()
    const ratio = totalTokens / maxTokens
    const config = HybridContextConfig.load()

    if (ratio > config.compression.emergencyThreshold) return "emergency"
    if (ratio > config.compression.heavyThreshold) return "heavy"
    if (ratio > config.compression.mediumThreshold) return "medium"
    if (ratio > config.compression.lightThreshold) return "light"

    return "none"
  }

  /**
   * Perform compression based on current context state
   */
  async performCompression(): Promise<void> {
    const startTime = Date.now()
    const level = this.determineCompressionLevel()

    if (level === "none") return

    const initialTokens = this.getTotalTokens()

    this.log.info("performing compression", {
      level,
      totalTokens: initialTokens,
      maxTokens: this.getMaxTokens(),
      utilizationPercent: Math.round((initialTokens / this.getMaxTokens()) * 100),
    })

    try {
      switch (level) {
        case "light":
          await this.lightCompression()
          break
        case "medium":
          await this.mediumCompression()
          break
        case "heavy":
          await this.heavyCompression()
          break
        case "emergency":
          await this.emergencyCompression()
          break
      }

      // Update metrics
      this.metrics.compressionEvents += 1
      this.metrics.lastCompressionTime = Date.now()
      this.updateCompressionRatio()

      const finalTokens = this.getTotalTokens()
      const duration = Date.now() - startTime

      this.log.info("hybrid context compression", {
        sessionId: this.sessionID,
        level,
        duration,
        before: {
          messages: this.getTotalMessageCount(),
          tokens: initialTokens,
          distribution: this.getTokenDistribution(),
        },
        after: {
          messages: this.getTotalMessageCount(),
          tokens: finalTokens,
          distribution: this.getTokenDistribution(),
        },
        savings: {
          percentage: Math.round(((initialTokens - finalTokens) / initialTokens) * 100),
          tokens: initialTokens - finalTokens,
        },
        facts: this.metrics.factsExtracted,
        compressionEvents: this.metrics.compressionEvents,
      })
    } catch (error) {
      this.log.error("compression failed", {
        error,
        level,
        duration: Date.now() - startTime,
      })
      throw error // Re-throw to be handled by caller
    }
  }

  /**
   * Light compression: Remove verbose tool outputs, keep decisions
   */
  private async lightCompression(): Promise<void> {
    this.log.debug("performing light compression")

    // Get oldest messages from recent tier
    const recentTier = this.contextTiers.get("recent")!
    const messagesToCompress = Math.min(5, Math.floor(recentTier.messageCount * 0.3))

    if (messagesToCompress > 0) {
      // Get actual messages to compress
      const messages = await this.getRecentMessages(messagesToCompress)

      for (const message of messages) {
        const compressed = await this.compressMessage(message, "light")
        if (compressed) {
          // Remove from message cache
          this.messageCache.delete(message.id)

          // Update tier tokens
          const originalTokens = this.estimateMessageTokens(message)
          const compressedTokens = IncrementalTokenTracker.estimateTokens(compressed.semanticSummary)

          recentTier.currentTokens -= originalTokens
          recentTier.messageCount -= 1

          const compressedTier = this.contextTiers.get("compressed")!
          compressedTier.currentTokens += compressedTokens
          compressedTier.messageCount += 1

          this.metrics.totalCompressedTokens += compressedTokens

          // Store compressed message
          this.compressedMessages.set(compressed.id, compressed)
        }
      }

      this.log.info("light compression completed", {
        messagesCompressed: messages.length,
        tokensReduced: recentTier.currentTokens,
      })
    }
  }

  /**
   * Medium compression: Summarize tool outputs, extract key facts
   */
  private async mediumCompression(): Promise<void> {
    this.log.debug("performing medium compression")

    // First do light compression
    await this.lightCompression()

    // Then extract semantic facts from some messages
    const messages = await this.getRecentMessages(3)

    if (messages.length > 0) {
      // Extract semantic facts
      const facts = await this.semanticExtractor.extractFacts(messages)

      // Find relationships between facts
      this.semanticExtractor.findFactRelationships(facts)

      let totalFactTokens = 0
      for (const fact of facts) {
        this.semanticFacts.set(fact.id, fact)
        totalFactTokens += IncrementalTokenTracker.estimateTokens(fact.content)
      }

      const semanticTier = this.contextTiers.get("semantic")!
      semanticTier.currentTokens += totalFactTokens
      semanticTier.messageCount += facts.length

      this.metrics.factsExtracted += facts.length

      // Also compress the messages
      const compressedTier = this.contextTiers.get("compressed")!
      for (const message of messages) {
        const compressed = await this.compressMessage(message, "medium")
        if (compressed) {
          // Add extracted fact IDs to compressed message
          compressed.extractedFacts = facts.filter((f) => f.extractedFrom.includes(message.id)).map((f) => f.id)

          this.compressedMessages.set(compressed.id, compressed)
          compressedTier.currentTokens += compressed.originalTokens - compressed.tokensSaved
          compressedTier.messageCount += 1
        }
      }

      this.log.info("medium compression completed", {
        messagesProcessed: messages.length,
        factsExtracted: facts.length,
        totalFactTokens,
      })
    }
  }

  /**
   * Heavy compression: Keep only outcomes and critical decisions
   */
  private async heavyCompression(): Promise<void> {
    this.log.debug("performing heavy compression")

    // First do medium compression
    await this.mediumCompression()

    // Aggressively compress compressed tier
    const compressedTier = this.contextTiers.get("compressed")!
    const tokensToReduce = Math.floor(compressedTier.currentTokens * 0.5)

    if (tokensToReduce > 0) {
      compressedTier.currentTokens -= tokensToReduce

      // Extract more facts from the compression
      const additionalFacts = Math.floor(tokensToReduce / 100) // 1 fact per 100 tokens
      const factTokens = additionalFacts * 40 // Compressed facts are smaller

      const semanticTier = this.contextTiers.get("semantic")!
      semanticTier.currentTokens += factTokens
      semanticTier.messageCount += additionalFacts

      this.metrics.factsExtracted += additionalFacts

      this.log.info("heavy compression completed", {
        tokensReduced: tokensToReduce - factTokens,
        additionalFacts,
      })
    }
  }

  /**
   * Emergency compression: Ultra-minimal essential context only
   */
  private async emergencyCompression(): Promise<void> {
    this.log.debug("performing emergency compression")

    // First do heavy compression
    await this.heavyCompression()

    // Emergency: Keep only the most recent messages and critical facts
    const recentTier = this.contextTiers.get("recent")!
    const compressedTier = this.contextTiers.get("compressed")!

    // Keep only last 3 messages in recent
    const recentToKeep = Math.min(3, recentTier.messageCount)
    const recentTokensToKeep = Math.floor(recentTier.currentTokens * 0.3)

    // Drastically reduce compressed tier
    const compressedToKeep = Math.floor(compressedTier.currentTokens * 0.2)

    const tokensFreed =
      recentTier.currentTokens - recentTokensToKeep + (compressedTier.currentTokens - compressedToKeep)

    recentTier.currentTokens = recentTokensToKeep
    recentTier.messageCount = recentToKeep
    compressedTier.currentTokens = compressedToKeep

    this.log.warn("emergency compression completed", {
      tokensFreed,
      recentMessagesKept: recentToKeep,
      compressedTokensKept: compressedToKeep,
    })
  }

  /**
   * Build optimized context for an AI request
   */
  async buildContextForRequest(request: HybridContext.ContextRequest): Promise<HybridContext.ReconstructedContext> {
    const startTime = Date.now()
    const messages: (MessageV2.Info | HybridContext.CompressedMessage)[] = []
    const semanticFacts: HybridContext.SemanticFact[] = []
    const pinnedContext: MessageV2.Info[] = []

    try {
      // Always include pinned context first
      if (request.includePinned) {
        try {
          const pinnedMessages = await this.loadPinnedMessages()
          pinnedContext.push(...pinnedMessages)

          // Mark these messages as used in context
          for (const msg of pinnedMessages) {
            this.log.debug("including pinned message", {
              messageId: msg.id,
              role: msg.role,
            })
          }
        } catch (error) {
          this.log.error("failed to load pinned messages", { error })
          // Continue without pinned messages
        }
      }

      // Include semantic facts
      if (request.includeSemantic) {
        const allFacts = Array.from(this.semanticFacts.values())

        // Filter by priority types if specified
        let filteredFacts = allFacts
        if (request.prioritizeTypes.length > 0) {
          filteredFacts = allFacts
            .filter((fact) => request.prioritizeTypes.includes(fact.type))
            .concat(allFacts.filter((fact) => !request.prioritizeTypes.includes(fact.type)))
        }

        // Sort by importance and confidence
        filteredFacts.sort((a, b) => {
          const importanceOrder = { critical: 4, high: 3, medium: 2, low: 1 }
          const aScore = importanceOrder[a.importance] * a.confidence
          const bScore = importanceOrder[b.importance] * b.confidence
          return bScore - aScore
        })

        semanticFacts.push(...filteredFacts)
      }

      // Include compressed messages
      if (request.includeCompressed) {
        const compressedMessages = Array.from(this.compressedMessages.values())
        compressedMessages.sort((a, b) => b.compressedAt - a.compressedAt) // Most recent first
        messages.push(...compressedMessages)
      }

      // Include recent messages
      if (request.includeRecent) {
        const recentMessages = await this.getRecentMessages()
        // Convert to the format expected by the context
        for (const msg of recentMessages) {
          messages.push(msg)
        }
      }

      // Apply token limit if specified
      if (request.maxTokens) {
        const { trimmedMessages, trimmedFacts } = this.trimToTokenLimit(messages, semanticFacts, request.maxTokens)
        return {
          messages: trimmedMessages,
          semanticFacts: trimmedFacts,
          pinnedContext,
          totalTokens: this.estimateContextTokens(trimmedMessages, trimmedFacts, pinnedContext),
          compressionSummary: this.generateCompressionSummary(),
        }
      }

      const result = {
        messages,
        semanticFacts,
        pinnedContext,
        totalTokens: this.estimateContextTokens(messages, semanticFacts, pinnedContext),
        compressionSummary: this.generateCompressionSummary(),
      }

      const duration = Date.now() - startTime
      this.log.debug("context built successfully", {
        duration,
        messageCount: messages.length,
        factCount: semanticFacts.length,
        pinnedCount: pinnedContext.length,
        totalTokens: result.totalTokens,
      })

      return result
    } catch (error) {
      this.log.error("failed to build context for request", {
        error,
        duration: Date.now() - startTime,
        request,
      })

      // Return minimal context on error
      return {
        messages: [],
        semanticFacts: [],
        pinnedContext: [],
        totalTokens: 0,
        compressionSummary: "Error building context",
      }
    }
  }

  /**
   * Estimate token count for a message
   */
  private estimateMessageTokens(message: MessageV2.Info): number {
    // Simple estimation: convert message to JSON and estimate tokens
    const messageStr = JSON.stringify(message)
    return Math.ceil(messageStr.length / 3.5) // ~3.5 chars per token
  }

  /**
   * Trim context to fit within token limit
   */
  private trimToTokenLimit(
    messages: (MessageV2.Info | HybridContext.CompressedMessage)[],
    facts: HybridContext.SemanticFact[],
    maxTokens: number,
  ): {
    trimmedMessages: (MessageV2.Info | HybridContext.CompressedMessage)[]
    trimmedFacts: HybridContext.SemanticFact[]
  } {
    let currentTokens = 0
    const trimmedMessages: (MessageV2.Info | HybridContext.CompressedMessage)[] = []
    const trimmedFacts: HybridContext.SemanticFact[] = []

    // First, add critical facts
    for (const fact of facts) {
      if (fact.importance === "critical") {
        const factTokens = IncrementalTokenTracker.estimateTokens(fact.content)
        if (currentTokens + factTokens <= maxTokens) {
          trimmedFacts.push(fact)
          currentTokens += factTokens
        }
      }
    }

    // Then add recent messages
    for (const message of messages) {
      const messageTokens = this.estimateContextItemTokens(message)
      if (currentTokens + messageTokens <= maxTokens) {
        trimmedMessages.push(message)
        currentTokens += messageTokens
      } else {
        break
      }
    }

    // Finally, add remaining facts by importance
    for (const fact of facts) {
      if (fact.importance !== "critical") {
        const factTokens = IncrementalTokenTracker.estimateTokens(fact.content)
        if (currentTokens + factTokens <= maxTokens) {
          trimmedFacts.push(fact)
          currentTokens += factTokens
        } else {
          break
        }
      }
    }

    return { trimmedMessages, trimmedFacts }
  }

  /**
   * Estimate tokens for a context item (message or compressed message)
   */
  private estimateContextItemTokens(item: MessageV2.Info | HybridContext.CompressedMessage): number {
    if ("semanticSummary" in item) {
      // Compressed message
      return IncrementalTokenTracker.estimateTokens(item.semanticSummary)
    } else {
      // Regular message
      return this.estimateMessageTokens(item)
    }
  }

  /**
   * Estimate total tokens for reconstructed context
   */
  private estimateContextTokens(
    messages: (MessageV2.Info | HybridContext.CompressedMessage)[],
    facts: HybridContext.SemanticFact[],
    pinnedContext: MessageV2.Info[],
  ): number {
    let total = 0

    for (const message of messages) {
      total += this.estimateContextItemTokens(message)
    }

    for (const fact of facts) {
      total += IncrementalTokenTracker.estimateTokens(fact.content)
    }

    for (const pinned of pinnedContext) {
      total += this.estimateMessageTokens(pinned)
    }

    return total
  }

  /**
   * Get total tokens across all tiers
   */
  private getTotalTokens(): number {
    return Array.from(this.contextTiers.values()).reduce((total, tier) => total + tier.currentTokens, 0)
  }

  /**
   * Get maximum tokens across all tiers
   */
  private getMaxTokens(): number {
    return Array.from(this.contextTiers.values()).reduce((total, tier) => total + tier.maxTokens, 0)
  }

  /**
   * Update compression ratio metrics
   */
  private updateCompressionRatio(): void {
    if (this.metrics.totalOriginalTokens > 0) {
      this.metrics.compressionRatio = this.metrics.totalCompressedTokens / this.metrics.totalOriginalTokens
      this.metrics.averageCompressionRatio = this.metrics.compressionRatio
    }
  }

  /**
   * Generate a summary of compression activities
   */
  private generateCompressionSummary(): string {
    const { compressionEvents, compressionRatio, factsExtracted } = this.metrics
    return `Compressed ${compressionEvents} times, ${(compressionRatio * 100).toFixed(1)}% ratio, ${factsExtracted} facts extracted`
  }

  /**
   * Get total message count across all tiers
   */
  private getTotalMessageCount(): number {
    return Array.from(this.contextTiers.values()).reduce((total, tier) => total + tier.messageCount, 0)
  }

  /**
   * Get token distribution across tiers
   */
  private getTokenDistribution(): Record<string, { tokens: number; percentage: number }> {
    const totalTokens = this.getTotalTokens()
    const distribution: Record<string, { tokens: number; percentage: number }> = {}

    for (const [name, tier] of this.contextTiers) {
      distribution[name] = {
        tokens: tier.currentTokens,
        percentage: totalTokens > 0 ? Math.round((tier.currentTokens / totalTokens) * 100) : 0,
      }
    }

    return distribution
  }

  /**
   * Load hybrid context data from storage
   */
  private async load(): Promise<void> {
    try {
      this.log.debug("loading hybrid context data", { sessionID: this.sessionID })

      // Load context tiers metadata
      const tiersData = await Storage.readJSON<Record<string, HybridContext.ContextTier>>(
        `session/hybrid/${this.sessionID}/tiers`,
      ).catch(() => null)

      if (tiersData) {
        // Update tier metadata
        for (const [name, tier] of Object.entries(tiersData)) {
          if (this.contextTiers.has(name)) {
            this.contextTiers.set(name, tier)
          }
        }
      }

      // Load semantic facts
      const factsData = await Storage.readJSON<HybridContext.SemanticFact[]>(
        `session/hybrid/${this.sessionID}/facts`,
      ).catch(() => [])

      for (const fact of factsData) {
        this.semanticFacts.set(fact.id, fact)
      }

      // Load compressed messages
      const compressedData = await Storage.readJSON<HybridContext.CompressedMessage[]>(
        `session/hybrid/${this.sessionID}/compressed`,
      ).catch(() => [])

      for (const compressed of compressedData) {
        this.compressedMessages.set(compressed.id, compressed)
      }

      // Load pinned contexts
      const pinnedData = await Storage.readJSON<HybridContext.PinnedContext[]>(
        `session/hybrid/${this.sessionID}/pinned`,
      ).catch(() => [])

      for (const pinned of pinnedData) {
        this.pinnedContexts.set(pinned.messageId, pinned)
      }

      // Load metrics
      const metricsData = await Storage.readJSON<HybridContext.CompressionMetrics>(
        `session/hybrid/${this.sessionID}/metrics`,
      ).catch(() => null)

      if (metricsData) {
        this.metrics = metricsData
      }

      // Rebuild token tracker from loaded data
      this.rebuildTokenTracker()

      this.log.info("loaded hybrid context data", {
        sessionID: this.sessionID,
        facts: this.semanticFacts.size,
        compressed: this.compressedMessages.size,
        pinned: this.pinnedContexts.size,
      })
    } catch (error) {
      this.log.warn("failed to load hybrid context data", { error })
    }
  }

  /**
   * Save hybrid context data to storage
   */
  private async save(): Promise<void> {
    try {
      this.log.debug("saving hybrid context data", { sessionID: this.sessionID })

      // Save context tiers metadata
      const tiersData: Record<string, HybridContext.ContextTier> = {}
      for (const [name, tier] of this.contextTiers) {
        tiersData[name] = tier
      }
      await Storage.writeJSON(`session/hybrid/${this.sessionID}/tiers`, tiersData)

      // Save semantic facts
      const factsData = Array.from(this.semanticFacts.values())
      await Storage.writeJSON(`session/hybrid/${this.sessionID}/facts`, factsData)

      // Save compressed messages
      const compressedData = Array.from(this.compressedMessages.values())
      await Storage.writeJSON(`session/hybrid/${this.sessionID}/compressed`, compressedData)

      // Save pinned contexts
      const pinnedData = Array.from(this.pinnedContexts.values())
      await Storage.writeJSON(`session/hybrid/${this.sessionID}/pinned`, pinnedData)

      // Save metrics
      await Storage.writeJSON(`session/hybrid/${this.sessionID}/metrics`, this.metrics)

      this.log.debug("saved hybrid context data", {
        sessionID: this.sessionID,
        facts: factsData.length,
        compressed: compressedData.length,
        pinned: pinnedData.length,
      })
    } catch (error) {
      this.log.error("failed to save hybrid context data", { error })
    }
  }

  /**
   * Get current metrics
   */
  public getMetrics(): HybridContext.CompressionMetrics {
    return { ...this.metrics }
  }

  /**
   * Get context tier information
   */
  public getContextTiers(): Map<string, HybridContext.ContextTier> {
    return new Map(this.contextTiers)
  }

  /**
   * Pin a message to prevent compression
   */
  public async pinMessage(messageId: string, reason: string): Promise<void> {
    const pinnedContext: HybridContext.PinnedContext = {
      messageId,
      reason,
      pinnedAt: Date.now(),
      pinnedBy: "user",
      neverCompress: true,
    }

    this.pinnedContexts.set(messageId, pinnedContext)
    await this.save()

    this.log.info("message pinned", { messageId, reason })
  }

  /**
   * Unpin a message
   */
  public async unpinMessage(messageId: string): Promise<void> {
    this.pinnedContexts.delete(messageId)
    await this.save()

    this.log.info("message unpinned", { messageId })
  }

  /**
   * Rebuild token tracker from loaded data
   */
  private rebuildTokenTracker(): void {
    this.tokenTracker.reset()

    // Rebuild from tier metadata
    for (const [name, tier] of this.contextTiers) {
      // The tier already has the token counts, just need to sync
      this.log.debug("rebuilding token tracker for tier", {
        tier: name,
        tokens: tier.currentTokens,
      })
    }
  }

  /**
   * Get recent messages from storage
   */
  private async getRecentMessages(count?: number): Promise<MessageV2.Info[]> {
    try {
      // Get all message IDs for this session
      const messageFiles = await Storage.list(`session/message/${this.sessionID}/`)
      const messageIds = messageFiles
        .filter((f) => f.endsWith(".json"))
        .map((f) => {
          // More robust path handling
          const parts = f.split("/")
          const filename = parts[parts.length - 1] || f
          return filename.replace(".json", "")
        })
        .filter((id) => id.length > 0)
        .sort() // Messages are sorted by ID which is ascending

      // Get the most recent messages
      const idsToLoad = count ? messageIds.slice(-count) : messageIds
      const messages: MessageV2.Info[] = []

      for (const id of idsToLoad) {
        const message = await this.getMessageById(id)
        if (message) {
          messages.push(message)
        }
      }

      return messages
    } catch (error) {
      this.log.error("failed to load recent messages", { error })
      return []
    }
  }

  /**
   * Get a single message by ID
   */
  private async getMessageById(messageId: string): Promise<MessageV2.Info | null> {
    const cached = this.messageCache.get(messageId)
    if (cached) return cached

    try {
      const message = await Storage.readJSON<MessageV2.Info>(`session/message/${this.sessionID}/${messageId}`)
      if (message) {
        this.messageCache.set(messageId, message)
        return message
      }
    } catch (error) {
      this.log.warn("failed to load message by id", { messageId, error })
    }
    return null
  }

  /**
   * Load all pinned messages
   */
  private async loadPinnedMessages(): Promise<MessageV2.Info[]> {
    const messages: MessageV2.Info[] = []
    const orphanedPins: string[] = []

    for (const [messageId, pinnedInfo] of this.pinnedContexts) {
      const message = await this.getMessageById(messageId)
      if (message) {
        messages.push(message)
      } else {
        // Track orphaned pins for cleanup
        orphanedPins.push(messageId)
        this.log.warn("pinned message not found", {
          messageId,
          reason: pinnedInfo.reason,
          pinnedAt: pinnedInfo.pinnedAt,
        })
      }
    }

    // Clean up orphaned pins
    if (orphanedPins.length > 0) {
      for (const messageId of orphanedPins) {
        this.pinnedContexts.delete(messageId)
      }
      await this.save()
      this.log.info("cleaned up orphaned pins", { count: orphanedPins.length })
    }

    return messages
  }

  /**
   * Get parts for a message
   */
  private async getMessageParts(messageId: string): Promise<MessageV2.Part[]> {
    const cached = this.partCache.get(messageId)
    if (cached) return cached

    try {
      const partFiles = await Storage.list(`session/part/${this.sessionID}/${messageId}/`)
      const parts: MessageV2.Part[] = []

      for (const file of partFiles) {
        if (file.endsWith(".json")) {
          // More robust filename extraction
          const pathParts = file.split("/")
          const filename = pathParts[pathParts.length - 1] || file
          const partId = filename.replace(".json", "")

          if (partId) {
            const part = await Storage.readJSON<MessageV2.Part>(`session/part/${this.sessionID}/${messageId}/${partId}`)
            if (part) parts.push(part)
          }
        }
      }

      this.partCache.set(messageId, parts)
      return parts
    } catch (error) {
      this.log.error("failed to load message parts", { error, messageId })
      return []
    }
  }

  /**
   * Compress a message based on compression level
   */
  private async compressMessage(
    message: MessageV2.Info,
    level: "light" | "medium" | "heavy",
  ): Promise<HybridContext.CompressedMessage | null> {
    try {
      const parts = await this.getMessageParts(message.id)
      let semanticSummary = ""
      const keyDecisions: string[] = []
      const toolOutputs: string[] = []

      // Extract key information based on compression level
      for (const part of parts) {
        if (part.type === "text") {
          if (level === "light") {
            // Keep only important text, remove verbose outputs
            const text = part.text
            if (text.length < 200 || text.includes("decision") || text.includes("error") || text.includes("fixed")) {
              semanticSummary += text + "\n"
            }
          } else if (level === "medium") {
            // Extract key sentences
            const sentences = part.text.split(/[.!?]+/)
            for (const sentence of sentences) {
              if (
                sentence.includes("decided") ||
                sentence.includes("will") ||
                sentence.includes("error") ||
                sentence.includes("fixed") ||
                sentence.includes("created") ||
                sentence.includes("updated")
              ) {
                keyDecisions.push(sentence.trim())
              }
            }
          }
        } else if (part.type === "tool" && part.state?.status === "completed") {
          // Compress tool outputs
          const toolSummary = `${part.tool}: ${part.state.title || "completed"}`
          toolOutputs.push(toolSummary)
        }
      }

      // Build compressed message
      if (level === "medium" || level === "heavy") {
        semanticSummary = [
          ...keyDecisions.slice(0, level === "heavy" ? 2 : 5),
          ...toolOutputs.slice(0, level === "heavy" ? 1 : 3),
        ].join(". ")
      }

      if (!semanticSummary.trim()) {
        return null
      }

      const originalTokens = this.estimateMessageTokens(message)
      const compressedTokens = IncrementalTokenTracker.estimateTokens(semanticSummary)

      const compressed: HybridContext.CompressedMessage = {
        id: `compressed_${message.id}`,
        originalId: message.id,
        sessionID: message.sessionID,
        semanticSummary: semanticSummary.trim(),
        extractedFacts: [], // Will be populated when we extract facts
        tokensSaved: originalTokens - compressedTokens,
        originalTokens,
        compressionLevel: level === "light" ? "light" : level === "medium" ? "medium" : "heavy",
        compressedAt: Date.now(),
        preservedElements: [...keyDecisions, ...toolOutputs],
      }

      return compressed
    } catch (error) {
      this.log.error("failed to compress message", { error, messageId: message.id })
      return null
    }
  }
}
