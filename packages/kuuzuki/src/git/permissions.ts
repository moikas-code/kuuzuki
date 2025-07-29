import type { AgentrcConfig } from "../config/agentrc.js"
import { Log } from "../util/log.js"

/**
 * Git operation types that require permission
 */
export type GitOperation = "commit" | "push" | "config"

/**
 * Permission modes for Git operations
 */
export type PermissionMode = "never" | "ask" | "session" | "project"

/**
 * Context information for Git operations
 */
export interface GitOperationContext {
  operation: GitOperation
  files?: string[]
  message?: string
  branch?: string
  target?: string
  config?: { key: string; value: string }
}

/**
 * Result of a permission check
 */
export interface PermissionResult {
  allowed: boolean
  reason?: string
  scope?: "once" | "session" | "project"
}

/**
 * Session-scoped permissions storage
 */
class SessionPermissions {
  private permissions = new Set<GitOperation>()
  private log = Log.create({ service: "SessionPermissions" })

  grant(operation: GitOperation): void {
    this.permissions.add(operation)
    this.log.info(`Granted session permission for ${operation}`)
  }

  revoke(operation: GitOperation): void {
    this.permissions.delete(operation)
    this.log.info(`Revoked session permission for ${operation}`)
  }

  has(operation: GitOperation): boolean {
    return this.permissions.has(operation)
  }

  clear(): void {
    this.permissions.clear()
    this.log.info("Cleared all session permissions")
  }

  list(): GitOperation[] {
    return Array.from(this.permissions)
  }
}

/**
 * Manages Git operation permissions based on .agentrc configuration
 */
export class GitPermissionManager {
  private sessionPermissions = new SessionPermissions()
  private log = Log.create({ service: "GitPermissionManager" })

  constructor(private config: AgentrcConfig) {}

  /**
   * Check if a Git operation is allowed
   */
  async checkPermission(context: GitOperationContext): Promise<PermissionResult> {
    const mode = this.getPermissionMode(context.operation)

    this.log.debug(`Checking permission for ${context.operation} with mode: ${mode}`)

    switch (mode) {
      case "never":
        return {
          allowed: false,
          reason: `${context.operation} operations are disabled in .agentrc configuration`,
        }

      case "project":
        return { allowed: true, scope: "project" }

      case "session":
        const hasSessionPermission = this.sessionPermissions.has(context.operation)
        if (hasSessionPermission) {
          return { allowed: true, scope: "session" }
        }
        // Trigger prompt system for session permission
        return { allowed: false, reason: "User confirmation required", scope: "session" }

      case "ask":
        // This will be handled by the prompt system
        return { allowed: false, reason: "User confirmation required" }

      default:
        return { allowed: false, reason: "Unknown permission mode" }
    }
  }

  /**
   * Grant session permission for an operation
   */
  grantSessionPermission(operation: GitOperation): void {
    this.sessionPermissions.grant(operation)
  }

  /**
   * Revoke session permission for an operation
   */
  revokeSessionPermission(operation: GitOperation): void {
    this.sessionPermissions.revoke(operation)
  }

  /**
   * Clear all session permissions
   */
  clearSessionPermissions(): void {
    this.sessionPermissions.clear()
  }

  /**
   * Get current session permissions
   */
  getSessionPermissions(): GitOperation[] {
    return this.sessionPermissions.list()
  }

  /**
   * Validate branch permissions
   */
  validateBranch(branch: string): boolean {
    const allowedBranches = this.config.git?.allowedBranches

    // If no restrictions, allow all branches
    if (!allowedBranches || allowedBranches.length === 0) {
      return true
    }

    // Check if current branch is in allowed list
    return allowedBranches.includes(branch)
  }

  /**
   * Check if author preservation is enabled
   */
  shouldPreserveAuthor(): boolean {
    return this.config.git?.preserveAuthor !== false
  }

  /**
   * Check if confirmation is required
   */
  requiresConfirmation(): boolean {
    return this.config.git?.requireConfirmation !== false
  }

  /**
   * Get maximum commit size
   */
  getMaxCommitSize(): number {
    return this.config.git?.maxCommitSize || 100
  }

  /**
   * Validate commit size
   */
  validateCommitSize(fileCount: number): boolean {
    const maxSize = this.getMaxCommitSize()
    return fileCount <= maxSize
  }

  /**
   * Get permission mode for a specific operation
   */
  private getPermissionMode(operation: GitOperation): PermissionMode {
    switch (operation) {
      case "commit":
        return this.config.git?.commitMode || "ask"
      case "push":
        return this.config.git?.pushMode || "never"
      case "config":
        return this.config.git?.configMode || "never"
      default:
        return "ask"
    }
  }

  /**
   * Get current configuration summary
   */
  getConfigSummary(): Record<string, any> {
    return {
      commitMode: this.config.git?.commitMode || "ask",
      pushMode: this.config.git?.pushMode || "never",
      configMode: this.config.git?.configMode || "never",
      preserveAuthor: this.config.git?.preserveAuthor !== false,
      requireConfirmation: this.config.git?.requireConfirmation !== false,
      allowedBranches: this.config.git?.allowedBranches || [],
      maxCommitSize: this.config.git?.maxCommitSize || 100,
      sessionPermissions: this.getSessionPermissions(),
    }
  }
}

/**
 * Create a GitPermissionManager instance
 */
export function createGitPermissionManager(config: AgentrcConfig): GitPermissionManager {
  return new GitPermissionManager(config)
}
