#!/usr/bin/env bun

/**
 * Test script for agent-level permission system
 * Tests the new OpenCode v0.4.3-v0.4.45 compatible permission features
 */

import { Permission } from "./packages/kuuzuki/src/permission";
import { Wildcard } from "./packages/kuuzuki/src/util/wildcard";

// Test environment variable permission configuration
process.env.OPENCODE_PERMISSION = JSON.stringify({
  bash: {
    "git *": "allow",
    "rm *": "ask",
    "*": "deny"
  },
  edit: "ask",
  webfetch: "deny",
  agents: {
    "bugfinder": {
      bash: "allow",
      edit: "allow"
    },
    "documentation": {
      edit: "allow",
      webfetch: "ask"
    }
  }
});

async function testPermissionSystem() {
  console.log("🧪 Testing Agent-Level Permission System");
  console.log("=" .repeat(50));

  // Test 1: Environment variable loading
  console.log("\n1. Testing OPENCODE_PERMISSION environment variable");
  const envPerms = Permission.getEnvironmentPermissions();
  console.log("Environment permissions loaded:", envPerms ? "✅" : "❌");

  // Test 2: Global permission checking
  console.log("\n2. Testing global permission checking");
  
  const testCases = [
    {
      type: "bash",
      pattern: "git status",
      expected: "allow",
      description: "Git command should be allowed"
    },
    {
      type: "bash", 
      pattern: "rm -rf /",
      expected: "ask",
      description: "Dangerous rm command should ask"
    },
    {
      type: "bash",
      pattern: "ls -la",
      expected: "deny", 
      description: "Other commands should be denied by default"
    },
    {
      type: "edit",
      pattern: "test.txt",
      expected: "ask",
      description: "Edit operations should ask"
    },
    {
      type: "webfetch",
      pattern: "https://example.com",
      expected: "deny",
      description: "Web fetch should be denied"
    }
  ];

  for (const testCase of testCases) {
    const result = Permission.checkPermission({
      type: testCase.type,
      pattern: testCase.pattern,
      envPermissions: envPerms
    });
    
    const passed = result === testCase.expected;
    console.log(`  ${passed ? "✅" : "❌"} ${testCase.description}: ${result} (expected: ${testCase.expected})`);
  }

  // Test 3: Agent-specific permission overrides
  console.log("\n3. Testing agent-specific permission overrides");
  
  const agentTestCases = [
    {
      type: "bash",
      pattern: "ls -la", 
      agentName: "bugfinder",
      expected: "allow",
      description: "Bugfinder agent should have bash access"
    },
    {
      type: "edit",
      pattern: "config.json",
      agentName: "bugfinder", 
      expected: "allow",
      description: "Bugfinder agent should have edit access"
    },
    {
      type: "webfetch",
      pattern: "https://docs.example.com",
      agentName: "documentation",
      expected: "ask",
      description: "Documentation agent should ask for webfetch"
    },
    {
      type: "webfetch",
      pattern: "https://malicious.com",
      agentName: "unknown-agent",
      expected: "deny",
      description: "Unknown agent should be denied webfetch"
    }
  ];

  for (const testCase of agentTestCases) {
    const result = Permission.checkPermission({
      type: testCase.type,
      pattern: testCase.pattern,
      agentName: testCase.agentName,
      envPermissions: envPerms
    });
    
    const passed = result === testCase.expected;
    console.log(`  ${passed ? "✅" : "❌"} ${testCase.description}: ${result} (expected: ${testCase.expected})`);
  }

  // Test 4: Wildcard pattern matching
  console.log("\n4. Testing enhanced wildcard pattern matching");
  
  const wildcardTests = [
    {
      pattern: "git *",
      text: "git push origin main",
      expected: true,
      description: "Git subcommand matching"
    },
    {
      pattern: "rm *",
      text: "rm -rf directory",
      expected: true,
      description: "RM command with flags"
    },
    {
      pattern: "npm *",
      text: "npm install package",
      expected: true,
      description: "NPM command matching"
    }
  ];

  for (const test of wildcardTests) {
    const result = Wildcard.matchOpenCode(test.text, test.pattern);
    const passed = result === test.expected;
    console.log(`  ${passed ? "✅" : "❌"} ${test.description}: ${result} (expected: ${test.expected})`);
  }

  console.log("\n🎉 Agent-level permission system testing complete!");
}

// Run tests if this file is executed directly
if (import.meta.main) {
  testPermissionSystem().catch(console.error);
}

export { testPermissionSystem };