import { checkSubscription } from "./subscription"
import { Log } from "../util/log"
import chalk from "chalk"

const log = Log.create({ service: "feature-gate" })

export class SubscriptionRequiredError extends Error {
  constructor(feature: string = "This feature") {
    super(`${feature} requires a Kuuzuki Pro subscription`)
    this.name = "SubscriptionRequiredError"
  }
}

export interface FeatureGateOptions {
  feature: string
  allowSelfHosted?: boolean
  silentFail?: boolean
}

/**
 * Check if the current environment is self-hosted
 */
export function isSelfHosted(): boolean {
  // Check for common self-hosted indicators
  if (process.env["KUUZUKI_SELF_HOSTED"] === "true") return true
  if (process.env["NODE_ENV"] === "development") return true
  
  // Check if running on localhost
  const apiUrl = process.env["KUUZUKI_API_URL"] || ""
  if (apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1")) return true
  
  return false
}

/**
 * Check if user has an active pro subscription
 */
export async function hasProSubscription(): Promise<boolean> {
  try {
    const status = await checkSubscription()
    return status.hasSubscription
  } catch (error) {
    log.error("Failed to check subscription status", { error })
    return false
  }
}

/**
 * Require pro subscription for a feature
 * Throws SubscriptionRequiredError if no active subscription
 */
export async function requireProSubscription(options: FeatureGateOptions): Promise<void> {
  const { feature, allowSelfHosted = true, silentFail = false } = options

  // Allow self-hosted instances to bypass
  if (allowSelfHosted && isSelfHosted()) {
    log.debug("Bypassing subscription check for self-hosted instance")
    return
  }

  const hasSubscription = await hasProSubscription()
  
  if (!hasSubscription) {
    const error = new SubscriptionRequiredError(feature)
    
    if (!silentFail) {
      console.log()
      console.log(chalk.yellow("⚠️  Pro Feature Required"))
      console.log(chalk.gray(`${feature} requires a Kuuzuki Pro subscription.`))
      console.log()
      console.log(chalk.cyan("To unlock this feature:"))
      console.log(chalk.gray("1. Subscribe to Kuuzuki Pro: ") + chalk.cyan("kuuzuki billing subscribe"))
      console.log(chalk.gray("2. Set your API key: ") + chalk.cyan("export KUUZUKI_API_KEY=kz_live_..."))
      console.log()
      console.log(chalk.gray("Learn more at ") + chalk.cyan("https://kuuzuki.com/pro"))
      console.log()
    }
    
    throw error
  }
}

/**
 * Check if a feature should be enabled based on subscription status
 * Returns false instead of throwing for use in conditional logic
 */
export async function isFeatureEnabled(
  feature: string,
  allowSelfHosted: boolean = true
): Promise<boolean> {
  try {
    await requireProSubscription({ feature, allowSelfHosted, silentFail: true })
    return true
  } catch {
    return false
  }
}

/**
 * Decorator for methods that require pro subscription
 */
export function RequiresPro(feature: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      await requireProSubscription({ feature })
      return originalMethod.apply(this, args)
    }

    return descriptor
  }
}

/**
 * Get user-friendly feature status message
 */
export async function getFeatureStatusMessage(feature: string): Promise<string> {
  const isEnabled = await isFeatureEnabled(feature)
  
  if (isEnabled) {
    return `✅ ${feature} is enabled`
  } else if (isSelfHosted()) {
    return `🏠 ${feature} is available (self-hosted)`
  } else {
    return `🔒 ${feature} requires Kuuzuki Pro`
  }
}