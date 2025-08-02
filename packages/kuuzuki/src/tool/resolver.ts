import { Log } from "../util/log"
import { ToolCompatibilityMatrix } from "./compatibility-matrix"
import { ToolAnalytics } from "./analytics"

/**
 * Tool Resolver - Internal Utility
 *
 * This module resolves tool names and provides fallback alternatives when
 * requested tools are not available. It uses the compatibility matrix to
 * suggest functional equivalents.
 *
 * This is an internal utility and does not need a .txt description file
 * because it's not a user-facing tool registered in the ToolRegistry.
 */
export namespace ToolResolver {
  const log = Log.create({ service: "tool-resolver" })

  // Tool name mapping patterns
  const TOOL_MAPPINGS: Record<string, string[]> = {
    // Knowledge Base tools
    kb_read: ["kb-mcp_kb_read"],
    kb_search: ["kb-mcp_kb_search"],
    kb_update: ["kb-mcp_kb_update"],
    kb_create: ["kb-mcp_kb_create"],
    kb_delete: ["kb-mcp_kb_delete"],
    kb_status: ["kb-mcp_kb_status"],
    kb_issues: ["kb-mcp_kb_issues"],
    kb_list: ["kb-mcp_kb_list"],
    kb_backend_info: ["kb-mcp_kb_backend_info"],
    kb_backend_switch: ["kb-mcp_kb_backend_switch"],
    kb_backend_health: ["kb-mcp_kb_backend_health"],
    kb_semantic_search: ["kb-mcp_kb_semantic_search"],
    kb_graph_query: ["kb-mcp_kb_graph_query"],
    kb_export: ["kb-mcp_kb_export"],
    kb_import: ["kb-mcp_kb_import"],

    // Code analysis tools
    analyze_codebase: ["kb-mcp_analyze_codebase"],
    find_function_calls: ["kb-mcp_find_function_calls"],
    get_class_hierarchy: ["kb-mcp_get_class_hierarchy"],
    impact_analysis: ["kb-mcp_impact_analysis"],
    find_similar_code: ["kb-mcp_find_similar_code"],
    get_code_metrics: ["kb-mcp_get_code_metrics"],
    query_code_graph: ["kb-mcp_query_code_graph"],
    find_patterns: ["kb-mcp_find_patterns"],
    suggest_refactoring: ["kb-mcp_suggest_refactoring"],
    track_technical_debt: ["kb-mcp_track_technical_debt"],
    architectural_overview: ["kb-mcp_architectural_overview"],
    find_usage: ["kb-mcp_find_usage"],
    dependency_graph: ["kb-mcp_dependency_graph"],
    dead_code_detection: ["kb-mcp_dead_code_detection"],
    security_analysis: ["kb-mcp_security_analysis"],
    performance_hotspots: ["kb-mcp_performance_hotspots"],

    // Fork parity tools
    fork_parity_auto_triage_commits: ["fork-parity_fork_parity_auto_triage_commits"],
    fork_parity_get_detailed_status: ["fork-parity_fork_parity_get_detailed_status"],
    fork_parity_generate_dashboard: ["fork-parity_fork_parity_generate_dashboard"],
    fork_parity_get_actionable_items: ["fork-parity_fork_parity_get_actionable_items"],
    fork_parity_update_commit_status: ["fork-parity_fork_parity_update_commit_status"],
    fork_parity_batch_analyze_commits: ["fork-parity_fork_parity_batch_analyze_commits"],
    fork_parity_create_review_template: ["fork-parity_fork_parity_create_review_template"],
    fork_parity_generate_integration_plan: ["fork-parity_fork_parity_generate_integration_plan"],
    fork_parity_sync_and_analyze: ["fork-parity_fork_parity_sync_and_analyze"],
    fork_parity_advanced_analysis: ["fork-parity_fork_parity_advanced_analysis"],
    fork_parity_conflict_analysis: ["fork-parity_fork_parity_conflict_analysis"],
    fork_parity_migration_plan: ["fork-parity_fork_parity_migration_plan"],
    fork_parity_setup_github_actions: ["fork-parity_fork_parity_setup_github_actions"],
    fork_parity_setup_notifications: ["fork-parity_fork_parity_setup_notifications"],
    fork_parity_send_notification: ["fork-parity_fork_parity_send_notification"],
    fork_parity_learn_adaptation: ["fork-parity_fork_parity_learn_adaptation"],

    // Generic patterns
    kb: ["kb-mcp_kb_read", "kb-mcp_kb_search", "kb-mcp_kb_status"],
    moidvk: ["mcp__moidvk__check_code_practices", "mcp__moidvk__format_code"],
  }

  // Functionality-based alternatives
  const FUNCTIONALITY_ALTERNATIVES: Record<
    string,
    Array<{
      tools: string[]
      description: string
      strategy: "sequential" | "parallel" | "choice"
    }>
  > = {
    kb_read: [
      {
        tools: ["read"],
        description: "Read specific files directly",
        strategy: "choice",
      },
      {
        tools: ["list", "read"],
        description: "List directory contents then read files",
        strategy: "sequential",
      },
    ],
    kb_search: [
      {
        tools: ["grep"],
        description: "Search file contents using grep",
        strategy: "choice",
      },
      {
        tools: ["glob", "grep"],
        description: "Find files by pattern then search contents",
        strategy: "sequential",
      },
    ],
    kb_update: [
      {
        tools: ["write"],
        description: "Create or update files directly",
        strategy: "choice",
      },
    ],
    kb_status: [
      {
        tools: ["bash"],
        description: "Use bash commands to check status",
        strategy: "choice",
      },
    ],
  }

  export interface ResolutionResult {
    success: boolean
    resolvedTool?: string
    alternatives?: Array<{
      tools: string[]
      description: string
      strategy: "sequential" | "parallel" | "choice"
    }>
    fallbackSuggestion?: string
  }

  /**
   * Resolve a tool name to an available tool or suggest alternatives
   */
  export function resolve(requestedTool: string, availableTools: Set<string>): ResolutionResult {
    log.debug("resolving tool", { requestedTool, availableToolsCount: availableTools.size })

    // Step 1: Direct match
    if (availableTools.has(requestedTool)) {
      log.debug("direct match found", { requestedTool })
      ToolAnalytics.recordResolution(requestedTool, true, "direct-match", requestedTool)
      return { success: true, resolvedTool: requestedTool }
    }

    // Step 2: Use compatibility matrix for comprehensive resolution
    const bestAlternative = ToolCompatibilityMatrix.getBestAlternative(requestedTool, availableTools)

    if (bestAlternative.type === "exact") {
      log.info("exact alternative found via matrix", {
        requestedTool,
        resolvedTool: bestAlternative.alternative,
      })
      ToolAnalytics.recordResolution(requestedTool, true, "matrix-exact", bestAlternative.alternative)
      return { success: true, resolvedTool: bestAlternative.alternative }
    }

    if (bestAlternative.type === "functional" && bestAlternative.confidence > 0.7) {
      log.info("high-confidence functional alternative found", {
        requestedTool,
        alternative: bestAlternative.alternative,
        confidence: bestAlternative.confidence,
      })
      return {
        success: false,
        alternatives: [bestAlternative.alternative],
        fallbackSuggestion: createFallbackSuggestion(requestedTool, bestAlternative.alternative),
      }
    }

    // Step 3: Legacy exact mapping (fallback)
    const mappedTools = TOOL_MAPPINGS[requestedTool]
    if (mappedTools) {
      for (const mappedTool of mappedTools) {
        if (availableTools.has(mappedTool)) {
          log.info("legacy mapped tool found", { requestedTool, resolvedTool: mappedTool })
          return { success: true, resolvedTool: mappedTool }
        }
      }
    }

    // Step 4: Pattern matching
    const patternMatch = findPatternMatch(requestedTool, availableTools)
    if (patternMatch) {
      log.info("pattern match found", { requestedTool, resolvedTool: patternMatch })
      return { success: true, resolvedTool: patternMatch }
    }

    // Step 5: All alternatives from compatibility matrix
    if (bestAlternative.type && bestAlternative.confidence > 0.3) {
      const allAlternatives = ToolCompatibilityMatrix.getAlternatives(requestedTool)
      const validAlternatives = [
        ...allAlternatives.functional.filter((alt) => alt.tools.every((tool) => availableTools.has(tool))),
        ...allAlternatives.composite
          .map((alt) => ({
            tools: alt.steps.map((step) => step.tool),
            description: alt.description,
            strategy: "sequential" as const,
          }))
          .filter((alt) => alt.tools.every((tool) => availableTools.has(tool))),
      ]

      if (validAlternatives.length > 0) {
        log.info("matrix alternatives found", {
          requestedTool,
          alternativeCount: validAlternatives.length,
        })
        return {
          success: false,
          alternatives: validAlternatives,
          fallbackSuggestion: ToolCompatibilityMatrix.explainAlternatives(requestedTool, availableTools),
        }
      }
    }

    // Step 6: Legacy functionality alternatives
    const alternatives = FUNCTIONALITY_ALTERNATIVES[requestedTool]
    if (alternatives) {
      const validAlternatives = alternatives.filter((alt) => alt.tools.every((tool) => availableTools.has(tool)))

      if (validAlternatives.length > 0) {
        log.info("legacy functionality alternatives found", {
          requestedTool,
          alternativeCount: validAlternatives.length,
        })
        return {
          success: false,
          alternatives: validAlternatives,
          fallbackSuggestion: createFallbackSuggestion(requestedTool, validAlternatives[0]),
        }
      }
    }

    // Step 7: Fuzzy matching
    const fuzzyMatch = findFuzzyMatch(requestedTool, availableTools)
    if (fuzzyMatch) {
      log.info("fuzzy match found", { requestedTool, resolvedTool: fuzzyMatch })
      return { success: true, resolvedTool: fuzzyMatch }
    }

    // Step 8: No resolution possible
    log.warn("no resolution found", { requestedTool })
    ToolAnalytics.recordResolution(requestedTool, false, "no-resolution")
    return {
      success: false,
      fallbackSuggestion:
        ToolCompatibilityMatrix.explainAlternatives(requestedTool, availableTools) ||
        createGenericFallbackSuggestion(requestedTool),
    }
  }

  /**
   * Find tools matching common patterns
   */
  function findPatternMatch(requestedTool: string, availableTools: Set<string>): string | null {
    // Try common MCP prefixing patterns
    const patterns = [
      `kb-mcp_${requestedTool}`,
      `fork-parity_${requestedTool}`,
      `mcp__moidvk__${requestedTool}`,
      `${requestedTool.replace("_", "-mcp_")}`,
      `${requestedTool.replace("_", "-parity_")}`,
    ]

    for (const pattern of patterns) {
      if (availableTools.has(pattern)) {
        return pattern
      }
    }

    return null
  }

  /**
   * Find tools with similar names using fuzzy matching
   */
  function findFuzzyMatch(requestedTool: string, availableTools: Set<string>): string | null {
    const candidates: Array<{ tool: string; score: number }> = []

    for (const tool of availableTools) {
      const score = calculateSimilarity(requestedTool, tool)
      if (score > 0.6) {
        // Threshold for fuzzy matching
        candidates.push({ tool, score })
      }
    }

    if (candidates.length === 0) return null

    // Return the best match
    candidates.sort((a, b) => b.score - a.score)
    return candidates[0].tool
  }

  /**
   * Calculate similarity between two strings
   */
  function calculateSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    if (longer.length === 0) return 1.0

    const distance = levenshteinDistance(longer, shorter)
    return (longer.length - distance) / longer.length
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  function levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null))

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator, // substitution
        )
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * Create a fallback suggestion for functionality alternatives
   */
  function createFallbackSuggestion(
    requestedTool: string,
    alternative: { tools: string[]; description: string; strategy: string },
  ): string {
    const toolList = alternative.tools.join(", ")
    return `The '${requestedTool}' tool isn't available, but I can achieve similar functionality using: ${alternative.description}. I'll use these tools: ${toolList}`
  }

  /**
   * Create a generic fallback suggestion
   */
  function createGenericFallbackSuggestion(requestedTool: string): string {
    return `The '${requestedTool}' tool isn't available. I can try to help you achieve your goal using alternative approaches with the available tools (bash, read, write, grep, glob, etc.). Please let me know what you're trying to accomplish.`
  }

  /**
   * Get all available tool mappings for debugging
   */
  export function getMappings(): Record<string, string[]> {
    return { ...TOOL_MAPPINGS }
  }

  /**
   * Get functionality alternatives for debugging
   */
  export function getAlternatives(): typeof FUNCTIONALITY_ALTERNATIVES {
    return { ...FUNCTIONALITY_ALTERNATIVES }
  }
}
