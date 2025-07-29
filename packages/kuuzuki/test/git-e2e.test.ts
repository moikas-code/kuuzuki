import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { SafeGitOperations } from "../src/git/index.js"
import { type AgentrcConfig } from "../src/config/agentrc.js"
import { rmSync, existsSync, mkdtempSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { $ } from "bun"

describe("Git Permission System - End-to-End User Workflows", () => {
  let testDir: string
  let originalCwd: string = process.cwd()

  beforeEach(async () => {
    // Create isolated test directory
    originalCwd = process.cwd()
    testDir = mkdtempSync(join(tmpdir(), "kuuzuki-git-e2e-test-"))
    process.chdir(testDir)

    // Initialize test Git repository
    await $`git init`.quiet()
    await $`git config user.name "Test User"`.quiet()
    await $`git config user.email "test@example.com"`.quiet()

    // Create initial commit
    await Bun.write("README.md", "# Test Repository")
    await $`git add README.md`.quiet()
    await $`git commit -m "Initial commit"`.quiet()
  })

  afterEach(() => {
    // Return to original directory and cleanup test directory
    process.chdir(originalCwd)
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe("New User First-Time Setup", () => {
    test("should use secure defaults for new projects", async () => {
      // Simulate a new user with no .agentrc file
      const defaultConfig: AgentrcConfig = {
        project: { name: "new-project" },
        git: {
          commitMode: "ask",
          pushMode: "never",
          configMode: "never",
          preserveAuthor: true,
          requireConfirmation: true,
          maxCommitSize: 100,
        },
      }

      const operations = new SafeGitOperations(defaultConfig)
      const manager = operations.getPermissionManager()

      // Verify secure defaults
      const summary = manager.getConfigSummary()
      expect(summary["commitMode"]).toBe("ask")
      expect(summary["pushMode"]).toBe("never")
      expect(summary["configMode"]).toBe("never")
      expect(summary["preserveAuthor"]).toBe(true)
      expect(summary["requireConfirmation"]).toBe(true)
    })

    test("should prevent commits by default until permission is granted", async () => {
      const config: AgentrcConfig = {
        project: { name: "new-project" },
        git: {
          commitMode: "ask",
          pushMode: "never",
          configMode: "never",
          preserveAuthor: true,
          requireConfirmation: true,
          maxCommitSize: 100,
        },
      }

      const operations = new SafeGitOperations(config)
      const manager = operations.getPermissionManager()

      // Create a file to commit
      await Bun.write("new-file.txt", "New content")

      // Check permission - should require user confirmation
      const permission = await manager.checkPermission({
        operation: "commit",
        files: ["new-file.txt"],
        message: "Add new file",
      })

      expect(permission.allowed).toBe(false)
      expect(permission.reason).toBe("User confirmation required")
    })
  })

  describe("Permission Grant/Deny Workflows", () => {
    test("should handle session permission workflow", async () => {
      const config: AgentrcConfig = {
        project: { name: "session-test" },
        git: {
          commitMode: "session",
          pushMode: "never",
          configMode: "never",
          preserveAuthor: true,
          requireConfirmation: false,
          maxCommitSize: 100,
        },
      }

      const operations = new SafeGitOperations(config)
      const manager = operations.getPermissionManager()

      // Initially no session permissions
      expect(manager.getSessionPermissions()).toEqual([])

      // Create test files
      await Bun.write("session1.txt", "Session test 1")
      await Bun.write("session2.txt", "Session test 2")

      // First operation should require permission
      let permission = await manager.checkPermission({
        operation: "commit",
        files: ["session1.txt"],
        message: "First commit",
      })
      expect(permission.allowed).toBe(false)

      // Grant session permission (simulating user approval)
      manager.grantSessionPermission("commit")

      // Now operations should be allowed for the session
      permission = await manager.checkPermission({
        operation: "commit",
        files: ["session1.txt"],
        message: "First commit",
      })
      expect(permission.allowed).toBe(true)

      // Second operation should also be allowed
      permission = await manager.checkPermission({
        operation: "commit",
        files: ["session2.txt"],
        message: "Second commit",
      })
      expect(permission.allowed).toBe(true)

      // Verify session permission is tracked
      expect(manager.getSessionPermissions()).toContain("commit")
    })

    test("should handle project permission workflow with .agentrc update", async () => {
      const config: AgentrcConfig = {
        project: { name: "project-test" },
        git: {
          commitMode: "ask",
          pushMode: "never",
          configMode: "never",
          preserveAuthor: true,
          requireConfirmation: false,
          maxCommitSize: 100,
        },
      }

      const operations = new SafeGitOperations(config)

      // Verify no .agentrc exists initially
      expect(existsSync(".agentrc")).toBe(false)

      // Simulate granting project permission (normally done through prompts)
      await operations["updateAgentrcConfig"]("commit", "project")

      // Verify .agentrc was created
      expect(existsSync(".agentrc")).toBe(true)

      // Verify configuration was updated
      const agentrcContent = await Bun.file(".agentrc").text()
      const parsedConfig = JSON.parse(agentrcContent)
      expect(parsedConfig.git.commitMode).toBe("project")

      // Create new operations instance to test loading updated config
      const newOperations = new SafeGitOperations(parsedConfig as AgentrcConfig)
      const newManager = newOperations.getPermissionManager()

      // Now commits should be allowed without prompts
      const permission = await newManager.checkPermission({
        operation: "commit",
        files: ["project-file.txt"],
        message: "Project commit",
      })
      expect(permission.allowed).toBe(true)
      expect(permission.scope).toBe("project")
    })

    test("should handle permission denial workflow", async () => {
      const config: AgentrcConfig = {
        project: { name: "denial-test" },
        git: {
          commitMode: "never",
          pushMode: "never",
          configMode: "never",
          preserveAuthor: true,
          requireConfirmation: true,
          maxCommitSize: 100,
        },
      }

      const operations = new SafeGitOperations(config)
      const manager = operations.getPermissionManager()

      // All operations should be denied
      const commitPermission = await manager.checkPermission({
        operation: "commit",
        files: ["denied.txt"],
        message: "Denied commit",
      })
      expect(commitPermission.allowed).toBe(false)
      expect(commitPermission.reason).toContain("disabled")

      const pushPermission = await manager.checkPermission({
        operation: "push",
        target: "origin/main",
      })
      expect(pushPermission.allowed).toBe(false)
      expect(pushPermission.reason).toContain("disabled")

      const configPermission = await manager.checkPermission({
        operation: "config",
        config: { key: "user.name", value: "Hacker" },
      })
      expect(configPermission.allowed).toBe(false)
      expect(configPermission.reason).toContain("disabled")
    })
  })

  describe("Session Permission Persistence", () => {
    test("should maintain session permissions across multiple operations", async () => {
      const config: AgentrcConfig = {
        project: { name: "persistence-test" },
        git: {
          commitMode: "session",
          pushMode: "session",
          configMode: "never",
          preserveAuthor: true,
          requireConfirmation: false,
          maxCommitSize: 100,
        },
      }

      const operations = new SafeGitOperations(config)
      const manager = operations.getPermissionManager()

      // Grant multiple session permissions
      manager.grantSessionPermission("commit")
      manager.grantSessionPermission("push")

      // Verify both permissions are tracked
      const sessionPermissions = manager.getSessionPermissions()
      expect(sessionPermissions).toContain("commit")
      expect(sessionPermissions).toContain("push")

      // Test multiple operations
      const commitPermission = await manager.checkPermission({
        operation: "commit",
        files: ["file1.txt"],
        message: "Test commit",
      })
      expect(commitPermission.allowed).toBe(true)

      const pushPermission = await manager.checkPermission({
        operation: "push",
        target: "origin/main",
      })
      expect(pushPermission.allowed).toBe(true)

      // Config should still be denied
      const configPermission = await manager.checkPermission({
        operation: "config",
        config: { key: "user.name", value: "Test" },
      })
      expect(configPermission.allowed).toBe(false)
    })

    test("should allow clearing session permissions", async () => {
      const config: AgentrcConfig = {
        project: { name: "clear-test" },
        git: {
          commitMode: "session",
          pushMode: "session",
          configMode: "session",
          preserveAuthor: true,
          requireConfirmation: false,
          maxCommitSize: 100,
        },
      }

      const operations = new SafeGitOperations(config)
      const manager = operations.getPermissionManager()

      // Grant all session permissions
      manager.grantSessionPermission("commit")
      manager.grantSessionPermission("push")
      manager.grantSessionPermission("config")

      expect(manager.getSessionPermissions()).toHaveLength(3)

      // Clear all session permissions
      manager.clearSessionPermissions()

      expect(manager.getSessionPermissions()).toEqual([])

      // All operations should now require permission again
      const commitPermission = await manager.checkPermission({
        operation: "commit",
        files: ["file.txt"],
        message: "Test",
      })
      expect(commitPermission.allowed).toBe(false)
    })
  })

  describe("Complex Workflow Scenarios", () => {
    test("should handle mixed permission modes correctly", async () => {
      const config: AgentrcConfig = {
        project: { name: "mixed-test" },
        git: {
          commitMode: "project", // Always allow
          pushMode: "session", // Require session permission
          configMode: "never", // Never allow
          preserveAuthor: true,
          requireConfirmation: false,
          maxCommitSize: 100,
        },
      }

      const operations = new SafeGitOperations(config)
      const manager = operations.getPermissionManager()

      // Commits should be allowed (project mode)
      const commitPermission = await manager.checkPermission({
        operation: "commit",
        files: ["mixed.txt"],
        message: "Mixed test",
      })
      expect(commitPermission.allowed).toBe(true)
      expect(commitPermission.scope).toBe("project")

      // Pushes should require session permission
      let pushPermission = await manager.checkPermission({
        operation: "push",
        target: "origin/main",
      })
      expect(pushPermission.allowed).toBe(false)

      // Grant session permission for push
      manager.grantSessionPermission("push")

      pushPermission = await manager.checkPermission({
        operation: "push",
        target: "origin/main",
      })
      expect(pushPermission.allowed).toBe(true)

      // Config should always be denied
      const configPermission = await manager.checkPermission({
        operation: "config",
        config: { key: "user.name", value: "Test" },
      })
      expect(configPermission.allowed).toBe(false)
    })

    test("should handle branch restrictions in real workflow", async () => {
      const config: AgentrcConfig = {
        project: { name: "branch-test" },
        git: {
          commitMode: "project",
          pushMode: "never",
          configMode: "never",
          preserveAuthor: true,
          requireConfirmation: false,
          maxCommitSize: 100,
          allowedBranches: ["master", "main", "develop"],
        },
      }

      const operations = new SafeGitOperations(config)

      // Create test file
      await Bun.write("branch-test.txt", "Branch test content")

      // Commit on main branch should succeed
      let result = await operations.commit("Test on main", ["branch-test.txt"], { addAll: true })
      expect(result.success).toBe(true)

      // Switch to allowed branch
      await $`git checkout -b develop`.quiet()
      await Bun.write("develop.txt", "Develop content")

      result = await operations.commit("Test on develop", ["develop.txt"], { addAll: true })
      expect(result.success).toBe(true)

      // Switch to restricted branch
      await $`git checkout -b feature/restricted`.quiet()
      await Bun.write("restricted.txt", "Restricted content")

      result = await operations.commit("Test on restricted", ["restricted.txt"])
      expect(result.success).toBe(false)
      expect(result.error).toContain("not allowed on branch")
    })

    test("should handle commit size limits in real workflow", async () => {
      const config: AgentrcConfig = {
        project: { name: "size-test" },
        git: {
          commitMode: "project",
          pushMode: "never",
          configMode: "never",
          preserveAuthor: true,
          requireConfirmation: false,
          maxCommitSize: 3,
        },
      }

      const operations = new SafeGitOperations(config)

      // Create files within limit
      await Bun.write("file1.txt", "Content 1")
      await Bun.write("file2.txt", "Content 2")
      await Bun.write("file3.txt", "Content 3")

      let result = await operations.commit("Within limit", ["file1.txt", "file2.txt", "file3.txt"], { addAll: true })
      expect(result.success).toBe(true)

      // Create files exceeding limit
      await Bun.write("file4.txt", "Content 4")
      await Bun.write("file5.txt", "Content 5")

      result = await operations.commit("Exceeds limit", [
        "file1.txt",
        "file2.txt",
        "file3.txt",
        "file4.txt",
        "file5.txt",
      ])
      expect(result.success).toBe(false)
      expect(result.error).toContain("Too many files")
    })
  })

  describe("Configuration Persistence Workflows", () => {
    test("should persist configuration changes across sessions", async () => {
      // First session - create and update config
      const initialConfig: AgentrcConfig = {
        project: { name: "persistence-test" },
        git: {
          commitMode: "ask",
          pushMode: "never",
          configMode: "never",
          preserveAuthor: true,
          requireConfirmation: true,
          maxCommitSize: 100,
        },
      }

      const operations1 = new SafeGitOperations(initialConfig)
      await operations1["updateAgentrcConfig"]("commit", "project")

      // Verify .agentrc was created
      expect(existsSync(".agentrc")).toBe(true)

      // Second session - load existing config
      const agentrcContent = await Bun.file(".agentrc").text()
      const loadedConfig = JSON.parse(agentrcContent) as AgentrcConfig

      const operations2 = new SafeGitOperations(loadedConfig)
      const manager2 = operations2.getPermissionManager()

      // Verify configuration was persisted
      const summary = manager2.getConfigSummary()
      expect(summary["commitMode"]).toBe("project")

      // Verify behavior matches persisted config
      const permission = await manager2.checkPermission({
        operation: "commit",
        files: ["persistent.txt"],
        message: "Persistent test",
      })
      expect(permission.allowed).toBe(true)
      expect(permission.scope).toBe("project")
    })

    test("should handle configuration merging correctly", async () => {
      // Create initial .agentrc with partial config
      const partialConfig = {
        project: { name: "merge-test" },
        git: {
          commitMode: "project",
          pushMode: "session",
        },
      }

      await Bun.write(".agentrc", JSON.stringify(partialConfig, null, 2))

      // Load and merge with defaults
      const agentrcContent = await Bun.file(".agentrc").text()
      const loadedConfig = JSON.parse(agentrcContent) as AgentrcConfig

      // Fill in missing defaults
      const completeConfig: AgentrcConfig = {
        ...loadedConfig,
        git: {
          commitMode: loadedConfig.git?.commitMode || "ask",
          pushMode: loadedConfig.git?.pushMode || "never",
          configMode: loadedConfig.git?.configMode || "never",
          preserveAuthor: loadedConfig.git?.preserveAuthor ?? true,
          requireConfirmation: loadedConfig.git?.requireConfirmation ?? true,
          maxCommitSize: loadedConfig.git?.maxCommitSize || 100,
        },
      }

      const operations = new SafeGitOperations(completeConfig)
      const manager = operations.getPermissionManager()

      const summary = manager.getConfigSummary()
      expect(summary["commitMode"]).toBe("project")
      expect(summary["pushMode"]).toBe("session")
      expect(summary["configMode"]).toBe("never")
      expect(summary["preserveAuthor"]).toBe(true)
    })
  })
})
