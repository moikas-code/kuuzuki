import { getAuth, isAuthValid } from "./storage"
import { verifyLicense } from "./api"
import { Config } from "../config/config"
import chalk from "chalk"

export interface SubscriptionStatus {
  hasSubscription: boolean
  needsRefresh: boolean
  message?: string
}

export async function checkSubscription(): Promise<SubscriptionStatus> {
  // Check if share feature requires subscription
  const config = await Config.get()
  
  // If API URL is not configured or is localhost, assume self-hosted
  const apiUrl = process.env.KUUZUKI_API_URL || config.apiUrl || "https://api.kuuzuki.ai"
  if (apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1")) {
    return { hasSubscription: true, needsRefresh: false }
  }
  
  // Check if subscription is disabled in config
  if (config.subscriptionRequired === false) {
    return { hasSubscription: true, needsRefresh: false }
  }
  
  // Get local auth
  const auth = await getAuth()
  if (!auth) {
    return {
      hasSubscription: false,
      needsRefresh: false,
      message: "No subscription found. Run 'kuuzuki billing subscribe' to get Kuuzuki Pro ($5/month)",
    }
  }
  
  // Check if we need to refresh from API
  const needsRefresh = !isAuthValid(auth)
  
  if (needsRefresh) {
    try {
      const result = await verifyLicense(auth.license)
      if (!result.valid) {
        return {
          hasSubscription: false,
          needsRefresh: false,
          message: "Subscription expired. Run 'kuuzuki billing portal' to update payment method",
        }
      }
      
      // Update local cache
      await import("./storage").then(({ saveAuth }) =>
        saveAuth({
          ...auth,
          validatedAt: Date.now(),
          status: result.status || "active",
        })
      )
      
      return { hasSubscription: true, needsRefresh: false }
    } catch (error) {
      // If API is unreachable, use cached status
      if (auth.status === "active") {
        return { hasSubscription: true, needsRefresh: true }
      }
      
      return {
        hasSubscription: false,
        needsRefresh: true,
        message: "Could not verify subscription. Check your internet connection.",
      }
    }
  }
  
  // Use cached status
  return { hasSubscription: auth.status === "active", needsRefresh: false }
}

export function showSubscriptionPrompt() {
  console.log()
  console.log(chalk.yellow("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"))
  console.log(chalk.yellow.bold("  🚀 Upgrade to Kuuzuki Pro"))
  console.log()
  console.log(chalk.white("  Unlock unlimited sharing with:"))
  console.log(chalk.gray("  • Real-time session sync"))
  console.log(chalk.gray("  • Shareable links"))
  console.log(chalk.gray("  • Persistent sessions"))
  console.log(chalk.gray("  • Priority support"))
  console.log()
  console.log(chalk.cyan("  Only $5/month"))
  console.log()
  console.log(chalk.white("  Run: ") + chalk.cyan.bold("kuuzuki billing subscribe"))
  console.log(chalk.yellow("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"))
  console.log()
}