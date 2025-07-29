/**
 * Git permission and safety system for Kuuzuki
 *
 * This module provides a comprehensive Git permission system that prevents
 * accidental commits, pushes, and configuration changes by requiring explicit
 * user consent at different scopes (once, session, or project-wide).
 */

// Export all types and classes
export {
  GitPermissionManager,
  createGitPermissionManager,
  type GitOperation,
  type PermissionMode,
  type GitOperationContext,
  type PermissionResult,
} from "./permissions.js"

export { GitPromptSystem, createGitPromptSystem, type PermissionScope, type PromptResult } from "./prompts.js"

export {
  GitContextProvider,
  createGitContextProvider,
  type GitStatus,
  type GitCommit,
  type GitConfig,
} from "./context.js"

export { SafeGitOperations, createSafeGitOperations, type GitOperationResult } from "./operations.js"

// Import for internal use
import { SafeGitOperations } from "./operations.js"
import { GitPromptSystem } from "./prompts.js"
import type { AgentrcConfig } from "../config/agentrc.js"

/**
 * Create a complete Git safety system with all components
 */
export function createGitSafetySystem(config: AgentrcConfig) {
  const operations = new SafeGitOperations(config)
  const permissionManager = operations.getPermissionManager()
  const contextProvider = operations.getContextProvider()
  const promptSystem = new GitPromptSystem()

  return {
    operations,
    permissionManager,
    contextProvider,
    promptSystem,

    // Convenience methods
    async safeCommit(message: string, files?: string[], options?: any) {
      return operations.commit(message, files, options)
    },

    async safePush(remote?: string, branch?: string, options?: any) {
      return operations.push(remote, branch, options)
    },

    async getPermissionSummary() {
      return permissionManager.getConfigSummary()
    },

    async getRepositoryStatus() {
      return contextProvider.getStatus()
    },
  }
}
