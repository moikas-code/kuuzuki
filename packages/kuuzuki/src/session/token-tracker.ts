import { Log } from "../util/log"

/**
 * IncrementalTokenTracker
 *
 * Efficiently tracks token usage across messages without recalculating everything.
 * Maintains running totals and provides fast lookups.
 */
export class IncrementalTokenTracker {
  private readonly log = Log.create({ service: "token-tracker" })
  private runningTotal = 0
  private messageTokens = new Map<string, number>()
  private tierTotals = new Map<string, number>()

  constructor() {
    // Initialize tier totals
    this.tierTotals.set("recent", 0)
    this.tierTotals.set("compressed", 0)
    this.tierTotals.set("semantic", 0)
    this.tierTotals.set("pinned", 0)
  }

  /**
   * Add a message with its token count
   */
  addMessage(messageId: string, tokens: number, tier: string = "recent"): void {
    // Remove if already exists (for updates)
    if (this.messageTokens.has(messageId)) {
      this.removeMessage(messageId)
    }

    this.messageTokens.set(messageId, tokens)
    this.runningTotal += tokens

    // Update tier total
    const currentTierTotal = this.tierTotals.get(tier) || 0
    this.tierTotals.set(tier, currentTierTotal + tokens)

    this.log.debug("added message tokens", { messageId, tokens, tier, newTotal: this.runningTotal })
  }

  /**
   * Remove a message and its tokens
   */
  removeMessage(messageId: string, tier?: string): number {
    const tokens = this.messageTokens.get(messageId) || 0

    if (tokens > 0) {
      this.messageTokens.delete(messageId)
      this.runningTotal -= tokens

      // Update tier total if tier specified
      if (tier) {
        const currentTierTotal = this.tierTotals.get(tier) || 0
        this.tierTotals.set(tier, Math.max(0, currentTierTotal - tokens))
      }

      this.log.debug("removed message tokens", { messageId, tokens, tier, newTotal: this.runningTotal })
    }

    return tokens
  }

  /**
   * Move a message from one tier to another
   */
  moveMessage(messageId: string, fromTier: string, toTier: string): void {
    const tokens = this.messageTokens.get(messageId) || 0

    if (tokens > 0) {
      // Update tier totals
      const fromTotal = this.tierTotals.get(fromTier) || 0
      const toTotal = this.tierTotals.get(toTier) || 0

      this.tierTotals.set(fromTier, Math.max(0, fromTotal - tokens))
      this.tierTotals.set(toTier, toTotal + tokens)

      this.log.debug("moved message between tiers", { messageId, tokens, fromTier, toTier })
    }
  }

  /**
   * Update token count for an existing message
   */
  updateMessage(messageId: string, newTokens: number, tier: string = "recent"): void {
    const oldTokens = this.removeMessage(messageId, tier)
    this.addMessage(messageId, newTokens, tier)

    this.log.debug("updated message tokens", { messageId, oldTokens, newTokens, tier })
  }

  /**
   * Get current total token count
   */
  getCurrentTotal(): number {
    return this.runningTotal
  }

  /**
   * Get token count for a specific message
   */
  getMessageTokens(messageId: string): number {
    return this.messageTokens.get(messageId) || 0
  }

  /**
   * Get total tokens for a specific tier
   */
  getTierTotal(tier: string): number {
    return this.tierTotals.get(tier) || 0
  }

  /**
   * Get all tier totals
   */
  getAllTierTotals(): Map<string, number> {
    return new Map(this.tierTotals)
  }

  /**
   * Get breakdown of token usage
   */
  getTokenBreakdown(): {
    total: number
    byTier: Record<string, number>
    messageCount: number
  } {
    const byTier: Record<string, number> = {}
    for (const [tier, tokens] of this.tierTotals) {
      byTier[tier] = tokens
    }

    return {
      total: this.runningTotal,
      byTier,
      messageCount: this.messageTokens.size,
    }
  }

  /**
   * Estimate tokens for text content
   */
  static estimateTokens(text: string): number {
    if (!text) return 0
    // More accurate estimation accounting for whitespace and punctuation
    return Math.ceil(text.length / 3.5)
  }

  /**
   * Estimate tokens for a message object
   */
  static estimateMessageTokens(message: any): number {
    const messageStr = JSON.stringify(message)
    return IncrementalTokenTracker.estimateTokens(messageStr)
  }

  /**
   * Reset all tracking data
   */
  reset(): void {
    this.runningTotal = 0
    this.messageTokens.clear()
    this.tierTotals.clear()

    // Reinitialize tier totals
    this.tierTotals.set("recent", 0)
    this.tierTotals.set("compressed", 0)
    this.tierTotals.set("semantic", 0)
    this.tierTotals.set("pinned", 0)

    this.log.debug("reset token tracker")
  }

  /**
   * Validate internal consistency (for debugging)
   */
  validate(): boolean {
    const calculatedTotal = Array.from(this.tierTotals.values()).reduce((sum, tokens) => sum + tokens, 0)
    const isValid = Math.abs(calculatedTotal - this.runningTotal) < 10 // Allow small rounding errors

    if (!isValid) {
      this.log.warn("token tracker inconsistency detected", {
        runningTotal: this.runningTotal,
        calculatedTotal,
        difference: Math.abs(calculatedTotal - this.runningTotal),
      })
    }

    return isValid
  }

  /**
   * Get statistics for monitoring
   */
  getStats(): {
    totalTokens: number
    messageCount: number
    averageTokensPerMessage: number
    tierDistribution: Record<string, { tokens: number; percentage: number }>
  } {
    const messageCount = this.messageTokens.size
    const averageTokensPerMessage = messageCount > 0 ? this.runningTotal / messageCount : 0

    const tierDistribution: Record<string, { tokens: number; percentage: number }> = {}
    for (const [tier, tokens] of this.tierTotals) {
      tierDistribution[tier] = {
        tokens,
        percentage: this.runningTotal > 0 ? (tokens / this.runningTotal) * 100 : 0,
      }
    }

    return {
      totalTokens: this.runningTotal,
      messageCount,
      averageTokensPerMessage,
      tierDistribution,
    }
  }
}
