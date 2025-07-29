import { confirm, select } from "@clack/prompts"
import { cmd } from "./cmd.js"
import { createGitSafetySystem } from "../../git/index.js"
import { parseAgentrc, DEFAULT_AGENTRC, type AgentrcConfig } from "../../config/agentrc.js"
import { Log } from "../../util/log.js"

const log = Log.create({ service: "GitPermissionsCommand" })

/**
 * Load .agentrc configuration from current directory
 */
async function loadAgentrcConfig(): Promise<AgentrcConfig> {
  try {
    const file = Bun.file(".agentrc")
    if (await file.exists()) {
      const content = await file.text()
      return parseAgentrc(content)
    }
  } catch (error) {
    log.warn("Failed to load .agentrc, using defaults", { error: String(error) })
  }

  return DEFAULT_AGENTRC as AgentrcConfig
}

/**
 * Save .agentrc configuration to current directory
 */
async function saveAgentrcConfig(config: AgentrcConfig): Promise<void> {
  try {
    const content = JSON.stringify(config, null, 2)
    await Bun.write(".agentrc", content)
    console.log("✅ Configuration saved to .agentrc")
  } catch (error) {
    console.error("❌ Failed to save configuration:", error)
    throw error
  }
}

/**
 * Git permissions status command
 */
export const GitPermissionsStatusCommand = cmd({
  command: "git status",
  describe: "Show current Git permission settings",
  handler: async () => {
    try {
      const config = await loadAgentrcConfig()
      const gitSafety = createGitSafetySystem(config)

      console.log("\n🔐 Git Permission Status\n")

      const summary = await gitSafety.getPermissionSummary()

      console.log("📋 Current Settings:")
      console.log(`   Commits:     ${summary["commitMode"]}`)
      console.log(`   Pushes:      ${summary["pushMode"]}`)
      console.log(`   Config:      ${summary["configMode"]}`)
      console.log(`   Preserve Author: ${summary["preserveAuthor"] ? "Yes" : "No"}`)
      console.log(`   Require Confirmation: ${summary["requireConfirmation"] ? "Yes" : "No"}`)
      console.log(`   Max Commit Size: ${summary["maxCommitSize"]} files`)

      if (summary["allowedBranches"].length > 0) {
        console.log(`   Allowed Branches: ${summary["allowedBranches"].join(", ")}`)
      } else {
        console.log("   Allowed Branches: All branches")
      }

      if (summary["sessionPermissions"].length > 0) {
        console.log(`\n🔓 Active Session Permissions: ${summary["sessionPermissions"].join(", ")}`)
      }
      // Show repository status if in a Git repo
      const repoStatus = await gitSafety.getRepositoryStatus()
      if (repoStatus) {
        console.log(`\n📁 Repository Status:`)
        console.log(`   Branch: ${repoStatus.branch}`)
        console.log(`   Status: ${repoStatus.clean ? "Clean" : "Has changes"}`)
        if (!repoStatus.clean) {
          console.log(`   Staged: ${repoStatus.staged.length} files`)
          console.log(`   Unstaged: ${repoStatus.unstaged.length} files`)
          console.log(`   Untracked: ${repoStatus.untracked.length} files`)
        }
      }

      console.log()
    } catch (error) {
      console.error("❌ Failed to get Git permission status:", error)
      process.exit(1)
    }
  },
})

/**
 * Git permissions allow command
 */
export const GitPermissionsAllowCommand = cmd({
  command: "git allow <operation>",
  describe: "Allow Git operations for this project",
  builder: (yargs) => {
    return yargs.positional("operation", {
      describe: "Git operation to allow",
      choices: ["commits", "pushes", "config", "all"],
      type: "string",
      demandOption: true,
    })
  },
  handler: async (args) => {
    try {
      const config = await loadAgentrcConfig()
      const operation = args.operation as string

      console.log(`\n🔓 Allowing ${operation} for this project\n`)

      const confirmed = await confirm({
        message: `Are you sure you want to allow ${operation} for this project?`,
        initialValue: false,
      })

      if (!confirmed) {
        console.log("❌ Operation cancelled")
        return
      }

      // Update configuration
      const newConfig = { ...config }
      if (!newConfig.git) {
        newConfig.git = {
          commitMode: "ask" as const,
          pushMode: "never" as const,
          configMode: "never" as const,
          preserveAuthor: true,
          requireConfirmation: true,
          maxCommitSize: 100,
        }
      }

      switch (operation) {
        case "commits":
          newConfig.git.commitMode = "project"
          break
        case "pushes":
          newConfig.git.pushMode = "project"
          break
        case "config":
          newConfig.git.configMode = "project"
          break
        case "all":
          newConfig.git.commitMode = "project"
          newConfig.git.pushMode = "project"
          newConfig.git.configMode = "project"
          break
      }
      await saveAgentrcConfig(newConfig)
      console.log(`✅ ${operation} allowed for this project`)
    } catch (error) {
      console.error("❌ Failed to allow Git operations:", error)
      process.exit(1)
    }
  },
})

/**
 * Git permissions deny command
 */
export const GitPermissionsDenyCommand = cmd({
  command: "git deny <operation>",
  describe: "Deny Git operations for this project",
  builder: (yargs) => {
    return yargs.positional("operation", {
      describe: "Git operation to deny",
      choices: ["commits", "pushes", "config", "all"],
      type: "string",
      demandOption: true,
    })
  },
  handler: async (args) => {
    try {
      const config = await loadAgentrcConfig()
      const operation = args.operation as string

      console.log(`\n🔒 Denying ${operation} for this project\n`)

      const confirmed = await confirm({
        message: `Are you sure you want to deny ${operation} for this project?`,
        initialValue: false,
      })

      if (!confirmed) {
        console.log("❌ Operation cancelled")
        return
      }

      // Update configuration
      const newConfig = { ...config }
      if (!newConfig.git) {
        newConfig.git = {
          commitMode: "ask" as const,
          pushMode: "never" as const,
          configMode: "never" as const,
          preserveAuthor: true,
          requireConfirmation: true,
          maxCommitSize: 100,
        }
      }

      switch (operation) {
        case "commits":
          newConfig.git.commitMode = "never"
          break
        case "pushes":
          newConfig.git.pushMode = "never"
          break
        case "config":
          newConfig.git.configMode = "never"
          break
        case "all":
          newConfig.git.commitMode = "never"
          newConfig.git.pushMode = "never"
          newConfig.git.configMode = "never"
          break
      }
      await saveAgentrcConfig(newConfig)
      console.log(`✅ ${operation} denied for this project`)
    } catch (error) {
      console.error("❌ Failed to deny Git operations:", error)
      process.exit(1)
    }
  },
})

/**
 * Git permissions reset command
 */
export const GitPermissionsResetCommand = cmd({
  command: "git reset",
  describe: "Reset Git permissions to defaults (ask for confirmation)",
  handler: async () => {
    try {
      console.log("\n🔄 Resetting Git permissions to defaults\n")

      const confirmed = await confirm({
        message: "Are you sure you want to reset all Git permissions to defaults?",
        initialValue: false,
      })

      if (!confirmed) {
        console.log("❌ Operation cancelled")
        return
      }

      const config = await loadAgentrcConfig()
      const newConfig = {
        ...config,
        git: {
          commitMode: "ask" as const,
          pushMode: "never" as const,
          configMode: "never" as const,
          preserveAuthor: true,
          requireConfirmation: true,
          maxCommitSize: 100,
        },
      }

      await saveAgentrcConfig(newConfig)
      console.log("✅ Git permissions reset to defaults")
    } catch (error) {
      console.error("❌ Failed to reset Git permissions:", error)
      process.exit(1)
    }
  },
})

/**
 * Git permissions configure command
 */
export const GitPermissionsConfigureCommand = cmd({
  command: "git configure",
  describe: "Interactively configure Git permissions",
  handler: async () => {
    try {
      console.log("\n⚙️  Git Permissions Configuration\n")

      const config = await loadAgentrcConfig()
      const currentGit = config.git || DEFAULT_AGENTRC.git!

      // Configure commit mode
      const commitMode = await select({
        message: "How should commits be handled?",
        options: [
          { value: "never", label: "Never allow commits", hint: "Completely disable commits" },
          { value: "ask", label: "Ask for permission", hint: "Prompt for each commit (default)" },
          { value: "session", label: "Allow for session", hint: "Allow after first approval" },
          { value: "project", label: "Always allow", hint: "Allow all commits in this project" },
        ],
        initialValue: currentGit.commitMode,
      })

      // Configure push mode
      const pushMode = await select({
        message: "How should pushes be handled?",
        options: [
          { value: "never", label: "Never allow pushes", hint: "Completely disable pushes (default)" },
          { value: "ask", label: "Ask for permission", hint: "Prompt for each push" },
          { value: "session", label: "Allow for session", hint: "Allow after first approval" },
          { value: "project", label: "Always allow", hint: "Allow all pushes in this project" },
        ],
        initialValue: currentGit.pushMode,
      })

      // Configure config mode
      const configMode = await select({
        message: "How should Git config changes be handled?",
        options: [
          { value: "never", label: "Never allow config changes", hint: "Completely disable config changes (default)" },
          { value: "ask", label: "Ask for permission", hint: "Prompt for each config change" },
          { value: "session", label: "Allow for session", hint: "Allow after first approval" },
          { value: "project", label: "Always allow", hint: "Allow all config changes in this project" },
        ],
        initialValue: currentGit.configMode,
      })

      // Configure author preservation
      const preserveAuthor = await confirm({
        message: "Preserve existing Git author settings?",
        initialValue: currentGit.preserveAuthor,
      })

      // Configure confirmation requirement
      const requireConfirmation = await confirm({
        message: "Always show commit preview before committing?",
        initialValue: currentGit.requireConfirmation,
      })

      // Save configuration
      const newConfig = {
        ...config,
        git: {
          commitMode: commitMode as any,
          pushMode: pushMode as any,
          configMode: configMode as any,
          preserveAuthor: preserveAuthor as boolean,
          requireConfirmation: requireConfirmation as boolean,
          maxCommitSize: currentGit.maxCommitSize || 100,
          allowedBranches: currentGit.allowedBranches,
        },
      }

      await saveAgentrcConfig(newConfig)
      console.log("\n✅ Git permissions configured successfully")
    } catch (error) {
      console.error("❌ Failed to configure Git permissions:", error)
      process.exit(1)
    }
  },
})
