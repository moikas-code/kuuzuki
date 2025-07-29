import type { CommandModule } from "yargs"
import { verifyApiKey, recoverApiKey } from "../../auth/api"
import { saveAuth, clearAuth, getApiKey, validateApiKeyFormat, getKeyEnvironment, maskApiKey } from "../../auth/storage"
import { Config } from "../../config/config"
import { Providers } from "../../auth/providers"
import chalk from "chalk"

export const ApiKeyCommand = {
  command: "apikey <subcommand>",
  describe: "Manage API key authentication for Kuuzuki Pro",
  builder: (yargs) => {
    return yargs
      .command({
        command: "login",
        describe: "Set your API key",
        builder: {
          "api-key": {
            type: "string",
            describe: "Your Kuuzuki API key (kz_live_...)",
            demandOption: true,
          },
        },
        handler: async (args) => {
          await handleLogin(args["api-key"] as string)
        },
      })
      .command({
        command: "status",
        describe: "Check authentication status",
        builder: {
          "show-key": {
            type: "boolean",
            describe: "Show full API key",
            default: false,
          },
        },
        handler: async (args) => {
          await handleStatus(args["show-key"] as boolean)
        },
      })
      .command({
        command: "recover",
        describe: "Recover API key by email",
        builder: {
          email: {
            type: "string",
            describe: "Email associated with your subscription",
            demandOption: true,
          },
        },
        handler: async (args) => {
          await handleRecover(args["email"] as string)
        },
      })
      .command({
        command: "logout",
        describe: "Remove stored API key",
        handler: async () => {
          await handleLogout()
        },
      })
      .command({
        command: "provider <subcommand>",
        describe: "Manage AI provider API keys",
        builder: (yargs) => {
          return yargs
            .command({
              command: "add <provider> <key>",
              describe: "Add an AI provider API key",
              builder: {
                provider: {
                  type: "string",
                  describe: "Provider name (anthropic, openai, openrouter, github-copilot, amazon-bedrock)",
                  choices: ["anthropic", "openai", "openrouter", "github-copilot", "amazon-bedrock"],
                },
                key: {
                  type: "string",
                  describe: "API key for the provider",
                },
                "no-keychain": {
                  type: "boolean",
                  describe: "Don't store in system keychain",
                  default: false,
                },
              },
              handler: async (args) => {
                await handleProviderAdd(args["provider"] as string, args["key"] as string, !args["no-keychain"])
              },
            })
            .command({
              command: "list",
              describe: "List all stored provider API keys",
              handler: async () => {
                await handleProviderList()
              },
            })
            .command({
              command: "remove <provider>",
              describe: "Remove a provider API key",
              builder: {
                provider: {
                  type: "string",
                  describe: "Provider name to remove",
                  choices: ["anthropic", "openai", "openrouter", "github-copilot", "amazon-bedrock"],
                },
              },
              handler: async (args) => {
                await handleProviderRemove(args["provider"] as string)
              },
            })
            .command({
              command: "test [provider]",
              describe: "Test provider API key health",
              builder: {
                provider: {
                  type: "string",
                  describe: "Provider to test (tests all if not specified)",
                  choices: ["anthropic", "openai", "openrouter", "github-copilot", "amazon-bedrock"],
                },
              },
              handler: async (args) => {
                await handleProviderTest(args["provider"] as string)
              },
            })
            .demandCommand(1, "Please specify a provider subcommand")
        },
        handler: () => {},
      })
      .demandCommand(1, "Please specify a subcommand")
  },
  handler: () => {},
} satisfies CommandModule

async function handleLogin(apiKey: string) {
  try {
    // Validate format
    if (!validateApiKeyFormat(apiKey)) {
      console.log(chalk.red("❌ Invalid API key format"))
      console.log(chalk.gray("Expected format: kz_live_abc123... or kz_test_abc123..."))
      console.log(chalk.gray("Get your API key from: kuuzuki billing subscribe"))
      return
    }

    // Environment detection
    const environment = getKeyEnvironment(apiKey)!
    if (environment === "test") {
      console.log(chalk.yellow("⚠️  Using test API key"))
    }

    // API verification
    console.log(chalk.gray("Verifying API key..."))
    const result = await verifyApiKey(apiKey)

    if (!result.valid) {
      console.log(chalk.red("❌ API key verification failed"))
      console.log(chalk.red("The API key is invalid or expired"))
      console.log(chalk.gray("Try: kuuzuki apikey recover --email your@email.com"))
      return
    }

    // Save to local storage
    await saveAuth({
      apiKey,
      email: result.email!,
      savedAt: Date.now(),
      environment,
    })

    // Success feedback
    console.log(chalk.green("✅ Successfully authenticated!"))
    console.log(chalk.green(`✓ Logged in as ${result.email}`))
    console.log(chalk.gray(`Environment: ${environment}`))
    console.log(chalk.gray("You can now use Kuuzuki Pro features"))

    // Environment variable suggestion
    if (!process.env["KUUZUKI_API_KEY"]) {
      console.log()
      console.log(chalk.cyan("💡 Tip: Set environment variable for automatic authentication:"))
      console.log(chalk.gray(`export KUUZUKI_API_KEY=${apiKey}`))
    }
  } catch (error) {
    console.log(chalk.red("❌ Authentication failed"))
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : "Unknown error"}`))

    if (error instanceof Error && (error.message.includes("network") || error.message.includes("fetch"))) {
      console.log(chalk.gray("Check your internet connection and try again"))
    }
  }
}

async function handleStatus(showKey: boolean = false) {
  const apiKey = await getApiKey()

  if (!apiKey) {
    console.log(chalk.yellow("❌ Not authenticated"))
    console.log()
    console.log(chalk.white("Authentication options:"))
    console.log(chalk.gray("1. Environment variable: ") + chalk.cyan("export KUUZUKI_API_KEY=kz_live_..."))
    console.log(chalk.gray("2. Explicit login: ") + chalk.cyan("kuuzuki apikey login --api-key kz_live_..."))
    console.log(chalk.gray("3. Get API key: ") + chalk.cyan("kuuzuki billing subscribe"))
    console.log(chalk.gray("4. Recover API key: ") + chalk.cyan("kuuzuki apikey recover --email your@email.com"))
    return
  }

  try {
    console.log(chalk.gray("Checking API key status..."))

    const result = await verifyApiKey(apiKey)
    const environment = getKeyEnvironment(apiKey)
    const isFromEnv = !!process.env["KUUZUKI_API_KEY"]

    if (result.valid) {
      console.log(chalk.green("✅ Authenticated"))
      console.log()
      console.log(chalk.white("Account Details:"))
      console.log(chalk.gray(`Email: ${result.email}`))
      console.log(chalk.gray(`Status: ${result.status || "active"}`))
      console.log(chalk.gray(`Environment: ${environment}`))
      console.log(chalk.gray(`Source: ${isFromEnv ? "environment variable" : "stored locally"}`))

      // API Key display
      if (showKey) {
        console.log(chalk.gray(`API Key: ${apiKey}`))
      } else {
        const masked = maskApiKey(apiKey)
        console.log(chalk.gray(`API Key: ${masked}`))
        console.log(chalk.gray("Use --show-key to reveal full key"))
      }

      // Additional info
      console.log()
      console.log(chalk.white("Available Features:"))
      console.log(chalk.green("✓ Session sharing"))
      console.log(chalk.green("✓ Real-time sync"))
      console.log(chalk.green("✓ Persistent sessions"))

      // Environment variable status
      if (isFromEnv) {
        console.log()
        console.log(chalk.green("✓ Using environment variable KUUZUKI_API_KEY"))
      } else {
        console.log()
        console.log(chalk.yellow("💡 Consider setting environment variable:"))
        console.log(chalk.gray(`export KUUZUKI_API_KEY=${apiKey}`))
      }

      if (result.expiresAt) {
        const expiryDate = new Date(result.expiresAt).toLocaleDateString()
        console.log(chalk.gray(`Expires: ${expiryDate}`))
      }
    } else {
      console.log(chalk.red("❌ API key invalid"))
      console.log(chalk.red(`✗ API key for ${result.email || "unknown"} is no longer valid`))
      console.log(chalk.gray("Run 'kuuzuki billing portal' to manage your subscription"))
    }
  } catch (error) {
    console.log(chalk.red("❌ Failed to check status"))
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : "Unknown error"}`))
    console.log(chalk.gray("Try 'kuuzuki apikey logout' and login again"))
  }
}

async function handleRecover(email: string) {
  try {
    // Email validation
    if (!isValidEmail(email)) {
      console.log(chalk.red("❌ Invalid email format"))
      return
    }

    // API call to recover
    console.log(chalk.gray("Looking up API key..."))
    const result = await recoverApiKey(email)

    if (!result.apiKey) {
      console.log(chalk.yellow("❌ No API key found"))
      console.log(chalk.yellow(`No active subscription found for ${email}`))
      console.log()
      console.log(chalk.white("Possible reasons:"))
      console.log(chalk.gray("• Email not associated with a subscription"))
      console.log(chalk.gray("• Subscription has been canceled"))
      console.log(chalk.gray("• Different email used for subscription"))
      console.log()
      console.log(chalk.cyan("Get Kuuzuki Pro: kuuzuki billing subscribe"))
      return
    }

    // Success - show API key
    console.log(chalk.green("✅ API key found!"))
    console.log()
    console.log(chalk.green(`✓ API Key: ${result.apiKey}`))
    console.log()
    console.log(chalk.white("To use this API key:"))
    console.log()
    console.log(chalk.cyan("Option 1 (Recommended):"))
    console.log(chalk.gray(`export KUUZUKI_API_KEY=${result.apiKey}`))
    console.log()
    console.log(chalk.cyan("Option 2:"))
    console.log(chalk.gray(`kuuzuki apikey login --api-key ${result.apiKey}`))
    console.log()
    console.log(chalk.yellow("⚠️  Keep your API key secure and don't share it publicly"))
  } catch (error) {
    console.log(chalk.red("❌ Recovery failed"))
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : "Unknown error"}`))

    if (error instanceof Error && error.message.includes("not found")) {
      console.log(chalk.gray("Make sure you're using the correct email address"))
    }
  }
}

async function handleLogout() {
  await clearAuth()
  console.log(chalk.green("✅ Successfully logged out"))
  console.log(chalk.gray("Your local API key has been removed"))
  console.log(chalk.gray("Environment variable KUUZUKI_API_KEY (if set) is still active"))
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// AI Provider API Key Management Functions

async function handleProviderAdd(providerId: string, apiKey: string, useKeychain: boolean) {
  try {
    // Validate the API key format
    if (!Providers.validateProviderKey(providerId, apiKey)) {
      console.log(chalk.red("❌ Invalid API key format"))
      const provider = Providers.getProvider(providerId)
      if (provider) {
        console.log(chalk.gray(`Expected format for ${provider.name}: ${provider.keyFormat.source}`))
      }
      return
    }

    // Store the API key
    await Config.ApiKeys.store(providerId, apiKey, useKeychain)

    const provider = Providers.getProvider(providerId)
    const maskedKey = Providers.maskProviderKey(providerId, apiKey)

    console.log(chalk.green("✅ API key stored successfully!"))
    console.log(chalk.green(`✓ Provider: ${provider?.name || providerId}`))
    console.log(chalk.gray(`✓ Key: ${maskedKey}`))
    console.log(chalk.gray(`✓ Storage: ${useKeychain ? "system keychain" : "local file"}`))

    // Test the key
    console.log(chalk.gray("Testing API key..."))
    const healthResult = await Config.ApiKeys.healthCheck(providerId)

    if (healthResult.success) {
      console.log(chalk.green(`✅ API key is working! (${healthResult.responseTime}ms)`))
    } else {
      console.log(chalk.yellow(`⚠️  API key stored but health check failed: ${healthResult.error}`))
      console.log(chalk.gray("The key may still work for actual requests"))
    }
  } catch (error) {
    console.log(chalk.red("❌ Failed to store API key"))
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : "Unknown error"}`))
  }
}

async function handleProviderList() {
  try {
    const keys = await Config.ApiKeys.list()

    if (keys.length === 0) {
      console.log(chalk.yellow("No AI provider API keys stored"))
      console.log()
      console.log(chalk.white("To add a provider API key:"))
      console.log(chalk.cyan("kuuzuki apikey provider add <provider> <key>"))
      console.log()
      console.log(chalk.white("Supported providers:"))
      for (const provider of Providers.listSupportedProviders()) {
        console.log(chalk.gray(`• ${provider.name} (${provider.id})`))
      }
      return
    }

    console.log(chalk.white("Stored AI Provider API Keys:"))
    console.log()

    for (const key of keys) {
      const provider = Providers.getProvider(key.providerId)
      const statusIcon = key.healthStatus === "success" ? "✅" : key.healthStatus === "failed" ? "❌" : "❓"

      console.log(`${statusIcon} ${chalk.bold(provider?.name || key.providerId)}`)
      console.log(chalk.gray(`   Key: ${key.maskedKey}`))
      console.log(chalk.gray(`   Source: ${key.source}`))
      console.log(chalk.gray(`   Added: ${new Date(key.createdAt).toLocaleDateString()}`))

      if (key.lastUsed) {
        console.log(chalk.gray(`   Last used: ${new Date(key.lastUsed).toLocaleDateString()}`))
      }

      if (key.lastHealthCheck) {
        const status = key.healthStatus === "success" ? chalk.green("healthy") : chalk.red("unhealthy")
        console.log(chalk.gray(`   Health: ${status} (${new Date(key.lastHealthCheck).toLocaleDateString()})`))
      }

      console.log()
    }

    console.log(chalk.white("Commands:"))
    console.log(chalk.cyan("kuuzuki apikey provider test") + chalk.gray(" - Test all keys"))
    console.log(chalk.cyan("kuuzuki apikey provider remove <provider>") + chalk.gray(" - Remove a key"))
  } catch (error) {
    console.log(chalk.red("❌ Failed to list API keys"))
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : "Unknown error"}`))
  }
}

async function handleProviderRemove(providerId: string) {
  try {
    if (!Config.ApiKeys.hasKey(providerId)) {
      console.log(chalk.yellow(`No API key found for provider: ${providerId}`))
      return
    }

    await Config.ApiKeys.remove(providerId)

    const provider = Providers.getProvider(providerId)
    console.log(chalk.green("✅ API key removed successfully!"))
    console.log(chalk.gray(`✓ Provider: ${provider?.name || providerId}`))
  } catch (error) {
    console.log(chalk.red("❌ Failed to remove API key"))
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : "Unknown error"}`))
  }
}

async function handleProviderTest(providerId?: string) {
  try {
    if (providerId) {
      // Test single provider
      if (!Config.ApiKeys.hasKey(providerId)) {
        console.log(chalk.yellow(`No API key found for provider: ${providerId}`))
        return
      }

      const provider = Providers.getProvider(providerId)
      console.log(chalk.gray(`Testing ${provider?.name || providerId}...`))

      const result = await Config.ApiKeys.healthCheck(providerId)

      if (result.success) {
        console.log(chalk.green(`✅ ${provider?.name || providerId} - API key is working!`))
        console.log(chalk.gray(`   Response time: ${result.responseTime}ms`))
      } else {
        console.log(chalk.red(`❌ ${provider?.name || providerId} - API key failed`))
        console.log(chalk.red(`   Error: ${result.error}`))
      }
    } else {
      // Test all providers
      const availableProviders = Config.ApiKeys.getAvailableProviders()

      if (availableProviders.length === 0) {
        console.log(chalk.yellow("No API keys to test"))
        console.log(chalk.gray("Add API keys with: kuuzuki apikey provider add <provider> <key>"))
        return
      }

      console.log(chalk.white("Testing all provider API keys..."))
      console.log()

      const results = await Config.ApiKeys.healthCheckAll()

      for (const providerId of availableProviders) {
        const provider = Providers.getProvider(providerId)
        const result = results[providerId]

        if (result.success) {
          console.log(chalk.green(`✅ ${provider?.name || providerId} - Working (${result.responseTime}ms)`))
        } else {
          console.log(chalk.red(`❌ ${provider?.name || providerId} - Failed`))
          console.log(chalk.gray(`   Error: ${result.error}`))
        }
      }

      const successCount = Object.values(results).filter((r) => r.success).length
      const totalCount = availableProviders.length

      console.log()
      console.log(chalk.white(`Results: ${successCount}/${totalCount} providers working`))
    }
  } catch (error) {
    console.log(chalk.red("❌ Failed to test API keys"))
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : "Unknown error"}`))
  }
}
