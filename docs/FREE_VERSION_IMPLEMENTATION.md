# Free Version Implementation Details

This document explains how Kuuzuki determines whether a user is on the free or pro tier.

## How Free Version Works

### 1. Default Behavior

By default, all Kuuzuki installations are **free**:
- No subscription required
- All core features enabled
- Share features gracefully disabled

### 2. Subscription Detection

The system checks for Pro subscription in this order:

```typescript
// In src/auth/subscription.ts
async function checkSubscription(): Promise<SubscriptionStatus> {
  // 1. Check if using self-hosted instance (always "pro")
  if (apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1")) {
    return { hasSubscription: true, needsRefresh: false }
  }
  
  // 2. Check if subscription disabled in config
  if (config.subscriptionRequired === false) {
    return { hasSubscription: true, needsRefresh: false }
  }
  
  // 3. Check for valid license in ~/.kuuzuki/auth.json
  const auth = await getAuth()
  if (!auth) {
    return { hasSubscription: false, message: "..." }
  }
  
  // 4. Validate license with API (cached for 5 minutes)
  // ...
}
```

### 3. Free Version Behavior

When no subscription is detected:

#### Share Command
```bash
$ kuuzuki
> /share

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🚀 Upgrade to Kuuzuki Pro

  Unlock unlimited sharing with:
  • Real-time session sync
  • Shareable links
  • Persistent sessions
  • Priority support

  Only $5/month

  Run: kuuzuki billing subscribe
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Error: Kuuzuki Pro subscription required for sharing
```

#### Everything Else Works
- TUI starts normally
- All AI features available
- All tools functional
- Sessions saved locally

### 4. Configuration Options

Users can control subscription behavior:

#### Disable Subscription Requirement
```json
// kuuzuki.json
{
  "subscriptionRequired": false,
  "share": "manual"
}
```

#### Self-Hosted API
```bash
# Environment variable
export KUUZUKI_API_URL=http://localhost:8787

# Or in kuuzuki.json
{
  "apiUrl": "http://localhost:8787"
}
```

### 5. Grace Periods

The subscription system includes user-friendly grace periods:

- **Offline Grace**: If API unreachable, cached status used
- **Cancellation Grace**: 30 days access after cancellation
- **Cache Duration**: 5 minutes between API checks

### 6. Implementation Files

Key files for free/pro logic:

```
packages/kuuzuki/src/
├── auth/
│   ├── api.ts          # API client for license verification
│   ├── storage.ts      # Local auth storage (~/.kuuzuki/auth.json)
│   └── subscription.ts # Subscription checking logic
├── cli/cmd/
│   └── billing.ts      # CLI billing commands
└── session/
    └── index.ts        # Share function with subscription check
```

### 7. Share Feature Gate

The share feature specifically checks subscription:

```typescript
// In session/index.ts
export async function share(id: string) {
  const cfg = await Config.get()
  if (cfg.share === "disabled") {
    throw new Error("Sharing is disabled in configuration")
  }

  // Check subscription status
  const subscription = await checkSubscription()
  if (!subscription.hasSubscription) {
    showSubscriptionPrompt()
    throw new Error(subscription.message || "Kuuzuki Pro subscription required for sharing")
  }

  // Continue with share logic...
}
```

## Testing Free vs Pro

### Test Free Version
```bash
# Fresh install - defaults to free
npm install -g kuuzuki
kuuzuki

# Try to share (will show upgrade prompt)
# Press <leader>s in TUI
```

### Test Pro Version
```bash
# With test license
kuuzuki billing login --email test@example.com --license TEST-TEST-TEST-TEST

# Or with config
echo '{"subscriptionRequired": false}' > ~/.kuuzuki/config.json
```

### Test Self-Hosted
```bash
# Set API URL to localhost
export KUUZUKI_API_URL=http://localhost:8787
kuuzuki  # Share features enabled
```

## Design Principles

1. **Free by Default**: No subscription required to start using Kuuzuki
2. **Graceful Degradation**: Features fail gracefully with helpful messages
3. **No Dark Patterns**: Clear communication about what requires Pro
4. **User Control**: Multiple ways to configure behavior
5. **Offline Friendly**: Works without internet (except AI API calls)

## Future Considerations

- **Feature Flags**: Easy to add more Pro features by checking subscription
- **Tiers**: Could add more tiers by checking license metadata
- **Team Licenses**: License system supports metadata for team features
- **Usage Limits**: Could track usage in KV store if needed