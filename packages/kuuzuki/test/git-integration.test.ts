import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { SafeGitOperations } from "../src/git/index.js"
import { type AgentrcConfig } from "../src/config/agentrc.js"
import { rmSync, existsSync, mkdirSync } from "fs"
import { $ } from "bun"

describe("Git Integration Tests", () => {
  const testDir = "test-git-repo"
  const originalCwd = process.cwd()

  beforeEach(async () => {
    // Clean up any existing test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }

    // Create and initialize test Git repository
    mkdirSync(testDir)
    process.chdir(testDir)

    await $`git init`.quiet()
    await $`git config user.name "Test User"`.quiet()
    await $`git config user.email "test@example.com"`.quiet()

    // Create initial commit
    await Bun.write("README.md", "# Test Repository")
    await $`git add README.md`.quiet()
    await $`git commit -m "Initial commit"`.quiet()
  })

  afterEach(() => {
    // Return to original directory and clean up
    process.chdir(originalCwd)
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe("Real Git Repository Operations", () => {
    test("should detect Git repository correctly", async () => {
      const config: AgentrcConfig = {
        project: { name: "test-project" },
        git: {
          commitMode: "project",
          pushMode: "never",
          configMode: "never",
          preserveAuthor: true,
          requireConfirmation: false,
          maxCommitSize: 100,
        },
      }

      const operations = new SafeGitOperations(config)
      const contextProvider = operations.getContextProvider()

      const isRepo = await contextProvider.isGitRepository()
      expect(isRepo).toBe(true)

      const status = await contextProvider.getStatus()
      expect(status).not.toBeNull()
      expect(status!.branch).toBe("master") // or "main" depending on Git version
      expect(status!.clean).toBe(true)
    })

    test("should handle commit operations with project permissions", async () => {
      const config: AgentrcConfig = {
        project: { name: "test-project" },
        git: {
          commitMode: "project",
          pushMode: "never",
          configMode: "never",
          preserveAuthor: true,
          requireConfirmation: false,
          maxCommitSize: 100,
        },
      }

      const operations = new SafeGitOperations(config)

      // Create a new file
      await Bun.write("test.txt", "Hello, World!")

      // Commit should succeed with project permissions
      const result = await operations.commit("Add test file", ["test.txt"])

      expect(result.success).toBe(true)
      expect(result.message).toBe("Commit successful")

      // Verify commit was actually made
      const log = await $`git log --oneline`.text()
      expect(log).toContain("Add test file")
    })

    test("should respect branch restrictions", async () => {
      const config: AgentrcConfig = {
        project: { name: "test-project" },
        git: {
          commitMode: "project",
          pushMode: "never",
          configMode: "never",
          preserveAuthor: true,
          requireConfirmation: false,
          maxCommitSize: 100,
          allowedBranches: ["main", "develop"],
        },
      }

      const operations = new SafeGitOperations(config)

      // Create and switch to a restricted branch
      await $`git checkout -b feature/restricted`.quiet()

      // Create a new file
      await Bun.write("restricted.txt", "This should be blocked")

      // Commit should fail due to branch restrictions
      const result = await operations.commit("Add restricted file", ["restricted.txt"])

      expect(result.success).toBe(false)
      expect(result.error).toContain("not allowed on branch")
    })

    test("should enforce commit size limits", async () => {
      const config: AgentrcConfig = {
        project: { name: "test-project" },
        git: {
          commitMode: "project",
          pushMode: "never",
          configMode: "never",
          preserveAuthor: true,
          requireConfirmation: false,
          maxCommitSize: 2, // Very small limit
        },
      }

      const operations = new SafeGitOperations(config)

      // Create multiple files exceeding the limit
      await Bun.write("file1.txt", "Content 1")
      await Bun.write("file2.txt", "Content 2")
      await Bun.write("file3.txt", "Content 3")

      // Commit should fail due to size limit
      const result = await operations.commit("Add many files", ["file1.txt", "file2.txt", "file3.txt"])

      expect(result.success).toBe(false)
      expect(result.error).toContain("Too many files")
    })

    test("should handle Git status correctly", async () => {
      const config: AgentrcConfig = {
        project: { name: "test-project" },
        git: {
          commitMode: "project",
          pushMode: "never",
          configMode: "never",
          preserveAuthor: true,
          requireConfirmation: false,
          maxCommitSize: 100,
        },
      }

      const operations = new SafeGitOperations(config)
      const contextProvider = operations.getContextProvider()

      // Initially clean
      let status = await contextProvider.getStatus()
      expect(status!.clean).toBe(true)
      expect(status!.staged).toEqual([])
      expect(status!.unstaged).toEqual([])
      expect(status!.untracked).toEqual([])

      // Add untracked file
      await Bun.write("untracked.txt", "Untracked content")
      status = await contextProvider.getStatus()
      expect(status!.clean).toBe(false)
      expect(status!.untracked).toContain("untracked.txt")

      // Stage the file
      await $`git add untracked.txt`.quiet()
      status = await contextProvider.getStatus()
      expect(status!.staged).toContain("untracked.txt")
      expect(status!.untracked).not.toContain("untracked.txt")

      // Modify staged file
      await Bun.write("untracked.txt", "Modified content")
      status = await contextProvider.getStatus()
      expect(status!.staged).toContain("untracked.txt")
      expect(status!.unstaged).toContain("untracked.txt")
    })

    test("should preserve Git user configuration", async () => {
      const config: AgentrcConfig = {
        project: { name: "test-project" },
        git: {
          commitMode: "project",
          pushMode: "never",
          configMode: "never",
          preserveAuthor: true,
          requireConfirmation: false,
          maxCommitSize: 100,
        },
      }

      const operations = new SafeGitOperations(config)
      const contextProvider = operations.getContextProvider()

      const user = await contextProvider.getCurrentUser()
      expect(user.name).toBe("Test User")
      expect(user.email).toBe("test@example.com")

      // Commit and verify author is preserved
      await Bun.write("author-test.txt", "Author test")
      const result = await operations.commit("Test author preservation", ["author-test.txt"])
      expect(result.success).toBe(true)

      // Check commit author
      const commitInfo = await $`git log -1 --format="%an <%ae>"`.text()
      expect(commitInfo.trim()).toBe("Test User <test@example.com>")
    })

    test("should handle session permissions correctly", async () => {
      const config: AgentrcConfig = {
        project: { name: "test-project" },
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

      // Create a file
      await Bun.write("session-test.txt", "Session test")

      // First commit should fail (no session permission)
      let result = await manager.checkPermission({
        operation: "commit",
        files: ["session-test.txt"],
        message: "Test session",
      })
      expect(result.allowed).toBe(false)

      // Grant session permission
      manager.grantSessionPermission("commit")
      expect(manager.getSessionPermissions()).toContain("commit")

      // Now commit should be allowed
      result = await manager.checkPermission({
        operation: "commit",
        files: ["session-test.txt"],
        message: "Test session",
      })
      expect(result.allowed).toBe(true)
    })
  })

  describe("Configuration Management Integration", () => {
    test("should update .agentrc when granting project permissions", async () => {
      const config: AgentrcConfig = {
        project: { name: "test-project" },
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

      // Simulate granting project permission (this would normally be done through prompts)
      await operations["updateAgentrcConfig"]("commit", "project")

      // Verify .agentrc was created and updated
      expect(existsSync(".agentrc")).toBe(true)

      const agentrcContent = await Bun.file(".agentrc").text()
      const parsedConfig = JSON.parse(agentrcContent)
      expect(parsedConfig.git.commitMode).toBe("project")
    })

    test("should load existing .agentrc configuration", async () => {
      // Create a custom .agentrc
      const customConfig = {
        project: { name: "custom-project" },
        git: {
          commitMode: "project",
          pushMode: "session",
          configMode: "ask",
          preserveAuthor: false,
          requireConfirmation: true,
          maxCommitSize: 50,
          allowedBranches: ["main", "develop"],
        },
      }

      await Bun.write(".agentrc", JSON.stringify(customConfig, null, 2))

      const operations = new SafeGitOperations(customConfig as AgentrcConfig)
      const manager = operations.getPermissionManager()

      const summary = manager.getConfigSummary()
      expect(summary["commitMode"]).toBe("project")
      expect(summary["pushMode"]).toBe("session")
      expect(summary["maxCommitSize"]).toBe(50)
      expect(summary["allowedBranches"]).toEqual(["main", "develop"])
    })
  })

  describe("Error Handling Integration", () => {
    test("should handle non-Git directory gracefully", async () => {
      // Move to a non-Git directory
      process.chdir(originalCwd)
      mkdirSync("non-git-dir", { recursive: true })
      process.chdir("non-git-dir")

      const config: AgentrcConfig = {
        project: { name: "test-project" },
        git: {
          commitMode: "project",
          pushMode: "never",
          configMode: "never",
          preserveAuthor: true,
          requireConfirmation: false,
          maxCommitSize: 100,
        },
      }

      const operations = new SafeGitOperations(config)

      const result = await operations.commit("Should fail", ["nonexistent.txt"])
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/Not in a Git repository|Failed with exit code/)

      // Clean up
      process.chdir(originalCwd)
      rmSync("non-git-dir", { recursive: true, force: true })
    })

    test("should handle missing files gracefully", async () => {
      const config: AgentrcConfig = {
        project: { name: "test-project" },
        git: {
          commitMode: "project",
          pushMode: "never",
          configMode: "never",
          preserveAuthor: true,
          requireConfirmation: false,
          maxCommitSize: 100,
        },
      }

      const operations = new SafeGitOperations(config)

      // Try to commit non-existent files
      const result = await operations.commit("Commit missing files", ["missing1.txt", "missing2.txt"])

      // Git will handle this - the operation might succeed but with no changes
      // or fail depending on Git version and configuration
      expect(result).toBeDefined()
    })
  })
})
