# End-to-End API Key Flow Test

## Test Scenarios

### 1. API Key Login Flow

```bash
# Test with invalid format
kuuzuki apikey login --api-key "invalid"
# Expected: ❌ Invalid API key format

# Test with test key
kuuzuki apikey login --api-key "kz_test_abc123456789"
# Expected: ✅ API key verified and stored successfully

# Test with live key (if available)
kuuzuki apikey login --api-key "kz_live_abc123456789"
# Expected: ✅ API key verified and stored successfully
```

### 2. Status Check

```bash
# Check status without showing key
kuuzuki apikey status
# Expected: Shows authentication status, masked key

# Check status with full key display
kuuzuki apikey status --show-key
# Expected: Shows full API key
```

### 3. Provider API Keys Management

```bash
# Add provider key
kuuzuki apikey provider add anthropic sk-ant-api03-...
# Expected: ✅ Anthropic API key added successfully

# List all provider keys
kuuzuki apikey provider list
# Expected: Shows all stored provider keys (masked)

# Test provider keys
kuuzuki apikey provider test
# Expected: Tests all provider keys and shows health status

# Remove provider key
kuuzuki apikey provider remove anthropic
# Expected: ✅ Anthropic API key removed
```

### 4. API Key Recovery

```bash
# Test recovery flow
kuuzuki apikey recover --email user@example.com
# Expected: Recovery email sent (if email exists in system)
```

### 5. Logout Flow

```bash
# Logout
kuuzuki apikey logout
# Expected: ✅ Logged out successfully
```

## Implementation Details

### Storage Locations
- **API Keys**: Stored in system keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- **Fallback**: File storage at `~/.config/kuuzuki/auth.json` (encrypted)
- **Provider Keys**: Stored alongside main API key

### Key Validation
- Format: `kz_live_*` or `kz_test_*`
- Verification: Makes API call to verify key validity
- Environment detection: Automatically detects test vs live keys

### Security Features
- ✓ Keychain integration for secure storage
- ✓ Masked display by default
- ✓ Encrypted file storage fallback
- ✓ No keys in environment variables
- ✓ Secure deletion on logout

## Test Checklist

- [ ] Invalid key format rejected
- [ ] Valid test key accepted and stored
- [ ] Status command shows masked key
- [ ] --show-key flag reveals full key
- [ ] Provider keys can be added
- [ ] Provider keys are stored securely
- [ ] Provider key health check works
- [ ] Recovery flow sends email
- [ ] Logout removes all stored keys
- [ ] Keychain storage works (platform-specific)
- [ ] File storage fallback works
- [ ] Keys persist across sessions

## Error Scenarios to Test

1. **Network errors during verification**
   - Disconnect network after entering key
   - Expected: Graceful error handling

2. **Keychain access denied**
   - Deny keychain access when prompted
   - Expected: Falls back to file storage

3. **Invalid provider keys**
   - Add invalid provider API key
   - Expected: Validation error

4. **Concurrent access**
   - Run multiple apikey commands simultaneously
   - Expected: Proper locking/handling

## Integration Points

The API key system integrates with:
- Auth system for request authentication
- Billing system for subscription status
- Provider system for AI model access
- Storage system for secure persistence

## Notes

- Test keys (kz_test_*) work without billing
- Live keys (kz_live_*) require active subscription
- Provider keys are optional but enable specific models
- Keychain integration requires user approval on first use