# GitHub Actions Setup for NPM Publishing

This guide explains how to set up GitHub Actions to automatically publish to npm when you push version tags.

## Required Secrets

You need to add these secrets to your GitHub repository:

### 1. NPM Token

1. Go to [npmjs.com](https://www.npmjs.com) and log in
2. Go to your profile → Access Tokens
3. Create a new token with "Automation" type
4. Copy the token
5. In your GitHub repo: Settings → Secrets and variables → Actions
6. Add new secret: `NODE_AUTH_TOKEN` with the npm token value

### 2. GitHub Token (Optional)

The `GITHUB_TOKEN` is automatically provided by GitHub Actions, so you don't need to add it manually.

## How It Works

### Trigger
The workflow triggers when you push a tag that matches:
- `v*` (e.g., `v0.1.0`)
- `kuuzuki-v*` (e.g., `kuuzuki-v0.1.0`)

### Process
1. **Checkout**: Gets your code
2. **Setup**: Installs Node.js, Bun, and Go
3. **Build**: Creates cross-platform TUI binaries
4. **Package**: Creates JavaScript entry point
5. **Test**: Runs tests and validates package
6. **Publish**: Publishes to npm
7. **Release**: Creates GitHub release with binaries

## Usage

### To Release a New Version

```bash
# Update version in package.json
# Then create and push a tag
git tag v0.1.1
git push origin v0.1.1
```

### To Check Status

1. Go to your GitHub repo
2. Click "Actions" tab
3. Look for "Publish to NPM" workflow
4. Check the logs for any issues

## What Gets Published

The npm package includes:
- Cross-platform binaries (macOS, Linux, Windows, ARM64/x64)
- JavaScript entry point
- Package configuration
- Original README (unchanged)

## Troubleshooting

### Permission Denied
- Ensure `NODE_AUTH_TOKEN` secret is set correctly
- Check that the npm token has publish permissions

### Build Failures
- Check Go version compatibility
- Verify all dependencies are available
- Look at the workflow logs for specific errors

### Package Issues
- Test locally first: `./scripts/build-npm.sh`
- Check package structure: `npm pack --dry-run`

## Manual Testing

Before pushing a tag, you can test locally:

```bash
# Build the package
./scripts/build-npm.sh

# Test the package
cd packages/kuuzuki
node bin/kuuzuki.js --help
```

This ensures everything works before triggering the GitHub Action. 