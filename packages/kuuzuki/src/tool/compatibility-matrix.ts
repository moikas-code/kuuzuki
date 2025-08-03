/**
 * Tool Compatibility Matrix - Internal Utility
 *
 * This module defines compatibility relationships between tools,
 * enabling intelligent fallback and substitution strategies.
 *
 * This is an internal utility and does not need a .txt description file
 * because it's not a user-facing tool registered in the ToolRegistry.
 */

export namespace ToolCompatibilityMatrix {
  export interface ToolMapping {
    /** Direct 1:1 tool name mappings */
    exact: Record<string, string[]>;

    /** Functional equivalents that can achieve the same result */
    functional: Record<string, FunctionalAlternative[]>;

    /** Composite alternatives that combine multiple tools */
    composite: Record<string, CompositeAlternative[]>;

    /** Partial alternatives that provide subset of functionality */
    partial: Record<string, PartialAlternative[]>;
  }

  export interface FunctionalAlternative {
    tools: string[];
    description: string;
    strategy: "sequential" | "parallel" | "choice";
    confidence: number; // 0-1, how well this alternative works
    parameterMapping?: Record<string, string>;
  }

  export interface CompositeAlternative {
    steps: Array<{
      tool: string;
      description: string;
      parameterMapping?: Record<string, string>;
    }>;
    description: string;
    confidence: number;
  }

  export interface PartialAlternative {
    tool: string;
    description: string;
    limitations: string[];
    confidence: number;
    parameterMapping?: Record<string, string>;
  }

  /**
   * Comprehensive tool compatibility matrix
   */
  export const MATRIX: ToolMapping = {
    exact: {
      // Knowledge Base Tools - MCP mappings
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

      // Code Analysis Tools
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

      // Fork Parity Tools
      fork: ["fork-parity_fork_parity_get_detailed_status"], // Generic fork -> most common status tool
      fork_parity_auto_triage_commits: [
        "fork-parity_fork_parity_auto_triage_commits",
      ],
      fork_parity_get_detailed_status: [
        "fork-parity_fork_parity_get_detailed_status",
      ],
      fork_parity_generate_dashboard: [
        "fork-parity_fork_parity_generate_dashboard",
      ],
      fork_parity_get_actionable_items: [
        "fork-parity_fork_parity_get_actionable_items",
      ],
      fork_parity_update_commit_status: [
        "fork-parity_fork_parity_update_commit_status",
      ],
      fork_parity_batch_analyze_commits: [
        "fork-parity_fork_parity_batch_analyze_commits",
      ],
      fork_parity_create_review_template: [
        "fork-parity_fork_parity_create_review_template",
      ],
      fork_parity_generate_integration_plan: [
        "fork-parity_fork_parity_generate_integration_plan",
      ],
      fork_parity_sync_and_analyze: [
        "fork-parity_fork_parity_sync_and_analyze",
      ],
      fork_parity_advanced_analysis: [
        "fork-parity_fork_parity_advanced_analysis",
      ],
      fork_parity_conflict_analysis: [
        "fork-parity_fork_parity_conflict_analysis",
      ],
      fork_parity_migration_plan: ["fork-parity_fork_parity_migration_plan"],
      fork_parity_setup_github_actions: [
        "fork-parity_fork_parity_setup_github_actions",
      ],
      fork_parity_setup_notifications: [
        "fork-parity_fork_parity_setup_notifications",
      ],
      fork_parity_send_notification: [
        "fork-parity_fork_parity_send_notification",
      ],
      fork_parity_learn_adaptation: [
        "fork-parity_fork_parity_learn_adaptation",
      ],

      // Development Tools (moidvk)
      moidvk_check_code_practices: ["mcp__moidvk__check_code_practices"],
      moidvk_format_code: ["mcp__moidvk__format_code"],
      moidvk_rust_code_practices: ["mcp__moidvk__rust_code_practices"],
      moidvk_python_code_analyzer: ["mcp__moidvk__python_code_analyzer"],
      moidvk_scan_security_vulnerabilities: [
        "mcp__moidvk__scan_security_vulnerabilities",
      ],
      moidvk_check_production_readiness: [
        "mcp__moidvk__check_production_readiness",
      ],
      moidvk_check_accessibility: ["mcp__moidvk__check_accessibility"],
    },

    functional: {
      // Knowledge Base Operations
      kb_read: [
        {
          tools: ["read"],
          description: "Read specific files directly using the read tool",
          strategy: "choice",
          confidence: 0.9,
          parameterMapping: { path: "filePath" },
        },
        {
          tools: ["list", "read"],
          description: "List directory contents then read specific files",
          strategy: "sequential",
          confidence: 0.8,
        },
      ],

      kb_search: [
        {
          tools: ["grep"],
          description: "Search file contents using grep pattern matching",
          strategy: "choice",
          confidence: 0.85,
          parameterMapping: { query: "pattern" },
        },
        {
          tools: ["glob", "grep"],
          description: "Find files by pattern then search their contents",
          strategy: "sequential",
          confidence: 0.8,
        },
      ],

      kb_update: [
        {
          tools: ["write"],
          description: "Create or update files directly using write tool",
          strategy: "choice",
          confidence: 0.95,
          parameterMapping: { path: "filePath", content: "content" },
        },
      ],

      kb_list: [
        {
          tools: ["list"],
          description: "List directory contents using the list tool",
          strategy: "choice",
          confidence: 0.9,
          parameterMapping: { directory: "path" },
        },
        {
          tools: ["bash"],
          description: "Use bash ls command to list directory contents",
          strategy: "choice",
          confidence: 0.8,
        },
      ],

      kb_status: [
        {
          tools: ["bash"],
          description: "Use bash commands to check file/directory status",
          strategy: "choice",
          confidence: 0.8,
        },
      ],

      // Code Analysis Operations
      analyze_codebase: [
        {
          tools: ["glob", "read", "grep"],
          description: "Manually analyze codebase using file operations",
          strategy: "sequential",
          confidence: 0.6,
        },
      ],

      find_function_calls: [
        {
          tools: ["grep"],
          description: "Search for function calls using pattern matching",
          strategy: "choice",
          confidence: 0.7,
        },
      ],

      find_usage: [
        {
          tools: ["grep"],
          description: "Find symbol usage using text search",
          strategy: "choice",
          confidence: 0.75,
        },
      ],

      security_analysis: [
        {
          tools: ["bash"],
          description: "Run security scanning tools via bash",
          strategy: "choice",
          confidence: 0.6,
        },
      ],

      // Development Operations
      moidvk_check_code_practices: [
        {
          tools: ["bash"],
          description: "Run linting tools directly via bash",
          strategy: "choice",
          confidence: 0.7,
        },
      ],

      moidvk_format_code: [
        {
          tools: ["bash"],
          description: "Run code formatters directly via bash",
          strategy: "choice",
          confidence: 0.8,
        },
      ],
    },

    composite: {
      kb_search: [
        {
          steps: [
            {
              tool: "glob",
              description: "Find files matching pattern",
              parameterMapping: { query: "pattern" },
            },
            {
              tool: "grep",
              description: "Search content in found files",
              parameterMapping: { query: "pattern" },
            },
          ],
          description: "Two-step search: find files then search content",
          confidence: 0.8,
        },
      ],

      analyze_codebase: [
        {
          steps: [
            {
              tool: "glob",
              description: "Find all source files",
            },
            {
              tool: "read",
              description: "Read and analyze file contents",
            },
            {
              tool: "grep",
              description: "Search for patterns and dependencies",
            },
          ],
          description: "Manual codebase analysis using basic file operations",
          confidence: 0.5,
        },
      ],
    },

    partial: {
      kb_semantic_search: [
        {
          tool: "grep",
          description: "Text-based search (no semantic understanding)",
          limitations: [
            "No semantic understanding",
            "Exact text matching only",
          ],
          confidence: 0.4,
        },
      ],

      kb_graph_query: [
        {
          tool: "grep",
          description: "Pattern-based search (no graph relationships)",
          limitations: ["No relationship understanding", "No graph traversal"],
          confidence: 0.3,
        },
      ],

      get_code_metrics: [
        {
          tool: "bash",
          description: "Basic metrics using command-line tools",
          limitations: ["Limited metric types", "No integrated analysis"],
          confidence: 0.5,
        },
      ],
    },
  };

  /**
   * Get all possible alternatives for a tool
   */
  export function getAlternatives(toolName: string): {
    exact: string[];
    functional: FunctionalAlternative[];
    composite: CompositeAlternative[];
    partial: PartialAlternative[];
  } {
    return {
      exact: MATRIX.exact[toolName] || [],
      functional: MATRIX.functional[toolName] || [],
      composite: MATRIX.composite[toolName] || [],
      partial: MATRIX.partial[toolName] || [],
    };
  }

  /**
   * Get the best alternative for a tool given available tools
   */
  export function getBestAlternative(
    toolName: string,
    availableTools: Set<string>,
  ): {
    type: "exact" | "functional" | "composite" | "partial" | null;
    alternative: any;
    confidence: number;
  } {
    const alternatives = getAlternatives(toolName);

    // Check exact matches first
    for (const exactTool of alternatives.exact) {
      if (availableTools.has(exactTool)) {
        return {
          type: "exact",
          alternative: exactTool,
          confidence: 1.0,
        };
      }
    }

    // Check functional alternatives
    const validFunctional = alternatives.functional.filter((alt) =>
      alt.tools.every((tool) => availableTools.has(tool)),
    );
    if (validFunctional.length > 0) {
      const best = validFunctional.reduce((a, b) =>
        a.confidence > b.confidence ? a : b,
      );
      return {
        type: "functional",
        alternative: best,
        confidence: best.confidence,
      };
    }

    // Check composite alternatives
    const validComposite = alternatives.composite.filter((alt) =>
      alt.steps.every((step) => availableTools.has(step.tool)),
    );
    if (validComposite.length > 0) {
      const best = validComposite.reduce((a, b) =>
        a.confidence > b.confidence ? a : b,
      );
      return {
        type: "composite",
        alternative: best,
        confidence: best.confidence,
      };
    }

    // Check partial alternatives
    const validPartial = alternatives.partial.filter((alt) =>
      availableTools.has(alt.tool),
    );
    if (validPartial.length > 0) {
      const best = validPartial.reduce((a, b) =>
        a.confidence > b.confidence ? a : b,
      );
      return {
        type: "partial",
        alternative: best,
        confidence: best.confidence,
      };
    }

    return {
      type: null,
      alternative: null,
      confidence: 0,
    };
  }

  /**
   * Generate a human-readable explanation of available alternatives
   */
  export function explainAlternatives(
    toolName: string,
    availableTools: Set<string>,
  ): string {
    const alternatives = getAlternatives(toolName);
    const explanations: string[] = [];

    // Exact alternatives
    const exactMatches = alternatives.exact.filter((tool) =>
      availableTools.has(tool),
    );
    if (exactMatches.length > 0) {
      explanations.push(`✅ Direct replacement: ${exactMatches.join(", ")}`);
    }

    // Functional alternatives
    const functionalMatches = alternatives.functional.filter((alt) =>
      alt.tools.every((tool) => availableTools.has(tool)),
    );
    if (functionalMatches.length > 0) {
      explanations.push("🔄 Functional alternatives:");
      functionalMatches.forEach((alt, i) => {
        explanations.push(
          `  ${i + 1}. ${alt.description} (confidence: ${Math.round(alt.confidence * 100)}%)`,
        );
      });
    }

    // Composite alternatives
    const compositeMatches = alternatives.composite.filter((alt) =>
      alt.steps.every((step) => availableTools.has(step.tool)),
    );
    if (compositeMatches.length > 0) {
      explanations.push("🔧 Multi-step alternatives:");
      compositeMatches.forEach((alt, i) => {
        explanations.push(
          `  ${i + 1}. ${alt.description} (confidence: ${Math.round(alt.confidence * 100)}%)`,
        );
      });
    }

    // Partial alternatives
    const partialMatches = alternatives.partial.filter((alt) =>
      availableTools.has(alt.tool),
    );
    if (partialMatches.length > 0) {
      explanations.push("⚠️  Partial alternatives (limited functionality):");
      partialMatches.forEach((alt, i) => {
        explanations.push(
          `  ${i + 1}. ${alt.description} (confidence: ${Math.round(alt.confidence * 100)}%)`,
        );
        explanations.push(`     Limitations: ${alt.limitations.join(", ")}`);
      });
    }

    if (explanations.length === 0) {
      return `❌ No alternatives found for '${toolName}' with current available tools.`;
    }

    return `Alternatives for '${toolName}':\n\n${explanations.join("\n")}`;
  }
}
