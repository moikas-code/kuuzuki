# Kuuzuki Free vs Pro

## Overview

Kuuzuki is a powerful AI-powered terminal assistant that's **free and open source**. The core functionality will always remain free, with an optional Pro subscription for cloud-based features.

## 🆓 Kuuzuki Free (Default)

### What's Included

**Everything you need for local AI-powered development:**

- ✅ **Full TUI (Terminal UI)** - The complete terminal interface
- ✅ **All AI providers** - Use any AI model (Anthropic, OpenAI, etc.)
- ✅ **All tools** - File editing, search, web access, etc.
- ✅ **Unlimited local sessions** - Create as many sessions as you want
- ✅ **All themes and customization** - Full personalization options
- ✅ **IDE integrations** - VS Code and other editor support
- ✅ **MCP server support** - Extend with Model Context Protocol
- ✅ **Multi-mode support** - Code, Plan, Architect modes
- ✅ **Export sessions** - Save sessions locally
- ✅ **Community support** - GitHub issues and discussions

### Limitations

- ❌ No session sharing (no shareable links)
- ❌ No real-time collaboration
- ❌ No cloud backup
- ❌ No persistent sessions across devices

### Perfect For

- Individual developers
- Local development workflows
- Privacy-conscious users
- Learning and experimentation
- Open source contributors

## 💎 Kuuzuki Pro ($5/month)

### Everything in Free, Plus

**Cloud-powered collaboration features:**

- ✅ **Unlimited session sharing** - Create shareable links for any session
- ✅ **Real-time sync** - Live updates across all viewers
- ✅ **Persistent sessions** - Access from any device
- ✅ **Custom share domains** (coming soon)
- ✅ **Priority support** - Direct support channel
- ✅ **Support development** - Help sustain the project

### Use Cases

- Share debugging sessions with teammates
- Create public examples and tutorials
- Collaborate on code reviews
- Demonstrate solutions to clients
- Build a portfolio of AI interactions

## How It Works

### Free Version (Default)

1. **Install Kuuzuki**

   ```bash
   npm install -g kuuzuki
   ```

2. **Start using immediately**

   ```bash
   kuuzuki  # Launches TUI
   ```

3. **All features work locally**
   - No account required
   - No internet required (except for AI API calls)
   - Your data stays on your machine

### Upgrading to Pro

1. **Subscribe**

   ```bash
   kuuzuki billing subscribe
   ```

2. **Receive API key** via email

3. **Set your API key**

   ```bash
   # Option 1: Environment variable (recommended)
   export KUUZUKI_API_KEY=kz_live_your_api_key_here

   # Option 2: Explicit login
   kuuzuki apikey login --api-key kz_live_your_api_key_here
   ```

4. **Share sessions**
   - Press `<leader>s` in TUI to share current session
   - Get instant shareable link
   - Anyone can view (read-only) without Kuuzuki installed

## Technical Details

### How Sharing Works

When you share a session (Pro only):

1. Session data syncs to Cloudflare R2 storage
2. Real-time updates via WebSockets
3. Viewers see a web-based read-only interface
4. Original session remains in full control

### Privacy & Security

**Free Version:**

- All data stays local
- No telemetry or tracking
- AI API calls go directly to your chosen provider

**Pro Version:**

- Shared sessions are encrypted at rest
- Links are unguessable UUIDs
- You control when to share/unshare
- Delete shared data anytime

### Self-Hosting

**Advanced users can self-host the Pro infrastructure:**

1. Deploy the Cloudflare Worker API
2. Set up your own Stripe account
3. Configure with your API URL:
   ```json
   {
     "apiUrl": "https://your-api.domain.com",
     "subscriptionRequired": false
   }
   ```

See [BILLING_SETUP.md](./BILLING_SETUP.md) for details.

## Why This Model?

- **Sustainable development** - Pro subscriptions fund ongoing development
- **Fair for everyone** - Core features remain free
- **Optional cloud features** - Only pay if you need sharing
- **Community first** - Open source and self-hostable
- **No vendor lock-in** - Export and own your data

## FAQ

**Q: Will prices increase?**
A: We're committed to keeping Pro at $5/month. Any future price changes would only affect new subscribers.

**Q: Can I cancel anytime?**
A: Yes, cancel anytime through the billing portal. You'll retain access until the end of your billing period.

**Q: Do I need Pro for team usage?**
A: No, each team member can use Kuuzuki Free independently. Pro is only needed for sharing sessions between team members.

**Q: What happens to shared sessions if I cancel?**
A: Shared links become inaccessible, but your local sessions remain untouched.

**Q: Is there a trial period?**
A: Not currently, but the free version lets you evaluate all core features before subscribing.

## Comparison Table

| Feature           | Free         | Pro          |
| ----------------- | ------------ | ------------ |
| Terminal UI (TUI) | ✅           | ✅           |
| AI Providers      | ✅ All       | ✅ All       |
| Local Sessions    | ✅ Unlimited | ✅ Unlimited |
| File Editing      | ✅           | ✅           |
| Web Search        | ✅           | ✅           |
| All Tools         | ✅           | ✅           |
| Themes            | ✅           | ✅           |
| IDE Integration   | ✅           | ✅           |
| Session Sharing   | ❌           | ✅ Unlimited |
| Shareable Links   | ❌           | ✅           |
| Real-time Sync    | ❌           | ✅           |
| Cloud Backup      | ❌           | ✅           |
| Priority Support  | ❌           | ✅           |
| Price             | $0           | $5/month     |

## Getting Started

### Try Free Version

```bash
npm install -g kuuzuki
kuuzuki
```

### Upgrade to Pro

```bash
kuuzuki billing subscribe
```

### Check Status

```bash
kuuzuki apikey status
```

### Lost Your API Key?

If you forget your API key:

1. **Check current status**:

   ```bash
   kuuzuki apikey status --show-key
   ```

2. **Recover by email**:

   ```bash
   kuuzuki apikey recover --email your@email.com
   ```

3. **Access billing portal**:
   ```bash
   kuuzuki billing portal
   ```

---

**Remember:** Kuuzuki's core mission is to provide powerful AI-assisted development tools to everyone. The free version will always include everything you need for productive local development. Pro features are purely additive for collaboration scenarios.
