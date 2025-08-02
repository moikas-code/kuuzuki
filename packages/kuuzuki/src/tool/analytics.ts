import { Log } from "../util/log"

/**
 * Tool Analytics - Internal Utility
 *
 * This is an internal analytics tracking system for tool resolution attempts.
 * It does not need a .txt description file because it's not a user-facing tool
 * and is not registered in the ToolRegistry for AI agent use.
 */
export namespace ToolAnalytics {
  const log = Log.create({ service: "tool-analytics" })

  interface AnalyticsData {
    toolResolutions: Map<string, ResolutionStats>
    totalInterceptions: number
    successfulResolutions: number
    failedResolutions: number
    mostRequestedMissingTools: Map<string, number>
    resolutionMethods: Map<string, number>
    sessionStart: number
  }

  interface ResolutionStats {
    requested: number
    resolved: number
    failed: number
    lastResolution?: {
      method: string
      resolvedTo?: string
      timestamp: number
    }
  }

  // In-memory analytics store (could be persisted later)
  let analytics: AnalyticsData = {
    toolResolutions: new Map(),
    totalInterceptions: 0,
    successfulResolutions: 0,
    failedResolutions: 0,
    mostRequestedMissingTools: new Map(),
    resolutionMethods: new Map(),
    sessionStart: Date.now(),
  }

  /**
   * Record a tool resolution attempt
   */
  export function recordResolution(requestedTool: string, success: boolean, method: string, resolvedTo?: string) {
    analytics.totalInterceptions++

    if (success) {
      analytics.successfulResolutions++
    } else {
      analytics.failedResolutions++
      // Track most requested missing tools
      const currentCount = analytics.mostRequestedMissingTools.get(requestedTool) || 0
      analytics.mostRequestedMissingTools.set(requestedTool, currentCount + 1)
    }

    // Track resolution methods
    const methodCount = analytics.resolutionMethods.get(method) || 0
    analytics.resolutionMethods.set(method, methodCount + 1)

    // Update tool-specific stats
    const toolStats = analytics.toolResolutions.get(requestedTool) || {
      requested: 0,
      resolved: 0,
      failed: 0,
    }

    toolStats.requested++
    if (success) {
      toolStats.resolved++
    } else {
      toolStats.failed++
    }

    toolStats.lastResolution = {
      method,
      resolvedTo,
      timestamp: Date.now(),
    }

    analytics.toolResolutions.set(requestedTool, toolStats)

    log.debug("recorded resolution", {
      requestedTool,
      success,
      method,
      resolvedTo,
      totalInterceptions: analytics.totalInterceptions,
    })
  }

  /**
   * Get comprehensive analytics report
   */
  export function getReport(): {
    summary: {
      totalInterceptions: number
      successRate: number
      failureRate: number
      sessionDuration: number
    }
    topMissingTools: Array<{ tool: string; requests: number }>
    resolutionMethods: Array<{ method: string; count: number; percentage: number }>
    toolStats: Array<{
      tool: string
      requested: number
      resolved: number
      failed: number
      successRate: number
      lastResolution?: {
        method: string
        resolvedTo?: string
        timestamp: number
      }
    }>
    recommendations: string[]
  } {
    const successRate =
      analytics.totalInterceptions > 0 ? (analytics.successfulResolutions / analytics.totalInterceptions) * 100 : 0

    const failureRate = 100 - successRate

    // Top missing tools
    const topMissingTools = Array.from(analytics.mostRequestedMissingTools.entries())
      .map(([tool, requests]) => ({ tool, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10)

    // Resolution methods
    const resolutionMethods = Array.from(analytics.resolutionMethods.entries())
      .map(([method, count]) => ({
        method,
        count,
        percentage: (count / analytics.totalInterceptions) * 100,
      }))
      .sort((a, b) => b.count - a.count)

    // Tool stats
    const toolStats = Array.from(analytics.toolResolutions.entries())
      .map(([tool, stats]) => ({
        tool,
        requested: stats.requested,
        resolved: stats.resolved,
        failed: stats.failed,
        successRate: stats.requested > 0 ? (stats.resolved / stats.requested) * 100 : 0,
        lastResolution: stats.lastResolution,
      }))
      .sort((a, b) => b.requested - a.requested)

    // Generate recommendations
    const recommendations = generateRecommendations(topMissingTools, resolutionMethods, toolStats)

    return {
      summary: {
        totalInterceptions: analytics.totalInterceptions,
        successRate: Math.round(successRate * 100) / 100,
        failureRate: Math.round(failureRate * 100) / 100,
        sessionDuration: Date.now() - analytics.sessionStart,
      },
      topMissingTools,
      resolutionMethods,
      toolStats,
      recommendations,
    }
  }

  /**
   * Generate recommendations based on analytics data
   */
  function generateRecommendations(
    topMissingTools: Array<{ tool: string; requests: number }>,
    resolutionMethods: Array<{ method: string; count: number; percentage: number }>,
    toolStats: Array<{ tool: string; requested: number; resolved: number; failed: number; successRate: number }>,
  ): string[] {
    const recommendations: string[] = []

    // Recommend installing missing tools
    if (topMissingTools.length > 0) {
      const topMissing = topMissingTools.slice(0, 3)
      recommendations.push(
        `Consider installing these frequently requested tools: ${topMissing.map((t) => t.tool).join(", ")}`,
      )
    }

    // Recommend improving resolution methods
    const lowSuccessTools = toolStats.filter((t) => t.successRate < 50 && t.requested > 2)
    if (lowSuccessTools.length > 0) {
      recommendations.push(
        `These tools have low resolution success rates and may need better alternatives: ${lowSuccessTools.map((t) => t.tool).join(", ")}`,
      )
    }

    // Recommend documentation updates
    const patternMatchMethod = resolutionMethods.find((m) => m.method === "pattern-match")
    if (patternMatchMethod && patternMatchMethod.percentage > 30) {
      recommendations.push(
        "High pattern matching usage suggests documentation should be updated with correct tool names",
      )
    }

    // Recommend MCP server setup
    const mcpTools = topMissingTools.filter((t) => t.tool.includes("kb_") || t.tool.includes("moidvk_"))
    if (mcpTools.length > 0) {
      recommendations.push("Consider setting up MCP servers for knowledge base and development tools")
    }

    return recommendations
  }

  /**
   * Reset analytics data
   */
  export function reset() {
    analytics = {
      toolResolutions: new Map(),
      totalInterceptions: 0,
      successfulResolutions: 0,
      failedResolutions: 0,
      mostRequestedMissingTools: new Map(),
      resolutionMethods: new Map(),
      sessionStart: Date.now(),
    }
    log.info("analytics data reset")
  }

  /**
   * Get simple stats for debugging
   */
  export function getStats(): {
    totalInterceptions: number
    successfulResolutions: number
    failedResolutions: number
    mostRequestedMissingTools: Record<string, number>
  } {
    return {
      totalInterceptions: analytics.totalInterceptions,
      successfulResolutions: analytics.successfulResolutions,
      failedResolutions: analytics.failedResolutions,
      mostRequestedMissingTools: Object.fromEntries(analytics.mostRequestedMissingTools),
    }
  }

  /**
   * Export analytics data for persistence
   */
  export function exportData(): string {
    return JSON.stringify(
      {
        ...analytics,
        toolResolutions: Object.fromEntries(analytics.toolResolutions),
        mostRequestedMissingTools: Object.fromEntries(analytics.mostRequestedMissingTools),
        resolutionMethods: Object.fromEntries(analytics.resolutionMethods),
      },
      null,
      2,
    )
  }

  /**
   * Import analytics data from persistence
   */
  export function importData(data: string) {
    try {
      const parsed = JSON.parse(data)
      analytics = {
        ...parsed,
        toolResolutions: new Map(Object.entries(parsed.toolResolutions || {})),
        mostRequestedMissingTools: new Map(Object.entries(parsed.mostRequestedMissingTools || {})),
        resolutionMethods: new Map(Object.entries(parsed.resolutionMethods || {})),
      }
      log.info("analytics data imported successfully")
    } catch (error) {
      log.error("failed to import analytics data", { error })
    }
  }
}
