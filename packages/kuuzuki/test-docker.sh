#!/bin/bash
set -e

echo "🐳 Docker NPM Package Test"
echo "=========================="

# Build packages first
echo "📦 Building packages..."
bun scripts/build-npm-packages.ts --current-platform --pack

# Create a Dockerfile for testing
cat > Dockerfile.test << 'EOF'
FROM node:20-slim

# Install bun (required by our package)
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://bun.sh/install | bash && \
    apt-get clean

ENV PATH="/root/.bun/bin:${PATH}"

WORKDIR /test

# Copy packages
COPY dist/npm/kuuzuki/kuuzuki-*.tgz ./
COPY dist/npm/kuuzuki-linux-x64/kuuzuki-linux-x64-*.tgz ./

# Install packages globally
RUN npm install -g ./kuuzuki-*.tgz ./kuuzuki-linux-x64-*.tgz

# Test commands
RUN kuuzuki --version
RUN kuuzuki --help

CMD ["kuuzuki", "--version"]
EOF

# Build and run Docker container
echo ""
echo "🔨 Building Docker image..."
docker build -f Dockerfile.test -t kuuzuki-test .

echo ""
echo "🚀 Running Docker container..."
docker run --rm kuuzuki-test

# Cleanup
rm -f Dockerfile.test
docker rmi kuuzuki-test >/dev/null 2>&1 || true

echo ""
echo "✅ Docker test complete!"