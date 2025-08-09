# VS Code Extension Publishing Setup

## Overview

The kuuzuki VS Code extension is automatically built and published when you create a tag with the pattern `kuuzuki-vscode-v*`.

## Required GitHub Secrets

To enable automatic publishing, you need to set up the following secrets in your GitHub repository:

### 1. VS Code Marketplace Token (`VSCODE_MARKETPLACE_TOKEN`)

**Steps to get the token:**

1. **Create Microsoft Account** (if you don't have one)
   - Go to https://login.microsoftonline.com/
   - Sign up or sign in

2. **Create Azure DevOps Organization**
   - Go to https://dev.azure.com/
   - Create a new organization (or use existing)

3. **Generate Personal Access Token**
   - Go to https://dev.azure.com/[your-org]/_usersSettings/tokens
   - Click "New Token"
   - **Name**: "VS Code Extension Publishing"
   - **Organization**: Select your organization
   - **Expiration**: Set to 1 year (or custom)
   - **Scopes**: Select "Custom defined"
   - **Marketplace**: Check "Acquire" and "Manage"
   - Click "Create"
   - **IMPORTANT**: Copy the token immediately (you won't see it again)

4. **Add to GitHub Secrets**
   - Go to your GitHub repo → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - **Name**: `VSCODE_MARKETPLACE_TOKEN`
   - **Value**: Paste the token from step 3

### 2. Open VSX Token (`OPEN_VSX_TOKEN`) - Optional

Open VSX is an open-source alternative to the VS Code Marketplace, used by VS Codium and other editors.

**Steps to get the token:**

1. **Create Account**
   - Go to https://open-vsx.org/
   - Sign up with GitHub

2. **Generate Access Token**
   - Go to https://open-vsx.org/user-settings/tokens
   - Click "Generate New Token"
   - **Description**: "Kuuzuki Extension Publishing"
   - Click "Generate Token"
   - Copy the token

3. **Add to GitHub Secrets**
   - **Name**: `OPEN_VSX_TOKEN`
   - **Value**: Paste the token

### 3. Discord Webhook (`DISCORD_WEBHOOK`) - Optional

For notifications when extensions are published.

## Publisher Setup

Before first publish, you need to create a publisher on the VS Code Marketplace:

1. **Go to Visual Studio Marketplace**
   - Visit https://marketplace.visualstudio.com/manage
   - Sign in with your Microsoft account

2. **Create Publisher**
   - Click "Create publisher"
   - **Publisher ID**: `kuuzuki` (must match package.json)
   - **Display Name**: "Kuuzuki"
   - **Description**: "AI-powered coding assistant"
   - **Website**: https://kuuzuki.com (optional)

## Publishing Process

### Automatic Publishing (Recommended)

1. **Update Extension**
   - Make changes to the extension code
   - Test locally with F5 in VS Code

2. **Create Release Tag**
   ```bash
   # Example for version 0.1.0
   git tag kuuzuki-vscode-v0.1.0
   git push origin kuuzuki-vscode-v0.1.0
   ```

3. **GitHub Actions Will:**
   - Build the extension
   - Update package.json version
   - Create .vsix package
   - Publish to VS Code Marketplace
   - Publish to Open VSX Registry
   - Create GitHub Release
   - Upload .vsix as artifact
   - Send Discord notification

### Manual Publishing (Fallback)

If you need to publish manually:

```bash
cd packages/kuuzuki-vscode

# Install dependencies
bun install

# Build extension
npm run build

# Package extension
npm run package

# Publish to marketplace (requires VSCE_PAT environment variable)
npm run publish
```

## Tag Naming Convention

Use the pattern: `kuuzuki-vscode-v{MAJOR}.{MINOR}.{PATCH}`

Examples:
- `kuuzuki-vscode-v0.1.0` - Initial release
- `kuuzuki-vscode-v0.1.1` - Bug fix
- `kuuzuki-vscode-v0.2.0` - New features
- `kuuzuki-vscode-v1.0.0` - Major release

## Installation Methods

Once published, users can install the extension via:

### VS Code Marketplace
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Kuuzuki"
4. Click Install

### Command Line
```bash
code --install-extension kuuzuki.kuuzuki-vscode
```

### Manual VSIX Installation
1. Download .vsix from GitHub Releases
2. VS Code → Extensions → "..." menu → "Install from VSIX..."

## Troubleshooting

### Common Issues

**"Publisher not found"**
- Ensure you've created the publisher on marketplace.visualstudio.com
- Check that package.json publisher field matches your publisher ID

**"Token expired"**
- Generate new Personal Access Token in Azure DevOps
- Update GitHub secret

**"Extension validation failed"**
- Check that all required fields are in package.json
- Ensure icon.png exists and is valid
- Verify README.md is present

### Testing Before Publish

Always test the extension locally:

1. Open `packages/kuuzuki-vscode` in VS Code
2. Press F5 to launch Extension Development Host
3. Test all commands and features
4. Check console for errors

## Monitoring

- **GitHub Actions**: Monitor workflow runs in the Actions tab
- **Marketplace**: Check extension page for download stats
- **Open VSX**: Monitor on open-vsx.org
- **Discord**: Get notifications of successful publishes

## Security Notes

- Never commit tokens to the repository
- Use GitHub Secrets for all sensitive data
- Regularly rotate access tokens
- Monitor extension downloads for unusual activity