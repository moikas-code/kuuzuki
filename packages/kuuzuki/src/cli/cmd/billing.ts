import type { CommandModule } from "yargs"
import { verifyLicense, activateLicense, createCheckoutSession, createPortalSession } from "../../auth/api"
import { saveAuth, getAuth, clearAuth } from "../../auth/storage"
import * as UI from "../ui"
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
          await handleSubscribe(args.email as string | undefined)
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
        describe: "Authenticate with your license key",
        builder: {
          email: {
            type: "string",
            describe: "Email associated with the license",
            demandOption: true,
          },
          license: {
            type: "string",
            describe: "License key (XXXX-XXXX-XXXX-XXXX)",
            demandOption: true,
          },
        },
        handler: async (args) => {
          await handleLogin(args.email as string, args.license as string)
        },
      })
      .command({
        command: "status",
        describe: "Check subscription status",
        handler: async () => {
          await handleStatus()
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
  const spinner = UI.spinner()
  
  try {
    spinner.start("Creating checkout session...")
    
    const result = await createCheckoutSession(email)
    
    spinner.succeed("Checkout session created!")
    console.log(chalk.green("\n✓ Opening browser to complete subscription..."))
    console.log(chalk.gray("If browser doesn't open, visit:"))
    console.log(chalk.cyan(result.checkoutUrl))
    
    await open(result.checkoutUrl)
    
    console.log(chalk.gray("\nAfter completing payment, you'll receive your license key via email."))
    console.log(chalk.gray("Then run: kuuzuki billing login --email your@email.com --license XXXX-XXXX-XXXX-XXXX"))
  } catch (error) {
    spinner.fail("Failed to create checkout session")
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : "Unknown error"}`))
    process.exit(1)
  }
}

async function handlePortal() {
  const auth = await getAuth()
  
  if (!auth) {
    console.log(chalk.yellow("Not authenticated"))
    console.log(chalk.gray("\nRun 'kuuzuki billing login' to authenticate first"))
    return
  }
  
  const spinner = UI.spinner()
  
  try {
    spinner.start("Creating portal session...")
    
    const result = await createPortalSession(auth.license)
    
    spinner.succeed("Portal session created!")
    console.log(chalk.green("\n✓ Opening browser to billing portal..."))
    console.log(chalk.gray("If browser doesn't open, visit:"))
    console.log(chalk.cyan(result.portalUrl))
    
    await open(result.portalUrl)
  } catch (error) {
    spinner.fail("Failed to create portal session")
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : "Unknown error"}`))
    process.exit(1)
  }
}

async function handleLogin(email: string, licenseKey: string) {
  const spinner = UI.spinner()
  
  try {
    spinner.start("Verifying license...")
    
    // First verify the license exists
    const verifyResult = await verifyLicense(licenseKey)
    
    if (!verifyResult.valid) {
      spinner.fail("Invalid license key")
      console.log(chalk.red("\nThe license key is invalid or expired."))
      console.log(chalk.gray("Please check your email for the correct license key."))
      process.exit(1)
    }
    
    // Then activate it with the email
    const activateResult = await activateLicense(email, licenseKey)
    
    if (!activateResult.success) {
      spinner.fail("Failed to activate license")
      console.log(chalk.red("\nThe license could not be activated."))
      console.log(chalk.gray("Make sure the email matches the one used for purchase."))
      process.exit(1)
    }
    
    // Save to local storage
    await saveAuth({
      license: licenseKey,
      email: email,
      validatedAt: Date.now(),
      status: activateResult.status,
    })
    
    spinner.succeed("Successfully authenticated!")
    console.log(chalk.green(`\n✓ Logged in as ${email}`))
    console.log(chalk.gray("Your Kuuzuki Pro subscription is active."))
    console.log(chalk.gray("You can now use unlimited share features!"))
  } catch (error) {
    spinner.fail("Authentication failed")
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : "Unknown error"}`))
    process.exit(1)
  }
}

async function handleStatus() {
  const auth = await getAuth()
  
  if (!auth) {
    console.log(chalk.yellow("Not authenticated"))
    console.log(chalk.gray("\nRun 'kuuzuki billing login' to authenticate"))
    console.log(chalk.gray("Or 'kuuzuki billing subscribe' to get Kuuzuki Pro"))
    return
  }
  
  const spinner = UI.spinner()
  
  try {
    spinner.start("Checking subscription status...")
    
    const result = await verifyLicense(auth.license)
    
    if (result.valid) {
      spinner.succeed("Subscription active")
      console.log(chalk.green(`\n✓ Authenticated as ${auth.email}`))
      console.log(chalk.gray(`Status: ${result.status || "active"}`))
      console.log(chalk.gray("Plan: Kuuzuki Pro ($5/month)"))
      
      if (result.expiresAt) {
        const expiryDate = new Date(result.expiresAt).toLocaleDateString()
        console.log(chalk.gray(`Expires: ${expiryDate}`))
      }
    } else {
      spinner.fail("Subscription inactive")
      console.log(chalk.red(`\n✗ Subscription for ${auth.email} is no longer active`))
      console.log(chalk.gray("Run 'kuuzuki billing portal' to update payment method"))
    }
  } catch (error) {
    spinner.fail("Failed to check status")
    console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : "Unknown error"}`))
    console.log(chalk.gray("Try 'kuuzuki billing logout' and login again."))
  }
}

async function handleLogout() {
  await clearAuth()
  console.log(chalk.green("✓ Successfully logged out"))
  console.log(chalk.gray("Your local authentication has been removed."))
}