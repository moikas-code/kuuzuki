# Kuuzuki Pro - Billing Setup Guide

This guide explains how to set up Stripe billing for Kuuzuki Pro subscriptions.

## Overview

Kuuzuki Pro offers a $5/month subscription for unlimited sharing features:
- Real-time session sync
- Shareable links
- Persistent sessions
- Priority support

## Architecture

The billing system uses:
- **Stripe** for payment processing
- **Cloudflare Workers** for API endpoints
- **Cloudflare KV** for license storage
- **License keys** for authentication

## Setup Instructions

### 1. Create Stripe Account

1. Sign up at [stripe.com](https://stripe.com)
2. Complete your business profile
3. Enable live mode when ready

### 2. Create Stripe Product

1. Go to Products in Stripe Dashboard
2. Create a new product:
   - Name: "Kuuzuki Pro"
   - Description: "Unlimited sharing for Kuuzuki CLI"
3. Add a price:
   - $5.00 per month
   - Recurring
   - Note the Price ID (starts with `price_`)

### 3. Set Up Webhooks

1. Go to Webhooks in Stripe Dashboard
2. Add endpoint:
   - URL: `https://api.kuuzuki.ai/api/billing_webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
3. Note the Webhook Secret (starts with `whsec_`)

### 4. Configure Cloudflare Secrets

Add these secrets to your Cloudflare Worker:

```bash
# Add Stripe secret key
wrangler secret put STRIPE_SECRET_KEY
# Enter your Stripe secret key (starts with sk_)

# Add webhook secret
wrangler secret put STRIPE_WEBHOOK_SECRET
# Enter your webhook endpoint secret (starts with whsec_)

# Add price ID
wrangler secret put STRIPE_PRICE_ID
# Enter your price ID (starts with price_)

# Add GitHub secrets (if not already set)
wrangler secret put GITHUB_APP_ID
wrangler secret put GITHUB_APP_PRIVATE_KEY
```

### 5. Deploy Infrastructure

1. Install SST if not already installed:
   ```bash
   npm install -g sst
   ```

2. Deploy to Cloudflare:
   ```bash
   cd infra
   sst deploy --stage production
   ```

### 6. Update DNS

Point these domains to Cloudflare:
- `api.kuuzuki.ai` → Cloudflare Worker
- `kuuzuki.ai` → Cloudflare Pages (optional, for web dashboard)

## Testing

### Test Mode

1. Use Stripe test keys (start with `sk_test_`)
2. Use test card: `4242 4242 4242 4242`
3. Test the flow:
   ```bash
   # Subscribe
   kuuzuki billing subscribe
   
   # After payment, login with license
   kuuzuki billing login --email test@example.com --license TEST-TEST-TEST-TEST
   
   # Check status
   kuuzuki billing status
   
   # Test sharing
   kuuzuki share
   ```

### Production Mode

1. Switch to live Stripe keys
2. Update Cloudflare secrets with live keys
3. Test with real payment

## User Flow

1. **Subscribe**: User runs `kuuzuki billing subscribe`
2. **Pay**: Opens Stripe Checkout in browser
3. **Webhook**: Stripe sends event to your API
4. **License**: API creates license key
5. **Email**: User receives license via email (implement email service)
6. **Activate**: User runs `kuuzuki billing login` with license
7. **Use**: Share features now available

## Email Integration (Optional)

To send license keys via email, add an email service:

1. **Resend** (recommended):
   ```typescript
   // In webhook.ts
   import { Resend } from 'resend'
   const resend = new Resend(env.RESEND_API_KEY)
   
   // After creating license
   await resend.emails.send({
     from: 'Kuuzuki <noreply@kuuzuki.ai>',
     to: email,
     subject: 'Your Kuuzuki Pro License',
     html: `Your license key: ${licenseKey}`
   })
   ```

2. **SendGrid** or other providers work similarly

## Self-Hosted Option

Users can self-host by:

1. Setting environment variable:
   ```bash
   export KUUZUKI_API_URL=https://your-api.domain.com
   ```

2. Or in `kuuzuki.json`:
   ```json
   {
     "apiUrl": "https://your-api.domain.com",
     "subscriptionRequired": false
   }
   ```

3. Deploy their own Cloudflare Worker with their Stripe keys

## Revenue Sharing

For community contributors:
- Consider revenue sharing for significant contributions
- Use Stripe Connect for automatic splits
- Or manual monthly payouts

## Security Notes

- Never expose Stripe secret keys in client code
- Always validate webhook signatures
- Use HTTPS for all API calls
- License keys should be cryptographically random
- Consider rate limiting on API endpoints

## Monitoring

1. **Stripe Dashboard**: Monitor subscriptions and revenue
2. **Cloudflare Analytics**: Monitor API usage
3. **Error Tracking**: Add Sentry or similar for error monitoring
4. **Customer Support**: Set up help email or Discord