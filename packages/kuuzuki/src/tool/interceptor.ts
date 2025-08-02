import { ToolResolver } from "./resolver"
import { Log } from "../util/log"
import { NamedError } from "../util/error"
import { z } from "zod"

/**
 * Tool Interceptor - Internal Utility
 *
 * This module intercepts tool calls and attempts to resolve missing tools
 * using the tool resolver and compatibility matrix.
 *
 * This is an internal utility and does not need a .txt description file
 * because it's not a user-facing tool registered in the ToolRegistry.
 */
export namespace ToolInterceptor {
  const log = Log.create({ service: "tool-interceptor" })

  export const ToolNotFoundError = NamedError.create(
    "ToolNotFoundError",
    z.object({
      requestedTool: z.string(),
      suggestion: z.string().optional(),
      alternatives: z
        .array(
          z.object({
            tools: z.array(z.string()),
            description: z.string(),
            strategy: z.enum(["sequential", "parallel", "choice"]),
          }),
        )
        .optional(),
    }),
  )

  export interface ToolCall {
    name: string
    parameters: any
  }

  export interface InterceptResult {
    success: boolean
    resolvedCall?: ToolCall
    errorMessage?: string
    alternatives?: Array<{
      tools: string[]
      description: string
      strategy: "sequential" | "parallel" | "choice"
    }>
  }

  /**
   * Intercept a tool call and attempt to resolve it if the tool is missing
   */
  export function intercept(toolCall: ToolCall, availableTools: Set<string>): InterceptResult {
    const { name, parameters } = toolCall

    log.debug("intercepting tool call", { toolName: name })

    // Check if tool exists
    if (availableTools.has(name)) {
      log.debug("tool exists, no interception needed", { toolName: name })
      return { success: true, resolvedCall: toolCall }
    }

    // Attempt resolution
    const resolution = ToolResolver.resolve(name, availableTools)

    if (resolution.success && resolution.resolvedTool) {
      log.info("tool resolved successfully", {
        originalTool: name,
        resolvedTool: resolution.resolvedTool,
      })

      return {
        success: true,
        resolvedCall: {
          name: resolution.resolvedTool,
          parameters: adaptParameters(name, resolution.resolvedTool, parameters),
        },
      }
    }

    // Tool could not be resolved
    log.warn("tool could not be resolved", { toolName: name })

    const errorMessage =
      resolution.fallbackSuggestion || `Tool '${name}' is not available and no suitable alternative was found.`

    return {
      success: false,
      errorMessage,
      alternatives: resolution.alternatives,
    }
  }

  /**
   * Adapt parameters when mapping between different tools
   */
  function adaptParameters(originalTool: string, resolvedTool: string, parameters: any): any {
    // Handle common parameter adaptations
    const adaptations: Record<string, Record<string, (params: any) => any>> = {
      // KB tool parameter adaptations
      kb_read: {
        "kb-mcp_kb_read": (params) => ({
          path: params.path || params.filePath || params.file,
        }),
      },
      kb_search: {
        "kb-mcp_kb_search": (params) => ({
          query: params.query || params.search || params.pattern,
          directory: params.directory || params.path,
        }),
      },
      kb_update: {
        "kb-mcp_kb_update": (params) => ({
          path: params.path || params.filePath || params.file,
          content: params.content || params.data,
        }),
      },
    }

    const adaptation = adaptations[originalTool]?.[resolvedTool]
    if (adaptation) {
      log.debug("adapting parameters", { originalTool, resolvedTool })
      return adaptation(parameters)
    }

    // No adaptation needed, return original parameters
    return parameters
  }

  /**
   * Create a user-friendly error message with suggestions
   */
  export function createErrorMessage(toolName: string, resolution: ToolResolver.ResolutionResult): string {
    let message = `The tool '${toolName}' is not available.`

    if (resolution.alternatives && resolution.alternatives.length > 0) {
      message += "\n\nI can achieve similar functionality using these alternatives:"
      resolution.alternatives.forEach((alt, index) => {
        message += `\n${index + 1}. ${alt.description} (using: ${alt.tools.join(", ")})`
      })
      message += "\n\nWould you like me to try one of these alternatives?"
    }

    if (resolution.fallbackSuggestion) {
      message += `\n\n${resolution.fallbackSuggestion}`
    }

    return message
  }

  /**
   * Execute an alternative strategy
   */
  export async function executeAlternative(
    alternative: { tools: string[]; description: string; strategy: string },
    originalParameters: any,
    toolExecutor: (toolName: string, params: any) => Promise<any>,
  ): Promise<any> {
    log.info("executing alternative strategy", {
      strategy: alternative.strategy,
      tools: alternative.tools,
    })

    switch (alternative.strategy) {
      case "choice":
        // Use the first available tool
        return await toolExecutor(alternative.tools[0], originalParameters)

      case "sequential":
        // Execute tools in sequence, passing results between them
        let result = originalParameters
        for (const tool of alternative.tools) {
          result = await toolExecutor(tool, result)
        }
        return result

      case "parallel":
        // Execute tools in parallel and combine results
        const results = await Promise.all(alternative.tools.map((tool) => toolExecutor(tool, originalParameters)))
        return combineResults(results)

      default:
        throw new Error(`Unknown strategy: ${alternative.strategy}`)
    }
  }

  /**
   * Combine results from parallel tool execution
   */
  function combineResults(results: any[]): any {
    // Simple combination strategy - can be enhanced based on needs
    if (results.length === 1) return results[0]

    return {
      combined: true,
      results: results,
      summary: `Combined results from ${results.length} tools`,
    }
  }

  /**
   * Get statistics about tool resolution attempts
   */
  export function getStats(): {
    totalInterceptions: number
    successfulResolutions: number
    failedResolutions: number
    mostRequestedMissingTools: Record<string, number>
  } {
    // This would be implemented with actual tracking in a real system
    return {
      totalInterceptions: 0,
      successfulResolutions: 0,
      failedResolutions: 0,
      mostRequestedMissingTools: {},
    }
  }
}
