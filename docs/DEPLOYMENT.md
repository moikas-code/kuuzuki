# Deploying Kuuzuki to Cloudflare

This guide explains how to deploy the Kuuzuki API infrastructure to Cloudflare Workers.

## Prerequisites

- Node.js 18+ and Bun installed
- Cloudflare account (free tier works)
- Stripe account (for billing features)
- Basic familiarity with terminal commands

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/kuuzuki/kuuzuki.git
cd kuuzuki
bun install
```

### 2. Get Cloudflare Credentials

1. **Sign up/Login** to [Cloudflare Dashboard](https://dash.cloudflare.com)

2. **Get Account ID**:
   - Navigate to `Workers & Pages`
   - Find `Account ID` on the right sidebar
   - Copy this value

3. **Create API Token**:
   - Go to `My Profile` → `API Tokens`
   - Click `Create Token`
   - Use `Edit Cloudflare Workers` template
   - Ensure these permissions:
     - Account: `Cloudflare Workers Scripts:Edit`
     - Account: `Account Settings:Read`
     - Zone: `Workers Routes:Edit` (if using custom domain)
   - Create token and copy it

### 3. Configure Environment

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your credentials
# Add your Cloudflare Account ID and API Token
```

### 4. Deploy

```bash
# Deploy to development stage
bun run deploy

# Deploy to production
bun run deploy:prod
```

## Setting Up Stripe (For Billing Features)

### 1. Create Stripe Secrets

After deploying, add your Stripe secrets:

```bash
# Add Stripe secret key
bunx wrangler secret put STRIPE_SECRET_KEY --env production

# Add price ID for $5/month subscription
bunx wrangler secret put STRIPE_PRICE_ID --env production

# Add webhook secret (after creating webhook)
bunx wrangler secret put STRIPE_WEBHOOK_SECRET --env production
```

### 2. Configure Stripe Webhook

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → Webhooks
2. Add endpoint:
   - URL: `https://api.kuuzuki.ai/api/billing_webhook`
   - Events:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
3. Copy the webhook signing secret

### 3. GitHub App Secrets (Optional)

For GitHub integration:

```bash
bunx wrangler secret put GITHUB_APP_ID --env production
bunx wrangler secret put GITHUB_APP_PRIVATE_KEY --env production
```

## Custom Domain Setup

### 1. Add Domain to Cloudflare

Add your domain to Cloudflare (if not already):
- Use Cloudflare's nameservers
- Wait for DNS propagation

### 2. Update Configuration

Edit `infra/app.ts` to use your domain:

```typescript
export const domain = (() => {
  if ($app.stage === "production") return "your-domain.com"
  if ($app.stage === "dev") return "dev.your-domain.com"
  return `${$app.stage}.dev.your-domain.com`
})()
```

### 3. Redeploy

```bash
bun run deploy:prod
```

## Testing Your Deployment

### 1. Check API Health

```bash
curl https://api.your-domain.com/
# Should return: "Hello, world!"
```

### 2. Test Billing (Development)

Use Stripe test mode:
```bash
# Use test API keys
STRIPE_SECRET_KEY=sk_test_...
```

Test card: `4242 4242 4242 4242`

### 3. Test Share Features

From the Kuuzuki CLI:
```bash
# Configure to use your API
export KUUZUKI_API_URL=https://api.your-domain.com

# Test sharing
kuuzuki
# Press <leader>s to share
```

## Deployment Commands

```bash
# Deploy to development
bun run deploy

# Deploy to production
bun run deploy:prod

# Watch logs
bunx wrangler tail --env production

# Remove deployment
bun run remove       # Development
bun run remove:prod  # Production
```

## Troubleshooting

### "No account ID found"

Make sure your `.env` file contains:
```
CLOUDFLARE_DEFAULT_ACCOUNT_ID=your-account-id
```

### "Authentication error"

Check your API token has the correct permissions.

### "Deployment failed"

1. Check logs: `bunx wrangler tail`
2. Ensure all dependencies installed: `bun install`
3. Try removing and redeploying: `bun run remove && bun run deploy`

### "Stripe webhooks failing"

1. Verify webhook secret is correct
2. Check endpoint URL matches your domain
3. Ensure all required events are selected

## Cost Estimates

**Cloudflare Workers (Free Tier)**:
- 100,000 requests/day
- 10ms CPU time per request

**Cloudflare Workers (Paid - $5/month)**:
- 10 million requests/month
- 30ms CPU time per request

**Cloudflare KV**:
- 100,000 reads/day (free)
- 1,000 writes/day (free)

**Cloudflare R2**:
- 10GB storage/month (free)
- 1 million Class A operations/month (free)

For typical usage, the free tier should be sufficient.

## Security Notes

1. **Never commit `.env` file** - It's in `.gitignore`
2. **Keep secrets in Cloudflare** - Use `wrangler secret`
3. **Rotate API tokens regularly**
4. **Use production Stripe keys carefully**
5. **Monitor usage** in Cloudflare dashboard

## Next Steps

After deployment:

1. **Set up monitoring** - Cloudflare Analytics
2. **Configure alerts** - For errors or high usage
3. **Test thoroughly** - All features with real API
4. **Document your setup** - For team members
5. **Plan for scaling** - Monitor usage patterns

## Self-Hosting for Users

Users who want to self-host can:

1. Fork this repository
2. Deploy their own instance
3. Configure Kuuzuki CLI:
   ```json
   {
     "apiUrl": "https://api.their-domain.com",
     "subscriptionRequired": false
   }
   ```

This allows complete control over data and features.