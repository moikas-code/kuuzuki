# Stripe Webhook Integration Test

## Prerequisites

1. Set environment variables in `.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

2. Ensure the server is running:
   ```bash
   bun dev server
   ```

## Test Steps

### 1. Test Local Webhook Endpoint

```bash
# Test webhook endpoint is accessible
curl -X POST http://localhost:8000/billing/webhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: test" \
  -d '{"test": true}'
```

Expected: Should return error about invalid signature (this confirms endpoint exists)

### 2. Use Stripe CLI for Testing

```bash
# Install Stripe CLI if not already installed
# https://stripe.com/docs/stripe-cli

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:8000/billing/webhook

# In another terminal, trigger test events
stripe trigger payment_intent.succeeded
stripe trigger customer.subscription.created
stripe trigger customer.subscription.updated
```

### 3. Verify Webhook Handler

The webhook handler should:
- ✓ Verify Stripe signature
- ✓ Handle different event types
- ✓ Update user subscription status
- ✓ Log events appropriately

## Expected Event Handling

1. **checkout.session.completed**
   - Creates/updates subscription record
   - Associates with user

2. **customer.subscription.updated**
   - Updates subscription status
   - Handles plan changes

3. **customer.subscription.deleted**
   - Marks subscription as cancelled
   - Updates user access

## Verification Checklist

- [ ] Webhook endpoint responds to POST requests
- [ ] Signature verification works (rejects invalid signatures)
- [ ] Valid events are processed successfully
- [ ] Subscription data is stored/updated correctly
- [ ] Error handling works for malformed events
- [ ] Logs show event processing details

## Implementation Status

Current implementation in `packages/kuuzuki/src/server/billing.ts`:
- ✓ Webhook endpoint registered at `/billing/webhook`
- ✓ Stripe signature verification
- ✓ Event handling via imported `handleStripeWebhook`
- ✓ Mock KV storage for development
- ✓ Environment variable checks

## Notes

- Uses Mock KV storage in development
- In production, replace with actual persistence layer
- Email notifications configured via EMAIL_API_URL/KEY
- Supports Stripe API version 2025-06-30.basil