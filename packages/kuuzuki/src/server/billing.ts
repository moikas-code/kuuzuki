import type { Context } from "hono"
import Stripe from "stripe"
import { handleStripeWebhook } from "../../../function/src/billing/webhook"

// Mock KV interface for development/testing
// In production, this would be replaced with actual storage
interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  list(): Promise<{ keys: { name: string }[] }>
  getWithMetadata(): Promise<{ value: string | null; metadata: any }>
  putWithMetadata(): Promise<void>
}

class MockKV implements KVNamespace {
  private storage = new Map<string, string>()

  async get(key: string): Promise<string | null> {
    return this.storage.get(key) || null
  }

  async put(key: string, value: string): Promise<void> {
    this.storage.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key)
  }

  async list(): Promise<{ keys: { name: string }[] }> {
    return { keys: Array.from(this.storage.keys()).map((name) => ({ name })) }
  }

  // Additional KV methods (simplified implementations)
  async getWithMetadata(): Promise<{ value: string | null; metadata: any }> {
    return { value: null, metadata: null }
  }

  async putWithMetadata(): Promise<void> {}
}

const mockKV = new MockKV()

export async function webhookHandler(c: Context) {
  try {
    const body = await c.req.text()
    const signature = c.req.header("stripe-signature")

    if (!signature) {
      return c.json({ error: "Missing stripe-signature header" }, 400)
    }

    // Initialize Stripe with webhook secret
    const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] || "", {
      apiVersion: "2025-06-30.basil",
    })

    const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"]
    if (!webhookSecret) {
      return c.json({ error: "Missing webhook secret" }, 500)
    }

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
    } catch (err) {
      console.error("Webhook signature verification failed:", err)
      return c.json({ error: "Invalid signature" }, 400)
    }

    // Handle the webhook event
    await handleStripeWebhook(event, mockKV, {
      EMAIL_API_URL: process.env["EMAIL_API_URL"],
      EMAIL_API_KEY: process.env["EMAIL_API_KEY"],
    })

    return c.json({ received: true })
  } catch (error) {
    console.error("Webhook handler error:", error)
    return c.json({ error: "Internal server error" }, 500)
  }
}
