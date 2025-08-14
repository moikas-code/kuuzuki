import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Permission } from "../src/permission";
import { ConfigSchema } from "../src/config/schema";

describe("OPENCODE_PERMISSION Environment Variable", () => {
  const originalEnv = process.env.OPENCODE_PERMISSION;

  afterEach(() => {
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.OPENCODE_PERMISSION = originalEnv;
    } else {
      delete process.env.OPENCODE_PERMISSION;
    }
  });

  test("should parse valid JSON permission configuration", () => {
    const permissionConfig = {
      bash: "ask" as const,
      edit: "allow" as const,
      write: "deny" as const,
      agents: {
        "test-agent": {
          bash: "allow" as const,
          edit: "ask" as const
        }
      }
    };

    process.env.OPENCODE_PERMISSION = JSON.stringify(permissionConfig);
    
    const result = Permission.getEnvironmentPermissions();
    expect(result).toEqual(permissionConfig);
  });

  test("should parse array format permission configuration", () => {
    const permissionConfig = ["rm *", "git push *", "npm install"];
    
    process.env.OPENCODE_PERMISSION = JSON.stringify(permissionConfig);
    
    const result = Permission.getEnvironmentPermissions();
    expect(result).toEqual(permissionConfig);
  });

  test("should handle malformed JSON gracefully", () => {
    process.env.OPENCODE_PERMISSION = '{ invalid json }';
    
    const result = Permission.getEnvironmentPermissions();
    expect(result).toBeNull();
  });

  test("should handle invalid permission structure", () => {
    process.env.OPENCODE_PERMISSION = JSON.stringify({
      invalidField: "invalid",
      bash: "invalid_value"
    });
    
    const result = Permission.getEnvironmentPermissions();
    expect(result).toBeNull();
  });

  test("should return null when environment variable is not set", () => {
    delete process.env.OPENCODE_PERMISSION;
    
    const result = Permission.getEnvironmentPermissions();
    expect(result).toBeNull();
  });

  test("should integrate with config schema parsing", () => {
    const permissionConfig = {
      bash: { "rm *": "ask" as const, "git *": "allow" as const },
      edit: "allow" as const,
      agents: {
        "bugfinder": {
          bash: "allow" as const,
          write: "deny" as const
        }
      }
    };

    process.env.OPENCODE_PERMISSION = JSON.stringify(permissionConfig);
    
    const envConfig = ConfigSchema.parseEnvironmentVariables();
    expect(envConfig.permission).toEqual(permissionConfig);
  });

  test("should prioritize environment over config", () => {
    const envPermissions = { bash: "deny", edit: "allow" };
    const configPermissions = { bash: "allow", edit: "ask" };

    process.env.OPENCODE_PERMISSION = JSON.stringify(envPermissions);

    const result = Permission.checkPermission({
      type: "bash",
      pattern: "ls -la",
      config: { permission: configPermissions }
    });

    expect(result).toBe("deny");
  });

  test("should handle agent-level permissions from environment", () => {
    const envPermissions = {
      bash: "ask",
      agents: {
        "test-agent": {
          bash: "allow"
        }
      }
    };

    process.env.OPENCODE_PERMISSION = JSON.stringify(envPermissions);

    const result = Permission.checkPermission({
      type: "bash",
      pattern: "ls -la",
      agentName: "test-agent"
    });

    expect(result).toBe("allow");
  });

  test("should handle complex pattern matching from environment", () => {
    const envPermissions = {
      bash: {
        "rm *": "ask",
        "git *": "allow",
        "*": "deny"
      }
    };

    process.env.OPENCODE_PERMISSION = JSON.stringify(envPermissions);

    // Test specific pattern match
    expect(Permission.checkPermission({
      type: "bash",
      pattern: "git status"
    })).toBe("allow");

    // Test ask pattern
    expect(Permission.checkPermission({
      type: "bash", 
      pattern: "rm file.txt"
    })).toBe("ask");

    // Test fallback to wildcard
    expect(Permission.checkPermission({
      type: "bash",
      pattern: "curl https://example.com"
    })).toBe("deny");
  });

  test("should validate tool name patterns from environment", () => {
    const envPermissions = {
      tools: {
        "bash*": "ask",
        "edit": "allow",
        "*": "deny"
      }
    };

    process.env.OPENCODE_PERMISSION = JSON.stringify(envPermissions);

    expect(Permission.checkPermission({
      type: "bash"
    })).toBe("ask");

    expect(Permission.checkPermission({
      type: "edit"
    })).toBe("allow");

    expect(Permission.checkPermission({
      type: "unknown-tool"
    })).toBe("deny");
  });

  test("should handle empty environment variable", () => {
    process.env.OPENCODE_PERMISSION = "";
    
    const result = Permission.getEnvironmentPermissions();
    expect(result).toBeNull();
  });

  test("should handle whitespace-only environment variable", () => {
    process.env.OPENCODE_PERMISSION = "   ";
    
    const result = Permission.getEnvironmentPermissions();
    expect(result).toBeNull();
  });
});