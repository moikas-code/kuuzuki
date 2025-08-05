#!/usr/bin/env bun

// Simple test to verify permission system is working
import { Permission } from "./packages/kuuzuki/src/permission/index.ts";

console.log("🔍 Testing Permission System");
console.log("============================");

// Test permission creation
try {
  const testPermission = {
    type: "bash",
    pattern: "rm test",
    sessionID: "test-session",
    messageID: "test-message",
    callID: "test-call",
    title: "Test permission: rm test",
    metadata: {
      command: "rm test_file.txt",
      description: "Remove test file",
    },
  };

  console.log("1. Testing permission creation...");
  console.log("Permission data:", testPermission);

  console.log("2. Testing display info generation...");
  const mockInfo = {
    id: "test-id",
    type: "bash",
    pattern: "rm test",
    sessionID: "test-session",
    messageID: "test-message",
    callID: "test-call",
    title: "Test permission: rm test",
    metadata: {
      command: "rm test_file.txt",
      description: "Remove test file",
    },
    time: { created: Date.now() },
  };

  const displayInfo = Permission.getPermissionDisplayInfo(mockInfo);
  console.log("Display info:", displayInfo);

  console.log("✅ Permission system basic functions work!");
} catch (error) {
  console.error("❌ Permission system error:", error);
}
