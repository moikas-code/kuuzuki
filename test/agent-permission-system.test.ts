import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Permission } from "../packages/kuuzuki/src/permission";
import { Wildcard } from "../packages/kuuzuki/src/util/wildcard";

describe("Agent-Level Permission System", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.OPENCODE_PERMISSION;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.OPENCODE_PERMISSION = originalEnv;
    } else {
      delete process.env.OPENCODE_PERMISSION;
    }
  });

  describe("Environment Variable Support", () => {
    test("should parse OPENCODE_PERMISSION environment variable", () => {
      const permissionConfig = {
        bash: "ask",
        edit: "allow",
        webfetch: "deny",
        agents: {
          "test-agent": {
            bash: "allow",
            edit: "deny"
          }
        }
      };

      process.env.OPENCODE_PERMISSION = JSON.stringify(permissionConfig);
      
      const envPermissions = Permission.getEnvironmentPermissions();
      expect(envPermissions).toEqual(permissionConfig);
    });

    test("should handle invalid OPENCODE_PERMISSION gracefully", () => {
      process.env.OPENCODE_PERMISSION = "invalid json";
      
      const envPermissions = Permission.getEnvironmentPermissions();
      expect(envPermissions).toBeNull();
    });

    test("should return null when OPENCODE_PERMISSION is not set", () => {
      delete process.env.OPENCODE_PERMISSION;
      
      const envPermissions = Permission.getEnvironmentPermissions();
      expect(envPermissions).toBeNull();
    });
  });

  describe("Agent-Level Permission Checking", () => {
    test("should use agent-specific permissions when available", () => {
      const config = {
        permission: {
          bash: "ask",
          edit: "deny",
          agents: {
            "test-agent": {
              bash: "allow",
              edit: "allow"
            }
          }
        }
      };

      // Agent-specific permission should override global
      const bashResult = Permission.checkPermission({
        type: "bash",
        pattern: "ls -la",
        agentName: "test-agent",
        config
      });
      expect(bashResult).toBe("allow");

      const editResult = Permission.checkPermission({
        type: "edit",
        pattern: "test.ts",
        agentName: "test-agent",
        config
      });
      expect(editResult).toBe("allow");
    });

    test("should fall back to global permissions when agent-specific not available", () => {
      const config = {
        permission: {
          bash: "deny",
          edit: "allow",
          agents: {
            "other-agent": {
              bash: "allow"
            }
          }
        }
      };

      // Should use global permission for unknown agent
      const bashResult = Permission.checkPermission({
        type: "bash",
        pattern: "ls -la",
        agentName: "test-agent",
        config
      });
      expect(bashResult).toBe("deny");

      const editResult = Permission.checkPermission({
        type: "edit",
        pattern: "test.ts",
        agentName: "test-agent",
        config
      });
      expect(editResult).toBe("allow");
    });

    test("should handle pattern-based bash permissions for agents", () => {
      const config = {
        permission: {
          bash: "ask",
          agents: {
            "test-agent": {
              bash: {
                "git *": "allow",
                "rm *": "deny",
                "ls *": "allow"
              }
            }
          }
        }
      };

      // Test pattern matching for agent
      const gitResult = Permission.checkPermission({
        type: "bash",
        pattern: "git status",
        agentName: "test-agent",
        config
      });
      expect(gitResult).toBe("allow");

      const rmResult = Permission.checkPermission({
        type: "bash",
        pattern: "rm file.txt",
        agentName: "test-agent",
        config
      });
      expect(rmResult).toBe("deny");

      const lsResult = Permission.checkPermission({
        type: "bash",
        pattern: "ls -la",
        agentName: "test-agent",
        config
      });
      expect(lsResult).toBe("allow");

      // Unknown pattern should fall back to ask
      const unknownResult = Permission.checkPermission({
        type: "bash",
        pattern: "echo hello",
        agentName: "test-agent",
        config
      });
      expect(unknownResult).toBe("ask");
    });
  });

  describe("Environment Variable Priority", () => {
    test("should prioritize environment variable over config", () => {
      const envConfig = {
        bash: "allow",
        edit: "deny"
      };
      process.env.OPENCODE_PERMISSION = JSON.stringify(envConfig);

      const config = {
        permission: {
          bash: "deny",
          edit: "allow"
        }
      };

      const bashResult = Permission.checkPermission({
        type: "bash",
        pattern: "ls -la",
        config,
        envPermissions: Permission.getEnvironmentPermissions()
      });
      expect(bashResult).toBe("allow");

      const editResult = Permission.checkPermission({
        type: "edit",
        pattern: "test.ts",
        config,
        envPermissions: Permission.getEnvironmentPermissions()
      });
      expect(editResult).toBe("deny");
    });

    test("should support agent-level permissions in environment variable", () => {
      const envConfig = {
        bash: "ask",
        agents: {
          "env-agent": {
            bash: "allow",
            edit: "deny"
          }
        }
      };
      process.env.OPENCODE_PERMISSION = JSON.stringify(envConfig);

      const config = {
        permission: {
          bash: "deny",
          edit: "allow"
        }
      };

      const bashResult = Permission.checkPermission({
        type: "bash",
        pattern: "ls -la",
        agentName: "env-agent",
        config,
        envPermissions: Permission.getEnvironmentPermissions()
      });
      expect(bashResult).toBe("allow");

      const editResult = Permission.checkPermission({
        type: "edit",
        pattern: "test.ts",
        agentName: "env-agent",
        config,
        envPermissions: Permission.getEnvironmentPermissions()
      });
      expect(editResult).toBe("deny");
    });
  });

  describe("Backward Compatibility", () => {
    test("should support kuuzuki array format", () => {
      const config = {
        permission: ["git *", "npm *", "ls *"]
      };

      // Should ask for patterns in array
      const gitResult = Permission.checkPermission({
        type: "bash",
        pattern: "git status",
        config
      });
      expect(gitResult).toBe("ask");

      // Should allow for patterns not in array
      const rmResult = Permission.checkPermission({
        type: "bash",
        pattern: "rm file.txt",
        config
      });
      expect(rmResult).toBe("allow");
    });

    test("should default to allow when no permissions configured", () => {
      const config = {};

      const bashResult = Permission.checkPermission({
        type: "bash",
        pattern: "ls -la",
        config
      });
      expect(bashResult).toBe("allow");

      const editResult = Permission.checkPermission({
        type: "edit",
        pattern: "test.ts",
        config
      });
      expect(editResult).toBe("allow");
    });
  });

  describe("Wildcard Pattern Matching", () => {
    test("should support OpenCode-style pattern matching", () => {
      // Test exact match
      expect(Wildcard.matchOpenCode("git status", "git status")).toBe(true);
      
      // Test wildcard match
      expect(Wildcard.matchOpenCode("git status", "git *")).toBe(true);
      expect(Wildcard.matchOpenCode("git push origin main", "git *")).toBe(true);
      
      // Test implicit wildcard for subcommands
      expect(Wildcard.matchOpenCode("git push origin main", "git push")).toBe(true);
      expect(Wildcard.matchOpenCode("npm install package", "npm install")).toBe(true);
      
      // Test non-matches
      expect(Wildcard.matchOpenCode("ls -la", "git *")).toBe(false);
      expect(Wildcard.matchOpenCode("git status", "npm *")).toBe(false);
    });

    test("should handle complex patterns", () => {
      expect(Wildcard.matchOpenCode("rm -rf /tmp/test", "rm -rf *")).toBe(true);
      expect(Wildcard.matchOpenCode("curl https://api.example.com", "curl *")).toBe(true);
      expect(Wildcard.matchOpenCode("docker run nginx", "docker *")).toBe(true);
    });

    test("should support universal wildcards", () => {
      expect(Wildcard.matchOpenCode("any command", "*")).toBe(true);
      expect(Wildcard.matchOpenCode("any command", "**")).toBe(true);
    });
  });

  describe("Integration with Tools", () => {
    test("should provide correct permission context to tools", () => {
      const config = {
        permission: {
          bash: {
            "git *": "allow",
            "rm *": "deny"
          },
          edit: "ask",
          agents: {
            "test-agent": {
              edit: "allow"
            }
          }
        }
      };

      // Test bash tool with pattern-based permissions
      const bashAllowResult = Permission.checkPermission({
        type: "bash",
        pattern: "git status",
        config
      });
      expect(bashAllowResult).toBe("allow");

      const bashDenyResult = Permission.checkPermission({
        type: "bash",
        pattern: "rm file.txt",
        config
      });
      expect(bashDenyResult).toBe("deny");

      // Test edit tool with agent-specific permissions
      const editGlobalResult = Permission.checkPermission({
        type: "edit",
        pattern: "test.ts",
        config
      });
      expect(editGlobalResult).toBe("ask");

      const editAgentResult = Permission.checkPermission({
        type: "edit",
        pattern: "test.ts",
        agentName: "test-agent",
        config
      });
      expect(editAgentResult).toBe("allow");
    });
  });

  describe("Security Features", () => {
    test("should default to ask for unknown patterns in pattern-based permissions", () => {
      const config = {
        permission: {
          bash: {
            "git *": "allow",
            "npm *": "allow"
          }
        }
      };

      const unknownResult = Permission.checkPermission({
        type: "bash",
        pattern: "rm -rf /",
        config
      });
      expect(unknownResult).toBe("ask");
    });

    test("should handle malformed permission configurations gracefully", () => {
      const config = {
        permission: {
          bash: null, // Invalid value
          edit: "invalid", // Invalid enum value
        }
      };

      // Should default to allow for malformed config
      const bashResult = Permission.checkPermission({
        type: "bash",
        pattern: "ls -la",
        config
      });
      expect(bashResult).toBe("allow");

      const editResult = Permission.checkPermission({
        type: "edit",
        pattern: "test.ts",
        config
      });
      expect(editResult).toBe("allow");
    });
  });
});