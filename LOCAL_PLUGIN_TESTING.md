# 🧪 Local Plugin System Testing Guide

## Quick Start - Test the Plugin System Now!

### 1. **Build kuuzuki**

```bash
# Build everything (TUI + CLI)
./run.sh build

# Or build individually
./run.sh build tui     # Build TUI only
./run.sh build server  # Build CLI only
```

### 2. **Run Plugin Tests**

```bash
# Test all plugin functionality
bun test test/plugin-*.test.ts

# Test specific areas
bun test test/plugin-npm.test.ts              # NPM package support
bun test test/plugin-opencode-compatibility.test.ts  # OpenCode compatibility
bun test test/plugin-real.test.ts             # Real plugin loading
bun test test/plugin-system.test.ts           # Core plugin system
```

### 3. **Test Plugin Loading with Real Configuration**

#### Create a Test Plugin

```bash
# Create a simple test plugin
cat > test-my-plugin.js << 'EOF'
// Simple kuuzuki plugin
export const myTestPlugin = async ({ client, app, $ }) => {
  console.log("🔌 My Test Plugin Loaded!");
  console.log("📍 App root:", app.path?.root);
  console.log("🌐 Client URL:", client.baseUrl);

  return {
    event: async (input) => {
      console.log("📢 Event received:", input.event.type);
    },

    "chat.message": async (input, output) => {
      console.log("💬 Chat message hook triggered");
      console.log("📝 Message:", output.message?.content?.slice(0, 50) + "...");
    },

    "tool.execute.before": async (input, output) => {
      console.log("🔧 Tool about to execute:", input.tool);
    }
  };
};
EOF
```

#### Configure Plugin in .agentrc

```bash
# Backup current config
cp .agentrc .agentrc.backup-plugin-test

# Add plugin to config
cat > .agentrc.plugin-test << 'EOF'
{
  "plugin": [
    "./test-my-plugin.js"
  ]
}
EOF
```

### 4. **Test Plugin System in TUI**

#### Start TUI with Plugin

```bash
# Set config and start TUI
KUUZUKI_CONFIG=.agentrc.plugin-test ./packages/tui/kuuzuki

# Or use the run script
KUUZUKI_CONFIG=.agentrc.plugin-test ./run.sh dev tui
```

#### Test Plugin Visibility in TUI

Once in TUI, test the plugin info tool:

1. Type a message to trigger chat hooks
2. Use the plugin info command (if available)
3. Check console output for plugin messages

### 5. **Test Plugin System in Server Mode**

#### Start Server with Plugin

```bash
# Start server with plugin config
KUUZUKI_CONFIG=.agentrc.plugin-test ./run.sh dev server 4096
```

#### Test Plugin API Endpoint

```bash
# In another terminal, test the plugin API
curl http://localhost:4096/plugin | jq .

# Expected output:
# [
#   {
#     "name": "myTestPlugin",
#     "hooks": ["event", "chat.message", "tool.execute.before"],
#     "path": "./test-my-plugin.js"
#   }
# ]
```

### 6. **Test NPM Package Plugin Loading**

#### Test with a Real NPM Package

```bash
# Create config with npm package
cat > .agentrc.npm-test << 'EOF'
{
  "plugin": [
    "lodash@4.17.21"
  ]
}
EOF

# Note: This will try to load lodash as a plugin (will fail gracefully)
# but demonstrates the npm installation works
KUUZUKI_CONFIG=.agentrc.npm-test ./run.sh dev server 4096
```

#### Create a Proper NPM-Style Plugin

```bash
# Create a plugin that exports the right interface
cat > test-npm-style-plugin.js << 'EOF'
// NPM-style plugin export
export default async ({ client, app, $ }) => {
  console.log("📦 NPM-style plugin loaded!");

  return {
    "chat.message": async (input, output) => {
      console.log("📦 NPM plugin: Chat message processed");
    }
  };
};

// Also support named export
export const npmPlugin = async ({ client, app, $ }) => {
  return {
    event: async (input) => {
      console.log("📦 NPM plugin: Event received");
    }
  };
};
EOF

# Test it
cat > .agentrc.npm-style-test << 'EOF'
{
  "plugin": [
    "./test-npm-style-plugin.js"
  ]
}
EOF

KUUZUKI_CONFIG=.agentrc.npm-style-test ./run.sh dev server 4096
```

### 7. **Test Plugin Error Handling**

#### Create a Broken Plugin

```bash
cat > test-broken-plugin.js << 'EOF'
// Broken plugin to test error handling
export const brokenPlugin = async ({ client, app, $ }) => {
  throw new Error("This plugin is intentionally broken!");
};

export const workingPlugin = async ({ client, app, $ }) => {
  console.log("✅ This plugin works fine!");
  return {
    event: async (input) => {
      console.log("✅ Working plugin event");
    }
  };
};
EOF

# Test error isolation
cat > .agentrc.error-test << 'EOF'
{
  "plugin": [
    "./test-broken-plugin.js",
    "./test-my-plugin.js"
  ]
}
EOF

KUUZUKI_CONFIG=.agentrc.error-test ./run.sh dev server 4096
```

### 8. **Test Plugin Hooks in Action**

#### Create a Comprehensive Test Plugin

```bash
cat > test-comprehensive-plugin.js << 'EOF'
// Comprehensive plugin testing all hooks
export const comprehensivePlugin = async ({ client, app, $ }) => {
  console.log("🚀 Comprehensive Plugin Loaded!");

  return {
    event: async (input) => {
      console.log("📢 Event:", input.event.type, input.event.data);
    },

    "chat.message": async (input, output) => {
      console.log("💬 Chat Message Hook");
      console.log("   Message ID:", output.message?.id);
      console.log("   Parts count:", output.parts?.length);
    },

    "chat.params": async (input, output) => {
      console.log("⚙️ Chat Params Hook");
      console.log("   Model:", input.model?.name);
      console.log("   Provider:", input.provider?.name);
      // Modify parameters
      output.temperature = Math.min(output.temperature || 0.7, 0.8);
    },

    "permission.ask": async (input, output) => {
      console.log("🔐 Permission Hook");
      console.log("   Permission type:", input.type);
      console.log("   Pattern:", input.pattern);
      // Auto-approve safe commands
      if (input.pattern?.startsWith("echo ")) {
        output.status = "allow";
        console.log("   ✅ Auto-approved echo command");
      }
    },

    "tool.execute.before": async (input, output) => {
      console.log("🔧 Tool Before Hook");
      console.log("   Tool:", input.tool);
      console.log("   Session:", input.sessionID);
      console.log("   Args:", JSON.stringify(output.args).slice(0, 100));
    },

    "tool.execute.after": async (input, output) => {
      console.log("✅ Tool After Hook");
      console.log("   Tool:", input.tool);
      console.log("   Title:", output.title);
      console.log("   Output length:", output.output?.length);
    }
  };
};
EOF

# Test comprehensive plugin
cat > .agentrc.comprehensive-test << 'EOF'
{
  "plugin": [
    "./test-comprehensive-plugin.js"
  ]
}
EOF

KUUZUKI_CONFIG=.agentrc.comprehensive-test ./run.sh dev tui
```

### 9. **Performance Testing**

#### Test Plugin Loading Performance

```bash
# Create multiple plugins
for i in {1..5}; do
cat > test-plugin-$i.js << EOF
export const plugin$i = async ({ client, app, $ }) => {
  console.log("Plugin $i loaded at", new Date().toISOString());
  return {
    event: async (input) => {
      console.log("Plugin $i: Event received");
    }
  };
};
EOF
done

# Test loading multiple plugins
cat > .agentrc.performance-test << 'EOF'
{
  "plugin": [
    "./test-plugin-1.js",
    "./test-plugin-2.js",
    "./test-plugin-3.js",
    "./test-plugin-4.js",
    "./test-plugin-5.js"
  ]
}
EOF

# Time the startup
time KUUZUKI_CONFIG=.agentrc.performance-test ./run.sh dev server 4096 &
sleep 2
curl http://localhost:4096/plugin | jq '.[] | .name'
pkill -f "kuuzuki.*server"
```

### 10. **Cleanup**

```bash
# Clean up test files
rm -f test-*.js .agentrc.*-test

# Restore original config
if [ -f .agentrc.backup-plugin-test ]; then
  mv .agentrc.backup-plugin-test .agentrc
fi

# Clean build artifacts if needed
./run.sh clean
```

## 🎯 Expected Results

### ✅ **Successful Plugin Loading**

- Console shows "Plugin loaded successfully" messages
- No error messages in logs
- Plugin hooks execute when triggered

### ✅ **NPM Package Support**

- Packages are automatically installed to cache
- Plugin loading works with npm packages
- Scoped packages (@scope/package) work correctly

### ✅ **Error Isolation**

- Broken plugins don't crash the system
- Error messages are logged but system continues
- Other plugins continue to work

### ✅ **Hook Execution**

- Chat hooks trigger on messages
- Tool hooks trigger on tool execution
- Event hooks trigger on system events
- Permission hooks can modify permissions

### ✅ **Plugin Visibility**

- `/plugin` API endpoint returns loaded plugins
- Plugin info shows correct hook lists
- Metadata is preserved and displayed

## 🐛 Troubleshooting

### Plugin Not Loading

1. Check file path in config
2. Verify plugin exports correct interface
3. Check console for error messages
4. Ensure plugin function is async

### NPM Package Issues

1. Check network connectivity
2. Verify package exists on npm
3. Check cache directory permissions
4. Try with a simple package like "lodash"

### Hook Not Triggering

1. Verify hook name matches exactly
2. Check plugin is loaded successfully
3. Ensure hook function is async
4. Check for plugin errors in logs

### Performance Issues

1. Reduce number of plugins
2. Check plugin code for blocking operations
3. Monitor memory usage
4. Use async/await properly in hooks

## 🚀 Next Steps

After successful local testing:

1. Create your own plugins
2. Publish plugins to npm
3. Share plugins with the community
4. Contribute improvements back to kuuzuki

Happy plugin development! 🎉
