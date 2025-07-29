import type { CommandModule } from "yargs"
import { createCheckoutSession } from "../../auth/api"
import { clearAuth } from "../../auth/storage"
import chalk from "chalk"
import open from "open"

export const BillingCommand = {
  command: "billing <subcommand>",
  describe: "Manage subscription and billing",
  builder: (yargs) => {
    return yargs
      .command({
        command: "subscribe",
        describe: "Subscribe to Kuuzuki Pro",
        builder: {
          email: {
            type: "string",
            describe: "Email for the subscription",
          },
        },
        handler: async (args) => {
          await handleSubscribe(args["email"] as string | undefined)
        },
      })
      .command({
        command: "portal",
        describe: "Open billing portal to manage subscription",
        handler: async () => {
          await handlePortal()
        },
      })
      .command({
        command: "login",
        describe: "Authenticate with your API key (use 'kuuzuki apikey login' instead)",
        handler: async () => {
          console.log(chalk.yellow("⚠️  The 'billing login' command has been replaced"))
          console.log()
          console.log(chalk.white("Use the new API key authentication:"))
          console.log(chalk.cyan("kuuzuki apikey login --api-key kz_live_..."))
          console.log()
          console.log(chalk.white("Or set environment variable:"))
          console.log(chalk.cyan("export KUUZUKI_API_KEY=kz_live_..."))
          console.log()
          console.log(chalk.gray("Need your API key? Run: kuuzuki apikey recover --email your@email.com"))
        },
      })
      .command({
        command: "status",
        describe: "Check subscription status (use 'kuuzuki apikey status' instead)",
        handler: async () => {
          console.log(chalk.yellow("⚠️  The 'billing status' command has been replaced"))
          console.log()
          console.log(chalk.white("Use the new API key status:"))
          console.log(chalk.cyan("kuuzuki apikey status"))
          console.log()
          console.log(chalk.gray("Or check with full key: kuuzuki apikey status --show-key"))
        },
      })
      .command({
        command: "logout",
        describe: "Remove authentication",
        handler: async () => {
          await handleLogout()
        },
      })
      .demandCommand(1, "Please specify a subcommand")
  },
  handler: () => {},
} satisfies CommandModule

async function handleSubscribe(email?: string) {
  try {
    console.log(chalk.gray("Creating checkout session..."))

    const result = await createCheckoutSession(email)

    console.log(chalk.green("✓ Opening browser to complete subscription..."))
    console.log(chalk.gray("If browser doesn't open, visit:"))
    console.log(chalk.cyan(result.checkoutUrl))

    await open(result.checkoutUrl)

    console.log(chalk.gray("\nAfter completing payment, you'll receive your API key via email."))
    console.log(chalk.gray("Then set: export KUUZUKI_API_KEY=kz_live_..."))
    console.log(chalk.gray("Or run: kuuzuki apikey login --api-key kz_live_..."))
  } catch (error) {
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : "Unknown error"}`))
    process.exit(1)
  }
}
async function handlePortal() {
  console.log(chalk.yellow("⚠️  Portal access has been updated"))
  console.log()
  console.log(chalk.white("To access your billing portal:"))
  console.log(chalk.cyan("1. First authenticate: kuuzuki apikey status"))
  console.log(chalk.cyan("2. Then access portal: kuuzuki billing portal"))
  console.log()
  console.log(chalk.gray("Need your API key? Run: kuuzuki apikey recover --email your@email.com"))
}
async function handleLogout() {
  await clearAuth()
  console.log(chalk.green("✓ Successfully logged out"))
  console.log(chalk.gray("Your local authentication has been removed."))
}
