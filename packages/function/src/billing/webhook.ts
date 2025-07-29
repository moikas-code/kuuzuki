import Stripe from "stripe"
import { createApiKey, storeApiKey, getApiKeyByCustomerId, updateApiKeyStatus } from "./apikey"
import { sendApiKeyEmail } from "./email"
import type { KVNamespace } from "../types/kv"

export async function handleStripeWebhook(
  event: Stripe.Event,
  kv: KVNamespace,
  env?: { EMAIL_API_URL?: string; EMAIL_API_KEY?: string },
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

      // Check if API key already exists for this customer
      const existingApiKey = await getApiKeyByCustomerId(kv, customerId)
      if (existingApiKey) {
        console.log("API key already exists for customer", customerId)
        return
      }

      // Create new API key
      const apiKey = createApiKey("live")
      await storeApiKey(kv, {
        key: apiKey,
        email,
        customerId,
        subscriptionId,
        status: "active",
        scopes: ["sharing"],
        createdAt: Date.now(),
        metadata: {
          clientReferenceId: session.client_reference_id,
          version: "1.0.0",
        },
      })

      console.log("Created API key", apiKey, "for", email)

      // Send API key via email
      await sendApiKeyEmail(
        {
          email,
          apiKey,
          customerId,
        },
        env,
      )
      break
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      const apiKey = await getApiKeyByCustomerId(kv, customerId)
      if (!apiKey) {
        console.error("No API key found for customer", customerId)
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

      await updateApiKeyStatus(kv, apiKey.key, status)
      console.log("Updated API key status", apiKey.key, status)
      break
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      const apiKey = await getApiKeyByCustomerId(kv, customerId)
      if (!apiKey) {
        console.error("No API key found for customer", customerId)
        return
      }

      await updateApiKeyStatus(kv, apiKey.key, "canceled")
      console.log("Canceled API key", apiKey.key)
      break
    }

    default:
      console.log("Unhandled webhook event type:", event.type)
  }
}
