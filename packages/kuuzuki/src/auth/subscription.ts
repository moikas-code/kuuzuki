import { getApiKey } from "./storage"
import { verifyApiKey } from "./api"
import { Config } from "../config/config"
import chalk from "chalk"

export interface SubscriptionStatus {
  hasSubscription: boolean
  needsRefresh: boolean
  message?: string
}

export async function checkSubscription(): Promise<SubscriptionStatus> {
  const config = await Config.get()

  // Self-hosted check
  const apiUrl = process.env["KUUZUKI_API_URL"] || config.apiUrl || "https://api.kuuzuki.ai"
  if (apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1")) {
    return { hasSubscription: true, needsRefresh: false }
  }

  // Check if subscription is disabled in config
  if (config.subscriptionRequired === false) {
    return { hasSubscription: true, needsRefresh: false }
  }

  // Get API key
  const apiKey = await getApiKey()
  if (!apiKey) {
    return {
      hasSubscription: false,
      needsRefresh: false,
      message: "No API key found. Set KUUZUKI_API_KEY or run 'kuuzuki apikey login --api-key kz_live_...'",
    }
  }

  try {
    const result = await verifyApiKey(apiKey)
    if (!result.valid) {
      return {
        hasSubscription: false,
        needsRefresh: false,
        message: "Invalid API key. Run 'kuuzuki apikey recover --email your@email.com' to get your key",
      }
    }

    return { hasSubscription: true, needsRefresh: false }
  } catch (error) {
    return {
      hasSubscription: false,
      needsRefresh: true,
      message: "Could not verify API key. Check your internet connection.",
    }
  }
}

export function showSubscriptionPrompt() {
  console.log()
  console.log(chalk.yellow("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"))
  console.log(chalk.yellow.bold("  🚀 Kuuzuki Pro Required"))
  console.log()
  console.log(chalk.white("  Set your API key to continue:"))
  console.log()
  console.log(chalk.cyan("  export KUUZUKI_API_KEY=kz_live_..."))
  console.log(chalk.gray("  or"))
  console.log(chalk.cyan("  kuuzuki apikey login --api-key kz_live_..."))
  console.log()
  console.log(chalk.white("  Don't have an API key?"))
  console.log(chalk.cyan("  kuuzuki billing subscribe"))
  console.log()
  console.log(chalk.white("  Unlock unlimited sharing:"))
  console.log(chalk.gray("  • Real-time session sync"))
  console.log(chalk.gray("  • Shareable links"))
  console.log(chalk.gray("  • Persistent sessions"))
  console.log(chalk.gray("  • Priority support"))
  console.log()
  console.log(chalk.cyan("  Only $5/month"))
  console.log(chalk.yellow("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"))
  console.log()
}
