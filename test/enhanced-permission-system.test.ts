import { describe, test, expect } from "bun:test";
import { Permission } from "../packages/kuuzuki/src/permission";

describe("Enhanced Permission System with Wildcard Patterns", () => {
  describe("Pattern-based bash permissions", () => {
    test("should use priority matching for bash patterns", () => {
      const config = {
        permission: {
          bash: {
            "rm *": "ask",
            "rm -rf *": "deny",
            "rm -rf /tmp/*": "allow",
            "*": "allow"
          }
        }
      };

      // Most specific pattern should win
      const result1 = Permission.checkPermission({
        type: "bash",
        pattern: "rm -rf /tmp/test",
        config
      });
      expect(result1).toBe("allow");

      // Less specific pattern
      const result2 = Permission.checkPermission({
        type: "bash", 
        pattern: "rm -rf /home/user",
        config
      });
      expect(result2).toBe("deny");

      // General rm command
      const result3 = Permission.checkPermission({
        type: "bash",
        pattern: "rm file.txt",
        config
      });
      expect(result3).toBe("ask");
    });

    test("should handle tool name patterns", () => {
      const config = {
        permission: {
          tools: {
            "bash*": "ask",
            "edit": "allow",
            "*": "deny"
          }
        }
      };

      const result1 = Permission.checkPermission({
        type: "bash",
        config
      });
      expect(result1).toBe("ask");

      const result2 = Permission.checkPermission({
        type: "edit",
        config
      });
      expect(result2).toBe("allow");

      const result3 = Permission.checkPermission({
        type: "read",
        config
      });
      expect(result3).toBe("deny");
    });

    test("should prioritize agent-specific permissions", () => {
      const config = {
        permission: {
          bash: "deny",
          tools: {
            "*": "deny"
          },
          agents: {
            "trusted-agent": {
              bash: {
                "git *": "allow",
                "*": "ask"
              },
              tools: {
                "*": "allow"
              }
            }
          }
        }
      };

      // Agent-specific permission should override global
      const result1 = Permission.checkPermission({
        type: "bash",
        pattern: "git status",
        agentName: "trusted-agent",
        config
      });
      expect(result1).toBe("allow");

      // Agent-specific tool permission
      const result2 = Permission.checkPermission({
        type: "edit",
        agentName: "trusted-agent",
        config
      });
      expect(result2).toBe("allow");

      // Non-trusted agent uses global permissions
      const result3 = Permission.checkPermission({
        type: "bash",
        pattern: "git status",
        agentName: "untrusted-agent",
        config
      });
      expect(result3).toBe("deny");
    });
  });

  describe("Advanced pattern configuration", () => {
    test("should handle complex permission hierarchies", () => {
      const config = {
        permission: {
          bash: {
            "git push origin main": "allow",
            "git push *": "ask", 
            "git *": "allow",
            "*": "deny"
          },
          tools: {
            "git*": "allow",
            "bash": "ask",
            "*": "deny"
          }
        }
      };

      // Exact match should have highest priority
      const result1 = Permission.checkPermission({
        type: "bash",
        pattern: "git push origin main",
        config
      });
      expect(result1).toBe("allow");

      // Partial match
      const result2 = Permission.checkPermission({
        type: "bash",
        pattern: "git push feature-branch",
        config
      });
      expect(result2).toBe("ask");

      // General git command
      const result3 = Permission.checkPermission({
        type: "bash",
        pattern: "git status",
        config
      });
      expect(result3).toBe("allow");

      // Non-git command
      const result4 = Permission.checkPermission({
        type: "bash",
        pattern: "ls -la",
        config
      });
      expect(result4).toBe("deny");
    });

    test("should handle environment variable permissions", () => {
      const envPermissions = {
        bash: {
          "npm *": "allow" as const,
          "*": "ask" as const
        }
      };

      const config = {
        permission: {
          bash: "deny" as const // Should be overridden by env
        }
      };

      const result = Permission.checkPermission({
        type: "bash",
        pattern: "npm install",
        config,
        envPermissions
      });
      expect(result).toBe("allow");
    });
  });

  describe("Backward compatibility", () => {
    test("should handle simple array format", () => {
      const config = {
        permission: ["rm *", "git push *"]
      };

      const result1 = Permission.checkPermission({
        type: "bash",
        pattern: "rm file.txt",
        config
      });
      expect(result1).toBe("ask");

      const result2 = Permission.checkPermission({
        type: "bash",
        pattern: "ls -la",
        config
      });
      expect(result2).toBe("allow");
    });

    test("should handle OpenCode-style patterns", () => {
      const config = {
        permission: {
          bash: {
            "git push": "ask", // Should match "git push origin main"
            "*": "allow"
          }
        }
      };

      // OpenCode compatibility: "git push" should match subcommands
      const result = Permission.checkPermission({
        type: "bash",
        pattern: "git push origin main",
        config
      });
      expect(result).toBe("ask");
    });
  });

  describe("Performance and edge cases", () => {
    test("should handle large permission sets efficiently", () => {
      const bashPatterns: Record<string, "ask" | "allow" | "deny"> = {};
      for (let i = 0; i < 1000; i++) {
        bashPatterns[`command${i} *`] = "ask";
      }
      bashPatterns["test *"] = "allow";

      const config = {
        permission: {
          bash: bashPatterns
        }
      };

      const start = Date.now();
      const result = Permission.checkPermission({
        type: "bash",
        pattern: "test command",
        config
      });
      const duration = Date.now() - start;

      expect(result).toBe("allow");
      expect(duration).toBeLessThan(50); // Should be fast
    });

    test("should handle malformed patterns gracefully", () => {
      const config = {
        permission: {
          bash: {
            "[invalid regex": "ask",
            "valid *": "allow"
          }
        }
      };

      // Should not crash on invalid regex
      const result = Permission.checkPermission({
        type: "bash",
        pattern: "valid command",
        config
      });
      expect(result).toBe("allow");
    });

    test("should handle empty configurations", () => {
      const result1 = Permission.checkPermission({
        type: "bash",
        pattern: "any command",
        config: {}
      });
      expect(result1).toBe("allow");

      const result2 = Permission.checkPermission({
        type: "bash",
        pattern: "any command",
        config: { permission: {} }
      });
      expect(result2).toBe("allow");
    });
  });
});