import Stripe from "stripe"
import { createLicenseKey, storeLicense, getLicenseByCustomerId, updateLicenseStatus } from "./license"
import { sendLicenseEmail } from "./email"

export async function handleStripeWebhook(
  event: Stripe.Event,
  kv: KVNamespace,
  env?: { EMAIL_API_URL?: string; EMAIL_API_KEY?: string }
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== "subscription") return

      const customerId = session.customer as string
      const subscriptionId = session.subscription as string
      const email = session.customer_email || session.customer_details?.email

      if (!email) {
        console.error("No email found in checkout session")
        return
      }

      // Check if license already exists for this customer
      const existingLicense = await getLicenseByCustomerId(kv, customerId)
      if (existingLicense) {
        console.log("License already exists for customer", customerId)
        return
      }

      // Create new license
      const licenseKey = createLicenseKey()
      await storeLicense(kv, {
        key: licenseKey,
        email,
        customerId,
        subscriptionId,
        status: "active",
        createdAt: Date.now(),
        metadata: {
          clientReferenceId: session.client_reference_id,
        },
      })

      console.log("Created license", licenseKey, "for", email)
      
      // Send license key via email
      await sendLicenseEmail({
        email,
        licenseKey,
        customerId,
      }, env)
      break
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      const license = await getLicenseByCustomerId(kv, customerId)
      if (!license) {
        console.error("No license found for customer", customerId)
        return
      }

      // Map Stripe status to our status
      let status: "active" | "canceled" | "past_due" | "incomplete" = "active"
      switch (subscription.status) {
        case "active":
          status = "active"
          break
        case "canceled":
          status = "canceled"
          break
        case "past_due":
          status = "past_due"
          break
        case "incomplete":
        case "incomplete_expired":
          status = "incomplete"
          break
      }

      await updateLicenseStatus(kv, license.key, status)
      console.log("Updated license status", license.key, status)
      break
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      const license = await getLicenseByCustomerId(kv, customerId)
      if (!license) {
        console.error("No license found for customer", customerId)
        return
      }

      await updateLicenseStatus(kv, license.key, "canceled")
      console.log("Canceled license", license.key)
      break
    }

    default:
      console.log("Unhandled webhook event type:", event.type)
  }
}