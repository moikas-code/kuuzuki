/**
 * Git context and repository information for Kuuzuki
 *
 * This module provides basic Git repository context and information
 * without complex permission management, keeping OpenCode parity.
 */

// Export git context functionality
export {
  GitContextProvider,
  createGitContextProvider,
  type GitStatus,
  type GitCommit,
  type GitConfig,
} from "./context.js"
