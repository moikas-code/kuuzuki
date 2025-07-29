import { $ } from "bun"
import { Log } from "../util/log.js"

/**
 * Git repository status information
 */
export interface GitStatus {
  branch: string
  staged: string[]
  unstaged: string[]
  untracked: string[]
  ahead: number
  behind: number
  clean: boolean
}

/**
 * Git commit information
 */
export interface GitCommit {
  hash: string
  message: string
  author: string
  date: string
}

/**
 * Git configuration entry
 */
export interface GitConfig {
  key: string
  value: string
  scope: "local" | "global" | "system"
}

/**
 * Provides Git repository context and information
 */
export class GitContextProvider {
  private log = Log.create({ service: "GitContextProvider" })

  /**
   * Get current Git status
   */
  async getStatus(): Promise<GitStatus | null> {
    try {
      // Get current branch
      const branchResult = await $`git branch --show-current`.quiet()
      const branch = branchResult.stdout.toString().trim()

      // Get staged files
      const stagedResult = await $`git diff --cached --name-only`.quiet()
      const staged = stagedResult.stdout.toString().trim().split("\n").filter(Boolean)

      // Get unstaged files
      const unstagedResult = await $`git diff --name-only`.quiet()
      const unstaged = unstagedResult.stdout.toString().trim().split("\n").filter(Boolean)

      // Get untracked files
      const untrackedResult = await $`git ls-files --others --exclude-standard`.quiet()
      const untracked = untrackedResult.stdout.toString().trim().split("\n").filter(Boolean)

      // Get ahead/behind info
      let ahead = 0
      let behind = 0
      try {
        const aheadBehindResult = await $`git rev-list --left-right --count HEAD...@{upstream}`.quiet()
        const [aheadStr, behindStr] = aheadBehindResult.stdout.toString().trim().split("\t")
        ahead = parseInt(aheadStr) || 0
        behind = parseInt(behindStr) || 0
      } catch {
        // No upstream or other error - ignore
      }

      const clean = staged.length === 0 && unstaged.length === 0 && untracked.length === 0

      return {
        branch,
        staged,
        unstaged,
        untracked,
        ahead,
        behind,
        clean,
      }
    } catch (error) {
      this.log.error("Failed to get git status", { error: String(error) })
      return null
    }
  }

  /**
   * Check if we're in a Git repository
   */
  async isGitRepository(): Promise<boolean> {
    try {
      await $`git rev-parse --git-dir`.quiet()
      return true
    } catch {
      return false
    }
  }

  /**
   * Get current Git user configuration
   */
  async getCurrentUser(): Promise<{ name?: string; email?: string }> {
    try {
      const nameResult = await $`git config user.name`.quiet()
      const emailResult = await $`git config user.email`.quiet()

      return {
        name: nameResult.stdout.toString().trim() || undefined,
        email: emailResult.stdout.toString().trim() || undefined,
      }
    } catch (error) {
      this.log.error("Failed to get git user config", { error: String(error) })
      return {}
    }
  }

  /**
   * Get Git diff for staged files
   */
  async getStagedDiff(): Promise<string> {
    try {
      const result = await $`git diff --cached`.quiet()
      return result.stdout.toString()
    } catch (error) {
      this.log.error("Failed to get staged diff", { error: String(error) })
      return ""
    }
  }
}

/**
 * Create a GitContextProvider instance
 */
export function createGitContextProvider(): GitContextProvider {
  return new GitContextProvider()
}
