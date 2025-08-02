#!/usr/bin/env bun

/**
 * Test runner for the tool fallback system
 */

import { ToolFallbackTest } from "../packages/kuuzuki/src/tool/test-fallback"

async function main() {
  console.log("🚀 Starting Tool Fallback System Tests\n")

  try {
    // Run comprehensive tests
    const results = ToolFallbackTest.runTests()

    console.log("\n" + "=".repeat(50))
    console.log("🏁 Test Execution Complete")
    console.log("=".repeat(50))

    if (results.successRate === 1) {
      console.log("🎉 All tests passed! The fallback system is working correctly.")
      process.exit(0)
    } else {
      console.log(`⚠️  ${results.failed} tests failed. Please review the implementation.`)
      process.exit(1)
    }
  } catch (error) {
    console.error("💥 Test execution failed:", error)
    process.exit(1)
  }
}

// Run specific tool test if provided as argument
if (process.argv[2] === "test-tool" && process.argv[3]) {
  const toolName = process.argv[3]
  const availableTools = [
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
  ]

  console.log(`🔍 Testing specific tool: ${toolName}\n`)
  ToolFallbackTest.testTool(toolName, availableTools)
} else {
  main()
}
