/**
 * Test script for the tool fallback system - Internal Test Utility
 *
 * This can be run to verify the fallback system works correctly.
 * It's a test script for internal development and debugging.
 *
 * This is an internal test utility and does not need a .txt description file
 * because it's not a user-facing tool registered in the ToolRegistry.
 */

import { ToolResolver } from "./resolver"
import { ToolInterceptor } from "./interceptor"
import { ToolCompatibilityMatrix } from "./compatibility-matrix"
import { ToolAnalytics } from "./analytics"

export namespace ToolFallbackTest {
  /**
   * Run comprehensive tests of the fallback system
   */
  export function runTests() {
    console.log("🧪 Testing Tool Fallback System\n")

    // Reset analytics for clean test
    ToolAnalytics.reset()

    // Simulate available tools (typical kuuzuki setup)
    const availableTools = new Set([
      "bash",
      "edit",
      "read",
      "write",
      "grep",
      "glob",
      "list",
      "memory",
      "todowrite",
      "todoread",
      "task",
      "webfetch",
      "kb-mcp_kb_read",
      "kb-mcp_kb_search",
      "kb-mcp_kb_update",
      "fork-parity_fork_parity_get_detailed_status",
    ])

    console.log(`📋 Available tools: ${Array.from(availableTools).join(", ")}\n`)

    // Test cases
    const testCases = [
      // Direct matches (should succeed)
      { tool: "bash", expected: "success" },
      { tool: "read", expected: "success" },

      // Exact mappings (should succeed)
      { tool: "kb_read", expected: "success" },
      { tool: "kb_search", expected: "success" },

      // Functional alternatives (should provide alternatives)
      { tool: "kb_status", expected: "alternatives" },
      { tool: "analyze_codebase", expected: "alternatives" },

      // No alternatives (should fail gracefully)
      { tool: "nonexistent_tool", expected: "fail" },
      { tool: "some_random_tool", expected: "fail" },
    ]

    let passed = 0
    let failed = 0

    for (const testCase of testCases) {
      console.log(`🔍 Testing: ${testCase.tool}`)

      try {
        // Test resolver
        const resolution = ToolResolver.resolve(testCase.tool, availableTools)

        // Test interceptor
        const interception = ToolInterceptor.intercept({ name: testCase.tool, parameters: {} }, availableTools)

        // Check results
        let testPassed = false

        switch (testCase.expected) {
          case "success":
            testPassed = resolution.success && interception.success
            break
          case "alternatives":
            testPassed = !resolution.success && resolution.alternatives && resolution.alternatives.length > 0
            break
          case "fail":
            testPassed = !resolution.success && !interception.success
            break
        }

        if (testPassed) {
          console.log(`  ✅ PASS`)
          if (resolution.success) {
            console.log(`     Resolved to: ${resolution.resolvedTool}`)
          } else if (resolution.alternatives) {
            console.log(`     Found ${resolution.alternatives.length} alternatives`)
          }
          passed++
        } else {
          console.log(`  ❌ FAIL`)
          console.log(`     Expected: ${testCase.expected}`)
          console.log(
            `     Got: resolution.success=${resolution.success}, alternatives=${resolution.alternatives?.length || 0}`,
          )
          failed++
        }
      } catch (error) {
        console.log(`  💥 ERROR: ${error}`)
        failed++
      }

      console.log()
    }

    // Test compatibility matrix
    console.log("🔧 Testing Compatibility Matrix")
    const kbReadAlternatives = ToolCompatibilityMatrix.getAlternatives("kb_read")
    console.log(
      `  kb_read alternatives: ${kbReadAlternatives.exact.length} exact, ${kbReadAlternatives.functional.length} functional`,
    )

    const bestAlt = ToolCompatibilityMatrix.getBestAlternative("kb_read", availableTools)
    console.log(`  Best alternative for kb_read: ${bestAlt.type} (confidence: ${bestAlt.confidence})`)

    const explanation = ToolCompatibilityMatrix.explainAlternatives("kb_read", availableTools)
    console.log(`  Explanation length: ${explanation.length} characters`)
    console.log()

    // Test analytics
    console.log("📊 Testing Analytics")
    const stats = ToolAnalytics.getStats()
    console.log(`  Total interceptions: ${stats.totalInterceptions}`)
    console.log(`  Successful resolutions: ${stats.successfulResolutions}`)
    console.log(`  Failed resolutions: ${stats.failedResolutions}`)

    const report = ToolAnalytics.getReport()
    console.log(`  Recommendations: ${report.recommendations.length}`)
    console.log()

    // Summary
    console.log("📈 Test Summary")
    console.log(`  Passed: ${passed}`)
    console.log(`  Failed: ${failed}`)
    console.log(`  Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`)

    if (failed === 0) {
      console.log("  🎉 All tests passed!")
    } else {
      console.log("  ⚠️  Some tests failed. Check implementation.")
    }

    return { passed, failed, successRate: passed / (passed + failed) }
  }

  /**
   * Test specific tool resolution
   */
  export function testTool(toolName: string, availableTools: string[]) {
    const toolSet = new Set(availableTools)

    console.log(`🔍 Testing tool: ${toolName}`)
    console.log(`📋 Available tools: ${availableTools.join(", ")}`)
    console.log()

    // Test resolution
    const resolution = ToolResolver.resolve(toolName, toolSet)
    console.log("🔧 Resolution Result:")
    console.log(`  Success: ${resolution.success}`)
    if (resolution.resolvedTool) {
      console.log(`  Resolved to: ${resolution.resolvedTool}`)
    }
    if (resolution.alternatives) {
      console.log(`  Alternatives: ${resolution.alternatives.length}`)
      resolution.alternatives.forEach((alt, i) => {
        console.log(`    ${i + 1}. ${alt.description} (${alt.tools.join(", ")})`)
      })
    }
    if (resolution.fallbackSuggestion) {
      console.log(`  Suggestion: ${resolution.fallbackSuggestion.substring(0, 100)}...`)
    }
    console.log()

    // Test interception
    const interception = ToolInterceptor.intercept({ name: toolName, parameters: {} }, toolSet)
    console.log("🛡️  Interception Result:")
    console.log(`  Success: ${interception.success}`)
    if (interception.resolvedCall) {
      console.log(`  Resolved call: ${interception.resolvedCall.name}`)
    }
    if (interception.errorMessage) {
      console.log(`  Error: ${interception.errorMessage.substring(0, 100)}...`)
    }
    console.log()

    // Test compatibility matrix
    const alternatives = ToolCompatibilityMatrix.getAlternatives(toolName)
    console.log("🔗 Compatibility Matrix:")
    console.log(`  Exact: ${alternatives.exact.length}`)
    console.log(`  Functional: ${alternatives.functional.length}`)
    console.log(`  Composite: ${alternatives.composite.length}`)
    console.log(`  Partial: ${alternatives.partial.length}`)

    const bestAlt = ToolCompatibilityMatrix.getBestAlternative(toolName, toolSet)
    console.log(`  Best alternative: ${bestAlt.type} (confidence: ${bestAlt.confidence})`)
  }
}

// ToolFallbackTest is already exported above
