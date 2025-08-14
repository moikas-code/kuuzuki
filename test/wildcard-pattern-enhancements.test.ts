import { describe, test, expect } from "bun:test";
import { Wildcard } from "../packages/kuuzuki/src/util/wildcard";
import { ToolRegistry } from "../packages/kuuzuki/src/tool/registry";
import { Permission } from "../packages/kuuzuki/src/permission";

describe("Enhanced Wildcard Pattern Matching", () => {
  describe("Wildcard.all() function", () => {
    test("should return matches ordered by priority", () => {
      const patterns = ["git *", "git push *", "*"];
      const text = "git push origin main";
      
      const results = Wildcard.all(patterns, text);
      
      expect(results).toHaveLength(3);
      // Most specific match should be first
      expect(results[0].pattern).toBe("git push *");
      expect(results[0].priority).toBeGreaterThan(results[1].priority);
    });

    test("should calculate priority correctly", () => {
      const patterns = ["*", "git *", "git push *"];
      const text = "git push origin main";
      
      const results = Wildcard.all(patterns, text);
      
      // More specific patterns should have higher priority
      const priorities = results.map(r => r.priority);
      expect(priorities[0]).toBeGreaterThan(priorities[1]);
      expect(priorities[1]).toBeGreaterThan(priorities[2]);
    });

    test("should handle exact matches with highest priority", () => {
      const patterns = ["git push", "git *", "*"];
      const text = "git push";
      
      const results = Wildcard.all(patterns, text);
      
      expect(results[0].pattern).toBe("git push");
      expect(results[0].priority).toBe(1000); // Exact match priority
    });

    test("should calculate specificity correctly", () => {
      const patterns = ["git push *", "git * origin", "* push *"];
      const text = "git push origin";
      
      const results = Wildcard.all(patterns, text);
      
      // Patterns with more literal characters should be more specific
      expect(results[0].specificity).toBeGreaterThan(results[1].specificity);
    });
  });

  describe("Enhanced command pattern matching", () => {
    test("should match commands with priority", () => {
      const patterns = ["rm *", "rm -rf *", "rm -rf /tmp/*"];
      const command = "rm -rf /tmp/test";
      
      const result = Wildcard.matchCommand(command, patterns);
      
      expect(result).not.toBeNull();
      expect(result!.pattern).toBe("rm -rf /tmp/*"); // Most specific match
    });

    test("should return null for no matches", () => {
      const patterns = ["git *", "npm *"];
      const command = "ls -la";
      
      const result = Wildcard.matchCommand(command, patterns);
      
      expect(result).toBeNull();
    });
  });

  describe("Tool name pattern matching", () => {
    test("should match tool names with wildcards", () => {
      const patterns = ["*", "bash*", "edit"];
      
      expect(Wildcard.matchToolName("bash", patterns)).toBe("bash*");
      expect(Wildcard.matchToolName("edit", patterns)).toBe("edit");
      expect(Wildcard.matchToolName("read", patterns)).toBe("*");
    });

    test("should return most specific match", () => {
      const patterns = ["*", "ba*", "bash"];
      
      expect(Wildcard.matchToolName("bash", patterns)).toBe("bash");
    });

    test("should return null for no matches", () => {
      const patterns = ["git*", "npm*"];
      
      expect(Wildcard.matchToolName("bash", patterns)).toBeNull();
    });
  });

  describe("OpenCode compatibility", () => {
    test("should maintain OpenCode parameter order", () => {
      expect(Wildcard.matchOpenCode("git push", "git *")).toBe(true);
      expect(Wildcard.matchOpenCode("git status", "git *")).toBe(true);
      expect(Wildcard.matchOpenCode("npm install", "git *")).toBe(false);
    });

    test("should handle implicit wildcards for commands", () => {
      expect(Wildcard.matchOpenCode("git push origin main", "git push")).toBe(true);
      expect(Wildcard.matchOpenCode("git status --short", "git status")).toBe(true);
      expect(Wildcard.matchOpenCode("git", "git push")).toBe(false);
    });
  });

  describe("Pattern specificity calculation", () => {
    test("should prefer patterns with more literal characters", () => {
      const pattern1 = "git push origin";
      const pattern2 = "git * *";
      
      const results1 = Wildcard.all([pattern1], "git push origin");
      const results2 = Wildcard.all([pattern2], "git push origin");
      
      expect(results1[0].specificity).toBeGreaterThan(results2[0].specificity);
    });

    test("should prefer patterns with word boundaries", () => {
      const pattern1 = "git push";
      const pattern2 = "gitpush";
      
      const results1 = Wildcard.all([pattern1], "git push");
      const results2 = Wildcard.all([pattern2], "gitpush");
      
      expect(results1[0].specificity).toBeGreaterThan(results2[0].specificity);
    });

    test("should prefer patterns starting/ending with literals", () => {
      const pattern1 = "git *";
      const pattern2 = "* push";
      const pattern3 = "* *";
      
      const results1 = Wildcard.all([pattern1], "git push");
      const results2 = Wildcard.all([pattern2], "git push");
      const results3 = Wildcard.all([pattern3], "git push");
      
      expect(results1[0].specificity).toBeGreaterThan(results3[0].specificity);
      expect(results2[0].specificity).toBeGreaterThan(results3[0].specificity);
    });
  });

  describe("Performance and edge cases", () => {
    test("should handle empty patterns array", () => {
      const results = Wildcard.all([], "test");
      expect(results).toHaveLength(0);
    });

    test("should handle empty text", () => {
      const results = Wildcard.all(["*", "test"], "");
      expect(results).toHaveLength(1);
      expect(results[0].pattern).toBe("*");
    });

    test("should handle special regex characters", () => {
      const patterns = ["test.file", "test.*"];
      const text = "test.file";
      
      const results = Wildcard.all(patterns, text);
      expect(results).toHaveLength(2);
      expect(results[0].pattern).toBe("test.file"); // Exact match should win
    });

    test("should handle large pattern sets efficiently", () => {
      const patterns = Array.from({ length: 1000 }, (_, i) => `pattern${i}*`);
      patterns.push("test*");
      
      const start = Date.now();
      const results = Wildcard.all(patterns, "test123");
      const duration = Date.now() - start;
      
      expect(results).toHaveLength(1);
      expect(results[0].pattern).toBe("test*");
      expect(duration).toBeLessThan(100); // Should be fast
    });
  });

  describe("Enhanced Tool Filtering", () => {
    test("should filter tools with include patterns", () => {
      const tools = ["bash", "edit", "read", "write", "webfetch"];
      const includePatterns = ["bash*", "*edit*", "read"];
      
      const filtered = Wildcard.filterToolNames(tools, includePatterns);
      expect(filtered).toEqual(["bash", "edit", "read"]);
    });

    test("should filter tools with exclude patterns", () => {
      const tools = ["bash", "edit", "read", "write", "webfetch"];
      const excludePatterns = ["write*", "*fetch*"];
      
      const filtered = Wildcard.filterToolNames(tools, [], excludePatterns);
      expect(filtered).toEqual(["bash", "edit", "read"]);
    });

    test("should apply both include and exclude patterns", () => {
      const tools = ["bash", "edit", "read", "write", "webfetch"];
      const includePatterns = ["*"];
      const excludePatterns = ["write*", "*fetch*"];
      
      const filtered = Wildcard.filterToolNames(tools, includePatterns, excludePatterns);
      expect(filtered).toEqual(["bash", "edit", "read"]);
    });
  });

  describe("Tool Registry Integration", () => {
    test("should check tool allowance for agents with patterns", () => {
      expect(ToolRegistry.isToolAllowedForAgent("bash", "grounding")).toBe(true);
      expect(ToolRegistry.isToolAllowedForAgent("write", "grounding")).toBe(false);
      expect(ToolRegistry.isToolAllowedForAgent("read", "code-reviewer")).toBe(true);
      expect(ToolRegistry.isToolAllowedForAgent("edit", "code-reviewer")).toBe(false);
    });

    test("should calculate tool priority correctly", () => {
      const bashPriority = ToolRegistry.getToolPriority("bash", "grounding");
      const unknownPriority = ToolRegistry.getToolPriority("unknown", "grounding");
      
      expect(bashPriority).toBeGreaterThan(0);
      expect(unknownPriority).toBe(0);
    });
  });

  describe("Permission System Integration", () => {
    test("should handle tool name patterns in permissions", () => {
      const permissions = {
        tools: {
          "bash*": "ask" as const,
          "*edit*": "deny" as const,
          "read": "allow" as const,
        }
      };

      const bashResult = Permission.checkPermission({
        type: "bash",
        config: { permission: permissions }
      });
      expect(bashResult).toBe("ask");

      const editResult = Permission.checkPermission({
        type: "edit",
        config: { permission: permissions }
      });
      expect(editResult).toBe("deny");

      const readResult = Permission.checkPermission({
        type: "read",
        config: { permission: permissions }
      });
      expect(readResult).toBe("allow");
    });

    test("should handle agent-specific tool patterns", () => {
      const permissions = {
        tools: {
          "*": "ask" as const,
        },
        agents: {
          "test-agent": {
            tools: {
              "bash*": "allow" as const,
              "*edit*": "deny" as const,
            }
          }
        }
      };

      const bashResult = Permission.checkPermission({
        type: "bash",
        agentName: "test-agent",
        config: { permission: permissions }
      });
      expect(bashResult).toBe("allow");

      const editResult = Permission.checkPermission({
        type: "edit",
        agentName: "test-agent",
        config: { permission: permissions }
      });
      expect(editResult).toBe("deny");

      // Should fall back to global for unknown agent
      const unknownAgentResult = Permission.checkPermission({
        type: "bash",
        agentName: "unknown-agent",
        config: { permission: permissions }
      });
      expect(bashResult).toBe("allow");
    });
  });

  describe("Enhanced Pattern Matching with Result Information", () => {
    test("should return detailed match results", () => {
      const patterns = ["bash*", "bash"];
      const result = Wildcard.matchToolNameWithResult("bash", patterns);
      
      expect(result).not.toBeNull();
      expect(result!.pattern).toBe("bash"); // Exact match should win
      expect(result!.priority).toBe(1000); // Exact match priority
      expect(result!.specificity).toBeGreaterThan(0);
    });

    test("should calculate tool config priority", () => {
      const configPatterns = {
        "bash*": { priority: 1 },
        "bash": { priority: 2 },
        "*": { priority: 0 }
      };
      
      const priority = Wildcard.getToolConfigPriority("bash", configPatterns);
      expect(priority).toBeGreaterThan(0);
    });
  });
});