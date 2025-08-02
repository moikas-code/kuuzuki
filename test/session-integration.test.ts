#!/usr/bin/env bun

/**
 * Test the session integration of the tool fallback system
 */

import { ToolInterceptor } from "../packages/kuuzuki/src/tool/interceptor"
import { ToolAnalytics } from "../packages/kuuzuki/src/tool/analytics"

async function testSessionIntegration() {
  console.log("🔧 Testing Session Integration\n")

  // Reset analytics
  ToolAnalytics.reset()

  // Simulate available tools in a typical kuuzuki session
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
    "kb-mcp_kb_create",
    "fork-parity_fork_parity_get_detailed_status",
  ])

  console.log(`📋 Available tools: ${Array.from(availableTools).join(", ")}\n`)

  // Test scenarios that would previously cause AI_NoSuchToolError
  const testScenarios = [
    {
      name: "Knowledge Base Read",
      toolCall: { name: "kb_read", parameters: { path: "docs/README.md" } },
      expectedSuccess: true,
    },
    {
      name: "Knowledge Base Search",
      toolCall: { name: "kb_search", parameters: { query: "implementation" } },
      expectedSuccess: true,
    },
    {
      name: "Knowledge Base Status",
      toolCall: { name: "kb_status", parameters: {} },
      expectedSuccess: false, // Should provide alternatives
      expectAlternatives: true,
    },
    {
      name: "Code Analysis",
      toolCall: { name: "analyze_codebase", parameters: { path: "./src" } },
      expectedSuccess: false,
      expectAlternatives: true,
    },
    {
      name: "Development Tool",
      toolCall: { name: "moidvk_format_code", parameters: { language: "typescript" } },
      expectedSuccess: false,
      expectAlternatives: false, // No moidvk tools available
    },
  ]

  let passed = 0
  let failed = 0

  for (const scenario of testScenarios) {
    console.log(`🧪 Testing: ${scenario.name}`)
    console.log(`   Tool: ${scenario.toolCall.name}`)

    try {
      const result = ToolInterceptor.intercept(scenario.toolCall, availableTools)

      let testPassed = false

      if (scenario.expectedSuccess) {
        testPassed = result.success && result.resolvedCall !== undefined
        if (testPassed) {
          console.log(`   ✅ PASS - Resolved to: ${result.resolvedCall?.name}`)
        } else {
          console.log(`   ❌ FAIL - Expected success but got failure`)
        }
      } else {
        testPassed = !result.success
        if (scenario.expectAlternatives) {
          testPassed = testPassed && !!(result.alternatives && result.alternatives.length > 0)
          if (testPassed) {
            console.log(`   ✅ PASS - Found ${result.alternatives?.length} alternatives`)
          } else {
            console.log(`   ❌ FAIL - Expected alternatives but found none`)
          }
        } else {
          if (testPassed) {
            console.log(`   ✅ PASS - Correctly failed with helpful message`)
          } else {
            console.log(`   ❌ FAIL - Expected failure but got success`)
          }
        }
      }

      if (testPassed) {
        passed++
      } else {
        failed++
      }
    } catch (error) {
      console.log(`   💥 ERROR: ${error}`)
      failed++
    }

    console.log()
  }

  // Test analytics
  console.log("📊 Analytics Report:")
  const report = ToolAnalytics.getReport()
  console.log(`   Total Interceptions: ${report.summary.totalInterceptions}`)
  console.log(`   Success Rate: ${report.summary.successRate}%`)
  console.log(
    `   Top Missing Tools: ${report.topMissingTools
      .slice(0, 3)
      .map((t) => t.tool)
      .join(", ")}`,
  )
  console.log(`   Recommendations: ${report.recommendations.length}`)
  console.log()

  // Summary
  console.log("📈 Integration Test Summary")
  console.log(`   Passed: ${passed}`)
  console.log(`   Failed: ${failed}`)
  console.log(`   Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`)

  if (failed === 0) {
    console.log("   🎉 All integration tests passed!")
    console.log("   ✨ The fallback system is ready for production!")
    return true
  } else {
    console.log("   ⚠️  Some integration tests failed.")
    return false
  }
}

// Run the test
testSessionIntegration()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch((error) => {
    console.error("💥 Integration test failed:", error)
    process.exit(1)
  })
