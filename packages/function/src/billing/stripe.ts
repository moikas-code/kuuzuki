import Stripe from "stripe"

export function createStripeClient(apiKey: string): Stripe {
  return new Stripe(apiKey, {
    apiVersion: "2023-10-16",
    httpClient: Stripe.createFetchHttpClient(),
  })
}

export interface CreateCheckoutSessionParams {
  priceId: string
  successUrl: string
  cancelUrl: string
  customerEmail?: string
  clientReferenceId?: string
}

export async function createCheckoutSession(
  stripe: Stripe,
  params: CreateCheckoutSessionParams
): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    customer_email: params.customerEmail,
    client_reference_id: params.clientReferenceId,
    subscription_data: {
      metadata: {
        product: "kuuzuki-pro",
      },
    },
  })

  return session.url || ""
}

export async function createBillingPortalSession(
  stripe: Stripe,
  customerId: string,
  returnUrl: string
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })

  return session.url
}

export async function constructWebhookEvent(
  stripe: Stripe,
  payload: string,
  signature: string,
  webhookSecret: string
): Promise<Stripe.Event> {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret)
}