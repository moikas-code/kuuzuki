import type { Context } from "hono"
import Stripe from "stripe"

// Stub implementation for webhook handling
async function handleStripeWebhook(event: any, kv: any, config: any) {
  console.log("Stripe webhook received:", event.type);
  // TODO: Implement webhook handling
}

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
      return c.json({ error: "No signature" }, 400)
    }

    const stripeApiKey = process.env["STRIPE_API_KEY"] || process.env["STRIPE_SECRET_KEY"]
    const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"]

    if (!stripeApiKey || !webhookSecret) {
      console.error("Stripe configuration missing")
      return c.json({ error: "Server configuration error" }, 500)
    }

    const stripe = new Stripe(stripeApiKey, {
      apiVersion: "2024-12-18.acacia" as any,
    })

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err: any) {
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

export async function createCheckoutSession(c: Context) {
  try {
    const body = await c.req.json()
    const { priceId, userId, email } = body

    if (!priceId || !userId || !email) {
      return c.json({ error: "Missing required fields" }, 400)
    }

    const stripeApiKey = process.env["STRIPE_API_KEY"] || process.env["STRIPE_SECRET_KEY"]

    if (!stripeApiKey) {
      console.error("Stripe API key not configured")
      return c.json({ error: "Server configuration error" }, 500)
    }

    const stripe = new Stripe(stripeApiKey, {
      apiVersion: "2024-12-18.acacia" as any,
    })

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env["APP_URL"]}/billing?success=true`,
      cancel_url: `${process.env["APP_URL"]}/billing?canceled=true`,
      customer_email: email,
      metadata: {
        userId,
      },
    })

    return c.json({ sessionId: session.id })
  } catch (error) {
    console.error("Create checkout session error:", error)
    return c.json({ error: "Failed to create checkout session" }, 500)
  }
}

export async function getBillingPortal(c: Context) {
  try {
    const { userId } = await c.req.json()

    if (!userId) {
      return c.json({ error: "Missing userId" }, 400)
    }

    const stripeApiKey = process.env["STRIPE_API_KEY"] || process.env["STRIPE_SECRET_KEY"]

    if (!stripeApiKey) {
      console.error("Stripe API key not configured")
      return c.json({ error: "Server configuration error" }, 500)
    }

    const stripe = new Stripe(stripeApiKey, {
      apiVersion: "2024-12-18.acacia" as any,
    })

    // Get customer ID from KV store
    const customerData = await mockKV.get(`customer_${userId}`)
    
    if (!customerData) {
      return c.json({ error: "No customer found" }, 404)
    }

    const { customerId } = JSON.parse(customerData)

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env["APP_URL"]}/billing`,
    })

    return c.json({ url: session.url })
  } catch (error) {
    console.error("Get billing portal error:", error)
    return c.json({ error: "Failed to create billing portal session" }, 500)
  }
}

export async function getSubscriptionStatus(c: Context) {
  try {
    const userId = c.req.param("userId")

    if (!userId) {
      return c.json({ error: "Missing userId" }, 400)
    }

    // Get subscription data from KV store
    const subscriptionData = await mockKV.get(`subscription_${userId}`)
    
    if (!subscriptionData) {
      return c.json({ status: "inactive", plan: null })
    }

    const subscription = JSON.parse(subscriptionData)
    
    return c.json({
      status: subscription.status,
      plan: subscription.plan,
      currentPeriodEnd: subscription.currentPeriodEnd,
    })
  } catch (error) {
    console.error("Get subscription status error:", error)
    return c.json({ error: "Failed to get subscription status" }, 500)
  }
}