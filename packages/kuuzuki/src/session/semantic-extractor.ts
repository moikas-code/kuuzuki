import { Log } from "../util/log"
import { MessageV2 } from "./message-v2"
import { HybridContext } from "./hybrid-context"

/**
 * SemanticExtractor
 *
 * Extracts semantic facts from conversation messages using pattern matching
 * and heuristics. This is the core intelligence that preserves meaning
 * during compression.
 */
export class SemanticExtractor {
  private readonly log = Log.create({ service: "semantic-extractor" })

  /**
   * Extraction patterns for different types of semantic facts
   */
  private static readonly EXTRACTION_PATTERNS: Record<HybridContext.SemanticFactType, RegExp[]> = {
    architecture: [
      /uses?\s+([\w\s]+)\s+pattern/i,
      /built\s+with\s+([\w\s]+)/i,
      /architecture\s+is\s+([\w\s]+)/i,
      /follows\s+([\w\s]+)\s+architecture/i,
      /implements?\s+([\w\s]+)\s+pattern/i,
    ],
    pattern: [
      /code\s+pattern[:\s]+([\w\s]+)/i,
      /follows?\s+([\w\s]+)\s+convention/i,
      /uses?\s+([\w\s]+)\s+style/i,
      /pattern[:\s]+([\w\s]+)/i,
    ],
    decision: [
      /decided?\s+to\s+([\w\s]+)/i,
      /chose\s+([\w\s]+)\s+because/i,
      /going\s+with\s+([\w\s]+)/i,
      /will\s+use\s+([\w\s]+)/i,
      /decision[:\s]+([\w\s]+)/i,
    ],
    relationship: [
      /(\w+\.ts)\s+imports?\s+(\w+\.ts)/i,
      /(\w+)\s+depends\s+on\s+(\w+)/i,
      /(\w+)\s+extends\s+(\w+)/i,
      /(\w+)\s+uses\s+(\w+)/i,
      /(\w+)\s+calls\s+(\w+)/i,
    ],
    error_solution: [
      /error[:\s]+([\w\s]+)\s+fixed\s+by\s+([\w\s]+)/i,
      /solved\s+([\w\s]+)\s+by\s+([\w\s]+)/i,
      /fix[:\s]+([\w\s]+)/i,
      /solution[:\s]+([\w\s]+)/i,
    ],
    tool_usage: [/used\s+([\w]+)\s+tool\s+to\s+([\w\s]+)/i, /ran\s+([\w]+)\s+command/i, /executed\s+([\w\s]+)/i],
    file_structure: [
      /project\s+structure[:\s]+([\w\s\/]+)/i,
      /directory\s+layout[:\s]+([\w\s\/]+)/i,
      /files?\s+in\s+([\w\/]+)/i,
      /src\/[\w\/]+/g,
    ],
    configuration: [
      /config[:\s]+([\w\s]+)/i,
      /setting[:\s]+([\w\s]+)/i,
      /environment[:\s]+([\w\s]+)/i,
      /configured\s+([\w\s]+)/i,
    ],
  }

  /**
   * Extract semantic facts from a list of messages
   */
  async extractFacts(messages: MessageV2.Info[]): Promise<HybridContext.SemanticFact[]> {
    const facts: HybridContext.SemanticFact[] = []

    for (const message of messages) {
      const messageFacts = await this.extractFromMessage(message)
      facts.push(...messageFacts)
    }

    // Deduplicate and merge similar facts
    const deduplicated = this.deduplicateFacts(facts)

    this.log.debug("extracted semantic facts", {
      originalCount: facts.length,
      deduplicatedCount: deduplicated.length,
    })

    return deduplicated
  }

  /**
   * Extract semantic facts from a single message
   */
  private async extractFromMessage(message: MessageV2.Info): Promise<HybridContext.SemanticFact[]> {
    const facts: HybridContext.SemanticFact[] = []

    // Extract from message parts
    for (const part of await this.getMessageParts(message)) {
      if (part.type === "text") {
        const textFacts = this.extractFromText(part.text, message.id)
        facts.push(...textFacts)
      } else if (part.type === "tool") {
        const toolFacts = this.extractFromToolUsage(part, message.id)
        facts.push(...toolFacts)
      }
    }

    return facts
  }

  /**
   * Extract facts from text content
   */
  private extractFromText(text: string, messageId: string): HybridContext.SemanticFact[] {
    const facts: HybridContext.SemanticFact[] = []

    for (const [factType, patterns] of Object.entries(SemanticExtractor.EXTRACTION_PATTERNS)) {
      for (const pattern of patterns) {
        const matches = text.match(pattern)
        if (matches) {
          const fact = this.createFact(
            factType as HybridContext.SemanticFactType,
            matches[0],
            messageId,
            this.calculateConfidence(matches, text),
          )
          facts.push(fact)
        }
      }
    }

    return facts
  }

  /**
   * Extract facts from tool usage
   */
  private extractFromToolUsage(toolPart: MessageV2.ToolPart, messageId: string): HybridContext.SemanticFact[] {
    const facts: HybridContext.SemanticFact[] = []

    // Extract tool usage patterns
    if (toolPart.tool === "read") {
      const filePath = toolPart.state?.status === "completed" ? toolPart.state.input?.["filePath"] : undefined
      if (filePath) {
        facts.push(this.createFact("file_structure", `Read file: ${filePath}`, messageId, 0.9))
      }
    } else if (toolPart.tool === "write") {
      const filePath = toolPart.state?.status === "completed" ? toolPart.state.input?.["filePath"] : undefined
      if (filePath) {
        facts.push(this.createFact("file_structure", `Created/modified file: ${filePath}`, messageId, 0.9))
      }
    } else if (toolPart.tool === "bash") {
      const command = toolPart.state?.status === "completed" ? toolPart.state.input?.["command"] : undefined
      if (command) {
        facts.push(this.createFact("tool_usage", `Executed command: ${command}`, messageId, 0.8))
      }
    }

    return facts
  }

  /**
   * Create a semantic fact
   */
  private createFact(
    type: HybridContext.SemanticFactType,
    content: string,
    messageId: string,
    confidence: number,
  ): HybridContext.SemanticFact {
    return {
      id: this.generateFactId(),
      type,
      content: content.trim(),
      importance: this.determineImportance(type, content),
      extractedFrom: [messageId],
      timestamp: Date.now(),
      confidence,
      tags: this.generateTags(type, content),
      relatedFacts: [],
    }
  }

  /**
   * Determine importance level based on fact type and content
   */
  private determineImportance(type: HybridContext.SemanticFactType, content: string): HybridContext.ImportanceLevel {
    // Architecture and decisions are typically critical
    if (type === "architecture" || type === "decision") {
      return "critical"
    }

    // Error solutions are high importance
    if (type === "error_solution") {
      return "high"
    }

    // File relationships and patterns are medium importance
    if (type === "relationship" || type === "pattern") {
      return "medium"
    }

    // Check content for importance indicators
    if (content.toLowerCase().includes("important") || content.toLowerCase().includes("critical")) {
      return "high"
    }

    return "medium"
  }

  /**
   * Calculate confidence score for extracted fact
   */
  private calculateConfidence(matches: RegExpMatchArray, fullText: string): number {
    let confidence = 0.7 // Base confidence

    // Increase confidence for longer matches
    if (matches[0].length > 20) confidence += 0.1

    // Increase confidence if match appears in context of explanation
    if (fullText.toLowerCase().includes("because") || fullText.toLowerCase().includes("since")) {
      confidence += 0.1
    }

    // Decrease confidence for very short matches
    if (matches[0].length < 10) confidence -= 0.2

    return Math.max(0.1, Math.min(1.0, confidence))
  }

  /**
   * Generate tags for categorization
   */
  private generateTags(type: HybridContext.SemanticFactType, content: string): string[] {
    const tags: string[] = [type]

    // Add technology tags
    const techKeywords = ["typescript", "javascript", "react", "node", "express", "database", "api", "jwt", "auth"]
    for (const keyword of techKeywords) {
      if (content.toLowerCase().includes(keyword)) {
        tags.push(keyword)
      }
    }

    // Add file type tags
    if (content.includes(".ts")) tags.push("typescript")
    if (content.includes(".js")) tags.push("javascript")
    if (content.includes(".json")) tags.push("config")

    return tags
  }

  /**
   * Deduplicate similar facts
   */
  private deduplicateFacts(facts: HybridContext.SemanticFact[]): HybridContext.SemanticFact[] {
    const deduplicated: HybridContext.SemanticFact[] = []
    const seen = new Set<string>()

    for (const fact of facts) {
      const key = `${fact.type}:${fact.content.toLowerCase().trim()}`

      if (!seen.has(key)) {
        seen.add(key)
        deduplicated.push(fact)
      } else {
        // Merge with existing fact
        const existing = deduplicated.find(
          (f) => f.type === fact.type && f.content.toLowerCase().trim() === fact.content.toLowerCase().trim(),
        )
        if (existing) {
          existing.extractedFrom.push(...fact.extractedFrom)
          existing.confidence = Math.max(existing.confidence, fact.confidence)
          existing.tags = [...new Set([...existing.tags, ...fact.tags])]
        }
      }
    }

    return deduplicated
  }

  /**
   * Generate unique fact ID
   */
  private generateFactId(): string {
    return `fact_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * Get message parts from storage
   */
  private async getMessageParts(message: MessageV2.Info): Promise<MessageV2.Part[]> {
    try {
      const { Storage } = await import("../storage/storage")
      const partFiles = await Storage.list(`session/part/${message.sessionID}/${message.id}/`)
      const parts: MessageV2.Part[] = []

      for (const file of partFiles) {
        if (file.endsWith(".json")) {
          const part = await Storage.readJSON<MessageV2.Part>(
            `session/part/${message.sessionID}/${message.id}/${file.replace(".json", "")}`,
          )
          if (part) parts.push(part)
        }
      }

      return parts
    } catch (error) {
      this.log.error("failed to load message parts", { error, messageId: message.id })
      return []
    }
  }

  /**
   * Score the importance of a message for extraction priority
   */
  async scoreMessageImportance(message: MessageV2.Info): Promise<number> {
    let score = 0

    // Recency bonus (exponential decay over 24 hours)
    const age = Date.now() - message.time.created
    score += Math.exp(-age / (24 * 60 * 60 * 1000))

    // Role-based scoring
    if (message.role === "assistant") score += 0.3
    if (message.role === "user") score += 0.2

    // Content-based scoring
    try {
      const parts = await this.getMessageParts(message)

      for (const part of parts) {
        if (part.type === "text") {
          const text = part.text.toLowerCase()

          // Keywords that indicate importance
          const importantKeywords = [
            "error",
            "fixed",
            "bug",
            "issue",
            "problem",
            "solution",
            "decision",
            "architecture",
            "design",
            "pattern",
            "breaking change",
            "critical",
            "security",
            "vulnerability",
            "performance",
            "optimization",
            "refactor",
          ]

          for (const keyword of importantKeywords) {
            if (text.includes(keyword)) {
              score += 0.15
            }
          }

          // Length indicates detail and potential importance
          if (text.length > 1000) score += 0.2
          else if (text.length > 500) score += 0.1

          // Code blocks indicate technical content
          if (text.includes("```")) score += 0.15

          // Questions indicate important context
          if (text.includes("?")) score += 0.05
        } else if (part.type === "tool") {
          // Tool usage is generally important
          score += 0.15

          // Certain tools are more important
          if (["write", "edit", "bash", "git"].includes(part.tool)) {
            score += 0.1
          }

          // Successful tool executions are more important
          if (part.state?.status === "completed") {
            score += 0.05
          }
        }
      }
    } catch (error) {
      this.log.warn("failed to score message content", { error, messageId: message.id })
    }

    return Math.min(1.0, score)
  }

  /**
   * Extract relationships between facts
   */
  findFactRelationships(facts: HybridContext.SemanticFact[]): void {
    for (let i = 0; i < facts.length; i++) {
      for (let j = i + 1; j < facts.length; j++) {
        const fact1 = facts[i]
        const fact2 = facts[j]

        // Check for content similarity
        if (this.areFactsRelated(fact1, fact2)) {
          fact1.relatedFacts.push(fact2.id)
          fact2.relatedFacts.push(fact1.id)
        }
      }
    }
  }

  /**
   * Check if two facts are related
   */
  private areFactsRelated(fact1: HybridContext.SemanticFact, fact2: HybridContext.SemanticFact): boolean {
    // Same type facts are potentially related
    if (fact1.type === fact2.type) return true

    // Check for common tags
    const commonTags = fact1.tags.filter((tag) => fact2.tags.includes(tag))
    if (commonTags.length > 1) return true

    // Check for content overlap
    const words1 = fact1.content.toLowerCase().split(/\s+/)
    const words2 = fact2.content.toLowerCase().split(/\s+/)
    const commonWords = words1.filter((word) => words2.includes(word) && word.length > 3)

    return commonWords.length >= 2
  }

  /**
   * Rank messages by importance for compression decisions
   */
  async rankMessagesByImportance(messages: MessageV2.Info[]): Promise<Map<string, number>> {
    const scores = new Map<string, number>()

    // Score all messages
    await Promise.all(
      messages.map(async (message) => {
        const score = await this.scoreMessageImportance(message)
        scores.set(message.id, score)
      }),
    )

    return scores
  }

  /**
   * Extract key phrases from text for better fact extraction
   */
  public extractKeyPhrases(text: string): string[] {
    const phrases: string[] = []

    // Extract quoted strings as they often contain important information
    const quotedMatches = text.match(/"([^"]+)"|'([^']+)'/g)
    if (quotedMatches) {
      phrases.push(...quotedMatches.map((m) => m.slice(1, -1)))
    }

    // Extract file paths
    const pathMatches = text.match(/[\w\-./]+\.(ts|js|tsx|jsx|json|md|yaml|yml)/g)
    if (pathMatches) {
      phrases.push(...pathMatches)
    }

    // Extract function/class names (CamelCase or snake_case)
    const nameMatches = text.match(/\b[A-Z][a-zA-Z0-9]+\b|\b[a-z]+_[a-z_]+\b/g)
    if (nameMatches) {
      phrases.push(...nameMatches)
    }

    return [...new Set(phrases)] // Deduplicate
  }
}
