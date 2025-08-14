import { describe, test, expect, afterEach } from "bun:test";
import { Permission } from "../src/permission";
import { ConfigSchema } from "../src/config/schema";

describe("OPENCODE_PERMISSION Integration", () => {
  const originalEnv = process.env.OPENCODE_PERMISSION;

  afterEach(() => {
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.OPENCODE_PERMISSION = originalEnv;
    } else {
      delete process.env.OPENCODE_PERMISSION;
    }
  });

  test("should integrate environment permissions with config system", async () => {
    // Set environment permission that denies bash
    const envPermissions = {
      bash: "deny" as const,
      edit: "allow" as const
    };
    process.env.OPENCODE_PERMISSION = JSON.stringify(envPermissions);

    // Create a mock config that would normally allow bash
    const mockConfig = {
      permission: {
        bash: "allow" as const,
        edit: "ask" as const
      }
    };

    // Environment should override config
    const result = Permission.checkPermission({
      type: "bash",
      pattern: "ls -la",
      config: mockConfig
    });

    expect(result).toBe("deny");
  });

  test("should fall back to config when environment is not set", () => {
    delete process.env.OPENCODE_PERMISSION;

    const mockConfig = {
      permission: {
        bash: "ask" as const,
        edit: "allow" as const
      }
    };

    const result = Permission.checkPermission({
      type: "bash",
      pattern: "ls -la", 
      config: mockConfig
    });

    expect(result).toBe("ask");
  });

  test("should handle complex agent-level permissions from environment", () => {
    const envPermissions = {
      bash: "ask" as const,
      edit: "deny" as const,
      agents: {
        "test-agent": {
          bash: "allow" as const,
          edit: "allow" as const
        },
        "restricted-agent": {
          bash: "deny" as const,
          edit: "deny" as const
        }
      }
    };
    process.env.OPENCODE_PERMISSION = JSON.stringify(envPermissions);

    // Test agent-specific override
    expect(Permission.checkPermission({
      type: "bash",
      pattern: "git status",
      agentName: "test-agent"
    })).toBe("allow");

    // Test restricted agent
    expect(Permission.checkPermission({
      type: "bash", 
      pattern: "git status",
      agentName: "restricted-agent"
    })).toBe("deny");

    // Test fallback to global for unknown agent
    expect(Permission.checkPermission({
      type: "bash",
      pattern: "git status",
      agentName: "unknown-agent"
    })).toBe("ask");
  });

  test("should handle pattern-based permissions with priority", () => {
    const envPermissions = {
      bash: {
        "git status": "allow" as const,
        "git *": "ask" as const,
        "rm *": "deny" as const,
        "*": "ask" as const
      }
    };
    process.env.OPENCODE_PERMISSION = JSON.stringify(envPermissions);

    // Exact match should have highest priority
    expect(Permission.checkPermission({
      type: "bash",
      pattern: "git status"
    })).toBe("allow");

    // Pattern match should work
    expect(Permission.checkPermission({
      type: "bash",
      pattern: "git push origin main"
    })).toBe("ask");

    // Deny pattern should work
    expect(Permission.checkPermission({
      type: "bash",
      pattern: "rm -rf /"
    })).toBe("deny");

    // Fallback to wildcard
    expect(Permission.checkPermission({
      type: "bash",
      pattern: "curl https://example.com"
    })).toBe("ask");
  });

  test("should handle tool name patterns from environment", () => {
    const envPermissions = {
      tools: {
        "bash*": "ask" as const,
        "edit": "allow" as const,
        "*read*": "allow" as const,
        "*write*": "deny" as const,
        "*": "ask" as const
      }
    };
    process.env.OPENCODE_PERMISSION = JSON.stringify(envPermissions);

    // Tool name pattern matching
    expect(Permission.checkPermission({
      type: "bash"
    })).toBe("ask");

    expect(Permission.checkPermission({
      type: "bash-extended"
    })).toBe("ask");

    expect(Permission.checkPermission({
      type: "edit"
    })).toBe("allow");

    expect(Permission.checkPermission({
      type: "file-read"
    })).toBe("allow");

    expect(Permission.checkPermission({
      type: "file-write"
    })).toBe("deny");

    expect(Permission.checkPermission({
      type: "unknown-tool"
    })).toBe("ask");
  });

  test("should validate JSON schema integration", () => {
    const validPermissions = {
      bash: { "git *": "allow" as const },
      edit: "ask" as const,
      tools: { "*": "allow" as const },
      agents: {
        "test": {
          bash: "deny" as const
        }
      }
    };

    process.env.OPENCODE_PERMISSION = JSON.stringify(validPermissions);

    // Should parse successfully through config schema
    const envConfig = ConfigSchema.parseEnvironmentVariables();
    expect(envConfig.permission).toEqual(validPermissions);

    // Should validate through permission schema
    const permissions = Permission.getEnvironmentPermissions();
    expect(permissions).toEqual(validPermissions);
  });

  test("should handle malformed environment gracefully in integration", () => {
    // Set malformed JSON
    process.env.OPENCODE_PERMISSION = '{ invalid json }';

    // Should not crash and fall back to defaults
    const result = Permission.checkPermission({
      type: "bash",
      pattern: "ls -la"
    });

    expect(result).toBe("allow"); // Default behavior
  });

  test("should handle empty/whitespace environment variables", () => {
    // Test empty string
    process.env.OPENCODE_PERMISSION = "";
    expect(Permission.getEnvironmentPermissions()).toBeNull();

    // Test whitespace only
    process.env.OPENCODE_PERMISSION = "   \n\t  ";
    expect(Permission.getEnvironmentPermissions()).toBeNull();

    // Should fall back to default behavior
    const result = Permission.checkPermission({
      type: "bash",
      pattern: "ls -la"
    });
    expect(result).toBe("allow");
  });

  test("should handle mixed permission types correctly", () => {
    const envPermissions = {
      bash: {
        "git *": "allow" as const,
        "*": "ask" as const
      },
      edit: "allow" as const,
      write: "deny" as const,
      tools: {
        "dangerous-*": "deny" as const
      },
      agents: {
        "safe-agent": {
          bash: "allow" as const,
          tools: {
            "*": "allow" as const
          }
        }
      }
    };

    process.env.OPENCODE_PERMISSION = JSON.stringify(envPermissions);

    // Test bash pattern matching
    expect(Permission.checkPermission({
      type: "bash",
      pattern: "git status"
    })).toBe("allow");

    // Test direct tool permission
    expect(Permission.checkPermission({
      type: "edit"
    })).toBe("allow");

    expect(Permission.checkPermission({
      type: "write"
    })).toBe("deny");

    // Test tool name pattern
    expect(Permission.checkPermission({
      type: "dangerous-tool"
    })).toBe("deny");

    // Test agent override
    expect(Permission.checkPermission({
      type: "dangerous-tool",
      agentName: "safe-agent"
    })).toBe("allow");
  });
});