#!/bin/bash

# Kuuzuki Cloudflare Resources Setup Script

set -e

echo "🔧 Setting up Cloudflare resources for Kuuzuki..."

# Check if wrangler is installed and logged in
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

echo "🔑 Please make sure you're logged in to Wrangler:"
echo "wrangler login"
echo ""
read -p "Press Enter to continue once you're logged in..."

# Create KV namespaces
echo "📝 Creating KV namespaces..."

echo "Creating LICENSES KV namespace for development..."
DEV_KV_ID=$(wrangler kv:namespace create "LICENSES" --preview false | grep -o 'id = "[^"]*"' | cut -d'"' -f2)
echo "Dev KV ID: $DEV_KV_ID"

echo "Creating LICENSES KV namespace for production..."
PROD_KV_ID=$(wrangler kv:namespace create "LICENSES" --env production --preview false | grep -o 'id = "[^"]*"' | cut -d'"' -f2)
echo "Prod KV ID: $PROD_KV_ID"

# Create R2 buckets
echo "🪣 Creating R2 buckets..."

echo "Creating development bucket..."
wrangler r2 bucket create kuuzuki-storage-dev

echo "Creating production bucket..."
wrangler r2 bucket create kuuzuki-storage-prod

# Update wrangler.toml with the actual IDs
echo "📝 Updating wrangler.toml with resource IDs..."

# Replace placeholder KV IDs
sed -i "s/your-dev-licenses-kv-id/$DEV_KV_ID/g" wrangler.toml
sed -i "s/your-prod-licenses-kv-id/$PROD_KV_ID/g" wrangler.toml
sed -i "s/your-licenses-kv-id/$DEV_KV_ID/g" wrangler.toml
sed -i "s/your-licenses-preview-kv-id/$DEV_KV_ID/g" wrangler.toml

echo "✅ Cloudflare resources created successfully!"
echo ""
echo "📋 Resource Summary:"
echo "- Dev KV Namespace: $DEV_KV_ID"
echo "- Prod KV Namespace: $PROD_KV_ID"
echo "- Dev R2 Bucket: kuuzuki-storage-dev"
echo "- Prod R2 Bucket: kuuzuki-storage-prod"
echo ""
echo "🔐 Next, set your secrets:"
echo "wrangler secret put STRIPE_SECRET_KEY"
echo "wrangler secret put STRIPE_WEBHOOK_SECRET"
echo "wrangler secret put STRIPE_PRICE_ID"
echo "wrangler secret put GITHUB_APP_ID"
echo "wrangler secret put GITHUB_APP_PRIVATE_KEY"
echo ""
echo "🚀 Ready to deploy with: ./scripts/deploy-wrangler.sh"