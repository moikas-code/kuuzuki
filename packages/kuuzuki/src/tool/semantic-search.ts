import { RuleRecord } from "./memory-storage";

/**
 * Advanced semantic search capabilities for memory rules
 * Provides fuzzy matching and context-aware suggestions
 */
export class SemanticSearch {
  /**
   * Perform fuzzy search with similarity scoring
   */
  static searchWithSimilarity(
    rules: RuleRecord[],
    query: string,
    threshold: number = 0.3,
  ): SearchResult[] {
    const results: SearchResult[] = [];
    const queryWords = this.tokenize(query.toLowerCase());

    for (const rule of rules) {
      const similarity = this.calculateSimilarity(rule, queryWords);

      if (similarity >= threshold) {
        results.push({
          rule,
          similarity,
          matchedFields: this.getMatchedFields(rule, queryWords),
          relevanceScore: this.calculateRelevanceScore(rule, similarity),
        });
      }
    }

    // Sort by relevance score (combination of similarity and usage)
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Get context-aware rule suggestions based on session context
   */
  static suggestRules(
    rules: RuleRecord[],
    context: SessionContext,
  ): RuleSuggestion[] {
    const suggestions: RuleSuggestion[] = [];

    for (const rule of rules) {
      const contextScore = this.calculateContextScore(rule, context);

      if (contextScore > 0.2) {
        suggestions.push({
          rule,
          contextScore,
          reason: this.generateSuggestionReason(rule, context),
          confidence: this.calculateConfidence(rule, contextScore),
        });
      }
    }

    return suggestions
      .sort((a, b) => b.contextScore - a.contextScore)
      .slice(0, 10); // Top 10 suggestions
  }

  /**
   * Find similar rules to avoid duplicates
   */
  static findSimilarRules(
    rules: RuleRecord[],
    targetRule: RuleRecord,
    threshold: number = 0.7,
  ): RuleRecord[] {
    const targetWords = this.tokenize(targetRule.text.toLowerCase());
    const similar: Array<{ rule: RuleRecord; similarity: number }> = [];

    for (const rule of rules) {
      if (rule.id === targetRule.id) continue;

      const similarity = this.calculateTextSimilarity(
        targetWords,
        this.tokenize(rule.text.toLowerCase()),
      );

      if (similarity >= threshold) {
        similar.push({ rule, similarity });
      }
    }

    return similar
      .sort((a, b) => b.similarity - a.similarity)
      .map((item) => item.rule);
  }

  /**
   * Tokenize text into meaningful words
   */
  private static tokenize(text: string): string[] {
    return text
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .filter((word) => !this.isStopWord(word));
  }

  /**
   * Calculate similarity between rule and query
   */
  private static calculateSimilarity(
    rule: RuleRecord,
    queryWords: string[],
  ): number {
    const ruleWords = this.tokenize(rule.text.toLowerCase());
    const reasonWords = rule.reason
      ? this.tokenize(rule.reason.toLowerCase())
      : [];
    const tagWords = this.extractTags(rule.tags);

    // Calculate different similarity scores
    const textSimilarity = this.calculateTextSimilarity(queryWords, ruleWords);
    const reasonSimilarity =
      reasonWords.length > 0
        ? this.calculateTextSimilarity(queryWords, reasonWords)
        : 0;
    const tagSimilarity =
      tagWords.length > 0
        ? this.calculateTextSimilarity(queryWords, tagWords)
        : 0;

    // Weighted combination
    return textSimilarity * 0.6 + reasonSimilarity * 0.3 + tagSimilarity * 0.1;
  }

  /**
   * Calculate text similarity using Jaccard index
   */
  private static calculateTextSimilarity(
    words1: string[],
    words2: string[],
  ): number {
    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter((word) => set2.has(word)));
    const union = new Set([...set1, ...set2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * Calculate context-based score for rule suggestions
   */
  private static calculateContextScore(
    rule: RuleRecord,
    context: SessionContext,
  ): number {
    let score = 0;

    // File type relevance
    const fileTypes = JSON.parse(context.fileTypes || "[]");
    const ruleText = rule.text.toLowerCase();

    for (const fileType of fileTypes) {
      if (ruleText.includes(fileType.toLowerCase())) {
        score += 0.3;
      }
    }

    // Working directory relevance
    const workingDir = context.workingDirectory.toLowerCase();
    if (ruleText.includes("test") && workingDir.includes("test")) {
      score += 0.2;
    }
    if (ruleText.includes("src") && workingDir.includes("src")) {
      score += 0.2;
    }

    // Usage frequency boost
    score += Math.min(rule.usageCount * 0.1, 0.5);

    // Category importance
    const categoryWeights = {
      critical: 0.4,
      preferred: 0.3,
      contextual: 0.2,
      deprecated: 0.1,
    };
    score += categoryWeights[rule.category] || 0;

    return Math.min(score, 1.0);
  }

  /**
   * Calculate confidence level for suggestions
   */
  private static calculateConfidence(
    rule: RuleRecord,
    contextScore: number,
  ): "high" | "medium" | "low" {
    if (contextScore > 0.7 && rule.usageCount > 5) return "high";
    if (contextScore > 0.5 && rule.usageCount > 2) return "medium";
    return "low";
  }

  /**
   * Generate human-readable reason for suggestion
   */
  private static generateSuggestionReason(
    rule: RuleRecord,
    context: SessionContext,
  ): string {
    const reasons: string[] = [];

    const fileTypes = JSON.parse(context.fileTypes || "[]");
    const ruleText = rule.text.toLowerCase();

    // File type match
    for (const fileType of fileTypes) {
      if (ruleText.includes(fileType.toLowerCase())) {
        reasons.push(`Relevant for ${fileType} files`);
        break;
      }
    }

    // Usage frequency
    if (rule.usageCount > 10) {
      reasons.push("Frequently used rule");
    } else if (rule.usageCount > 5) {
      reasons.push("Commonly applied rule");
    }

    // Category importance
    if (rule.category === "critical") {
      reasons.push("Critical rule for code quality");
    }

    // Recent usage
    if (rule.lastUsed) {
      const daysSince =
        (Date.now() - new Date(rule.lastUsed).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysSince < 7) {
        reasons.push("Recently used");
      }
    }

    return reasons.length > 0 ? reasons.join(", ") : "Contextually relevant";
  }

  /**
   * Get matched fields for highlighting
   */
  private static getMatchedFields(
    rule: RuleRecord,
    queryWords: string[],
  ): string[] {
    const matched: string[] = [];

    const ruleWords = this.tokenize(rule.text.toLowerCase());
    const reasonWords = rule.reason
      ? this.tokenize(rule.reason.toLowerCase())
      : [];
    const tagWords = this.extractTags(rule.tags);

    if (queryWords.some((word) => ruleWords.includes(word))) {
      matched.push("text");
    }

    if (
      reasonWords.length > 0 &&
      queryWords.some((word) => reasonWords.includes(word))
    ) {
      matched.push("reason");
    }

    if (
      tagWords.length > 0 &&
      queryWords.some((word) => tagWords.includes(word))
    ) {
      matched.push("tags");
    }

    return matched;
  }

  /**
   * Calculate relevance score combining similarity and usage
   */
  private static calculateRelevanceScore(
    rule: RuleRecord,
    similarity: number,
  ): number {
    const usageBoost = Math.min(rule.usageCount * 0.1, 0.3);
    const categoryBoost =
      rule.category === "critical"
        ? 0.2
        : rule.category === "preferred"
          ? 0.1
          : 0;
    const recentBoost =
      rule.lastUsed && this.isRecentlyUsed(rule.lastUsed) ? 0.1 : 0;

    return similarity + usageBoost + categoryBoost + recentBoost;
  }

  /**
   * Extract tags from JSON string
   */
  private static extractTags(tagsJson: string): string[] {
    try {
      const tags = JSON.parse(tagsJson || "[]");
      return Array.isArray(tags) ? tags.map((tag) => tag.toLowerCase()) : [];
    } catch {
      return [];
    }
  }

  /**
   * Check if rule was used recently (within 30 days)
   */
  private static isRecentlyUsed(lastUsed: string): boolean {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return new Date(lastUsed).getTime() > thirtyDaysAgo;
  }

  /**
   * Check if word is a stop word
   */
  private static isStopWord(word: string): boolean {
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "can",
      "must",
      "shall",
      "this",
      "that",
      "these",
      "those",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
    ]);

    return stopWords.has(word.toLowerCase());
  }
}

// Interfaces for search results
export interface SearchResult {
  rule: RuleRecord;
  similarity: number;
  matchedFields: string[];
  relevanceScore: number;
}

export interface RuleSuggestion {
  rule: RuleRecord;
  contextScore: number;
  reason: string;
  confidence: "high" | "medium" | "low";
}

export interface SessionContext {
  sessionId: string;
  workingDirectory: string;
  fileTypes: string; // JSON array
  recentFiles: string; // JSON array
  lastActivity: string;
  contextData: string; // JSON object
}
