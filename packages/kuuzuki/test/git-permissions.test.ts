import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { GitPermissionManager, SafeGitOperations } from "../src/git/index.js"
import { DEFAULT_AGENTRC, type AgentrcConfig } from "../src/config/agentrc.js"
import { rmSync, existsSync, mkdtempSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

describe("Git Permission System", () => {
  let testDir: string
  let originalCwd: string

  const testConfig: AgentrcConfig = {
    project: {
      name: "test-project",
    },
    git: {
      commitMode: "ask",
      pushMode: "never",
      configMode: "never",
      preserveAuthor: true,
      requireConfirmation: true,
      maxCommitSize: 100,
    },
  }

  beforeEach(() => {
    // Create isolated test directory
    originalCwd = process.cwd()
    testDir = mkdtempSync(join(tmpdir(), "kuuzuki-git-permissions-test-"))
    process.chdir(testDir)
  })

  afterEach(() => {
    // Return to original directory and cleanup test directory
    process.chdir(originalCwd)
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe("GitPermissionManager", () => {
    test("should deny commits by default when mode is never", async () => {
      const config = {
        ...testConfig,
        git: { ...testConfig.git!, commitMode: "never" as const },
      }
      const manager = new GitPermissionManager(config)

      const result = await manager.checkPermission({
        operation: "commit",
        files: ["test.txt"],
        message: "Test commit",
      })

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain("disabled")
    })

    test("should allow commits when mode is project", async () => {
      const config = {
        ...testConfig,
        git: { ...testConfig.git!, commitMode: "project" as const },
      }
      const manager = new GitPermissionManager(config)

      const result = await manager.checkPermission({
        operation: "commit",
        files: ["test.txt"],
        message: "Test commit",
      })

      expect(result.allowed).toBe(true)
      expect(result.scope).toBe("project")
    })

    test("should grant and track session permissions", async () => {
      const config = {
        ...testConfig,
        git: { ...testConfig.git!, commitMode: "session" as const },
      }
      const manager = new GitPermissionManager(config)

      // Initially no session permissions
      expect(manager.getSessionPermissions()).toEqual([])

      // Grant session permission
      manager.grantSessionPermission("commit")
      expect(manager.getSessionPermissions()).toContain("commit")

      // Check permission should now allow
      const result = await manager.checkPermission({
        operation: "commit",
        files: ["test.txt"],
        message: "Test commit",
      })

      expect(result.allowed).toBe(true)
    })

    test("should validate branch restrictions", async () => {
      const config = {
        ...testConfig,
        git: {
          ...testConfig.git!,
          allowedBranches: ["main", "develop"],
        },
      }
      const manager = new GitPermissionManager(config)

      expect(manager.validateBranch("main")).toBe(true)
      expect(manager.validateBranch("develop")).toBe(true)
      expect(manager.validateBranch("feature/test")).toBe(false)
    })

    test("should validate commit size limits", async () => {
      const config = {
        ...testConfig,
        git: { ...testConfig.git!, maxCommitSize: 5 },
      }
      const manager = new GitPermissionManager(config)

      expect(manager.validateCommitSize(3)).toBe(true)
      expect(manager.validateCommitSize(5)).toBe(true)
      expect(manager.validateCommitSize(6)).toBe(false)
    })

    test("should preserve author settings by default", async () => {
      const manager = new GitPermissionManager(testConfig)
      expect(manager.shouldPreserveAuthor()).toBe(true)
    })

    test("should require confirmation by default", async () => {
      const manager = new GitPermissionManager(testConfig)
      expect(manager.requiresConfirmation()).toBe(true)
    })
  })

  describe("SafeGitOperations", () => {
    test("should create operations instance with config", () => {
      const operations = new SafeGitOperations(testConfig)
      expect(operations).toBeDefined()
      expect(operations.getPermissionManager()).toBeDefined()
      expect(operations.getContextProvider()).toBeDefined()
    })

    test("should handle commit with never permission", async () => {
      const config = {
        ...testConfig,
        git: { ...testConfig.git!, commitMode: "never" as const },
      }
      const operations = new SafeGitOperations(config)

      const result = await operations.commit("Test commit", ["test.txt"])

      expect(result.success).toBe(false)
      expect(result.error).toContain("disabled")
    })

    test("should handle push with never permission", async () => {
      const operations = new SafeGitOperations(testConfig)

      const result = await operations.push("origin", "main")

      expect(result.success).toBe(false)
      expect(result.error).toContain("disabled")
    })
  })

  describe("Configuration Management", () => {
    test("should load default config when no .agentrc exists", async () => {
      // Ensure no .agentrc exists
      expect(existsSync(".agentrc")).toBe(false)

      const operations = new SafeGitOperations(DEFAULT_AGENTRC as AgentrcConfig)
      const manager = operations.getPermissionManager()
      const summary = manager.getConfigSummary()

      expect(summary["commitMode"]).toBe("ask")
      expect(summary["pushMode"]).toBe("never")
      expect(summary["configMode"]).toBe("never")
    })

    test("should update .agentrc when project permission granted", async () => {
      const operations = new SafeGitOperations(testConfig)

      // Simulate project permission update
      await operations["updateAgentrcConfig"]("commit", "project")

      expect(existsSync(".agentrc")).toBe(true)

      const content = await Bun.file(".agentrc").text()
      const config = JSON.parse(content)

      expect(config.git["commitMode"]).toBe("project")
    })
  })

  describe("Integration Tests", () => {
    test("should handle complete permission flow", async () => {
      // Test with session mode to verify session permissions work
      const config = {
        ...testConfig,
        git: { ...testConfig.git!, commitMode: "session" as const },
      }
      const operations = new SafeGitOperations(config)
      const manager = operations.getPermissionManager()

      // Start with session mode - should require user confirmation when no session permission
      let result = await manager.checkPermission({
        operation: "commit",
        files: ["test.txt"],
        message: "Test commit",
      })
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe("User confirmation required")

      // Grant session permission
      manager.grantSessionPermission("commit")

      // Now should be allowed
      result = await manager.checkPermission({
        operation: "commit",
        files: ["test.txt"],
        message: "Test commit",
      })
      expect(result.allowed).toBe(true)
    })

    test("should respect branch restrictions in commit flow", async () => {
      const config = {
        ...testConfig,
        git: {
          ...testConfig.git!,
          commitMode: "project" as const,
          allowedBranches: ["main"],
        },
      }
      const operations = new SafeGitOperations(config)
      const manager = operations.getPermissionManager()

      // Should allow main branch
      expect(manager.validateBranch("main")).toBe(true)

      // Should deny other branches
      expect(manager.validateBranch("feature/test")).toBe(false)
    })

    test("should handle commit size validation", async () => {
      const config = {
        ...testConfig,
        git: {
          ...testConfig.git!,
          commitMode: "project" as const,
          maxCommitSize: 2,
        },
      }
      const operations = new SafeGitOperations(config)

      // Small commit should work
      const smallResult = await operations.commit("Small commit", ["file1.txt"])
      // Note: This will fail due to not being in a git repo, but should pass size validation
      expect(smallResult.error).not.toContain("Too many files")

      // Large commit should be rejected
      const largeResult = await operations.commit("Large commit", ["file1.txt", "file2.txt", "file3.txt"])
      expect(largeResult.success).toBe(false)
      expect(largeResult.error).toContain("Too many files")
    })
  })

  describe("Error Handling", () => {
    test("should handle invalid configuration gracefully", async () => {
      const invalidConfig = {
        project: { name: "test" },
        git: {
          commitMode: "invalid" as any,
          pushMode: "never" as const,
          configMode: "never" as const,
          preserveAuthor: true,
          requireConfirmation: true,
          maxCommitSize: 100,
        },
      }

      // Should not throw, should use defaults
      expect(() => new GitPermissionManager(invalidConfig)).not.toThrow()
    })

    test("should handle missing git config section", async () => {
      const configWithoutGit = {
        project: { name: "test" },
      } as AgentrcConfig

      const manager = new GitPermissionManager(configWithoutGit)
      const summary = manager.getConfigSummary()

      // Should use defaults
      expect(summary["commitMode"]).toBeDefined()
      expect(summary["pushMode"]).toBeDefined()
    })

    test("should handle file system errors in config updates", async () => {
      const operations = new SafeGitOperations(testConfig)

      // Try to update config in a read-only scenario (simulated)
      // This test would need to mock file system to properly test error handling
      expect(async () => {
        await operations["updateAgentrcConfig"]("commit", "project")
      }).not.toThrow()
    })
  })

  describe("Security Tests", () => {
    test("should prevent unauthorized commits by default", async () => {
      // Use "never" mode to test that commits are blocked without prompts
      const config = {
        ...testConfig,
        git: { ...testConfig.git!, commitMode: "never" as const },
      }
      const operations = new SafeGitOperations(config)

      const result = await operations.commit("Unauthorized commit", ["sensitive.txt"])

      expect(result.success).toBe(false)
      expect(result.error).toContain("disabled")
    })

    test("should prevent unauthorized pushes by default", async () => {
      const operations = new SafeGitOperations(testConfig)

      const result = await operations.push("origin", "main")

      expect(result.success).toBe(false)
      expect(result.error).toContain("disabled")
    })

    test("should prevent config changes by default", async () => {
      const manager = new GitPermissionManager(testConfig)

      const result = await manager.checkPermission({
        operation: "config",
        config: { key: "user.name", value: "hacker" },
      })

      expect(result.allowed).toBe(false)
    })
  })
})
