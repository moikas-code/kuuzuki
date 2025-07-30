#!/bin/bash

# Kuuzuki Cloudflare Deployment Script

set -e

echo "🚀 Deploying Kuuzuki API to Cloudflare..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

# Build the project first
echo "📦 Building project..."
bun run build:server

# Set environment (default to development)
ENV=${1:-development}
echo "🌍 Deploying to environment: $ENV"

# Deploy based on environment
if [ "$ENV" = "production" ]; then
    echo "🏭 Deploying to production..."
    wrangler deploy --env production
else
    echo "🧪 Deploying to development..."
    wrangler deploy --env development
fi

echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Set your secrets with: wrangler secret put SECRET_NAME"
echo "2. Create KV namespaces: wrangler kv:namespace create LICENSES"
echo "3. Create R2 bucket: wrangler r2 bucket create kuuzuki-storage"
echo "4. Update wrangler.toml with the actual IDs"