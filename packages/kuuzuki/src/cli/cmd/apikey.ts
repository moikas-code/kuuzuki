import type { CommandModule } from "yargs"
import { verifyApiKey, recoverApiKey } from "../../auth/api"
import { saveAuth, clearAuth, getApiKey, validateApiKeyFormat, getKeyEnvironment, maskApiKey } from "../../auth/storage"
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
