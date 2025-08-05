#!/bin/bash

echo "🧪 kuuzuki Plugin System Local Testing"
echo "======================================"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "SUCCESS") echo -e "${GREEN}✅ $message${NC}" ;;
        "ERROR") echo -e "${RED}❌ $message${NC}" ;;
        "INFO") echo -e "${BLUE}ℹ️  $message${NC}" ;;
        "WARNING") echo -e "${YELLOW}⚠️  $message${NC}" ;;
    esac
}

# Check if build exists
if [ ! -f "./packages/tui/kuuzuki" ]; then
    print_status "ERROR" "TUI not built. Running build first..."
    ./run.sh build
fi

print_status "INFO" "Step 1: Testing Plugin System with Unit Tests"
echo "Running plugin tests..."
bun test test/plugin-npm.test.ts test/plugin-opencode-compatibility.test.ts 2>&1 | grep -E "(pass|fail)" | tail -5

echo
print_status "INFO" "Step 2: Creating Test Plugin"

# Create a comprehensive test plugin
cat > test-local-plugin.js << 'EOF'
// Local test plugin for kuuzuki
export const localTestPlugin = async ({ client, app, $ }) => {
  console.log("🎉 LOCAL TEST PLUGIN LOADED!");
  console.log("📍 App root:", app.path?.root);
  console.log("🌐 Client URL:", client.baseUrl);
  console.log("⏰ Timestamp:", new Date().toISOString());
  
  return {
    event: async (input) => {
      console.log("📢 [LocalPlugin] Event:", input.event?.type);
    },
    
    "chat.message": async (input, output) => {
      console.log("💬 [LocalPlugin] Processing chat message");
      if (output.message?.content) {
        console.log("   Content preview:", output.message.content.slice(0, 50) + "...");
      }
    },
    
    "tool.execute.before": async (input, output) => {
      console.log("🔧 [LocalPlugin] Tool starting:", input.tool);
    },
    
    "tool.execute.after": async (input, output) => {
      console.log("✅ [LocalPlugin] Tool completed:", input.tool);
      console.log("   Result length:", output.output?.length || 0);
    }
  };
};

export default localTestPlugin;
EOF

print_status "SUCCESS" "Test plugin created: test-local-plugin.js"

echo
print_status "INFO" "Step 3: Creating Plugin Configuration"

# Create plugin config
cat > .agentrc.local-test << 'EOF'
{
  "plugin": [
    "./test-local-plugin.js"
  ]
}
EOF

print_status "SUCCESS" "Plugin config created: .agentrc.local-test"

echo
print_status "INFO" "Step 4: Testing Plugin Import"

# Test plugin import
node -e "
import('./test-local-plugin.js').then(mod => {
  console.log('✅ Plugin imports successfully');
  console.log('   Exports:', Object.keys(mod));
  console.log('   localTestPlugin type:', typeof mod.localTestPlugin);
}).catch(err => {
  console.error('❌ Plugin import failed:', err.message);
});
" 2>/dev/null

echo
print_status "INFO" "Step 5: Testing Plugin System Programmatically"

# Create a test script that uses the plugin system directly
cat > test-plugin-direct.js << 'EOF'
import { Plugin } from "./packages/kuuzuki/src/plugin/index.ts";
import { App } from "./packages/kuuzuki/src/app/app.ts";
import { Config } from "./packages/kuuzuki/src/config/config.ts";

async function testPluginSystem() {
  try {
    console.log("🔧 Testing plugin system directly...");
    
    // Mock config to return our test plugin
    const originalGet = Config.get;
    Config.get = async () => ({
      plugin: ["./test-local-plugin.js"]
    });
    
    // Initialize plugin system
    Plugin.init();
    
    // Wait a bit for initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get loaded plugins
    const plugins = await Plugin.getLoadedPlugins();
    console.log("📋 Loaded plugins:", plugins.length);
    
    for (const plugin of plugins) {
      console.log(`   - ${plugin.name}: [${plugin.hooks.join(", ")}]`);
    }
    
    // Test hook availability
    const hasMessageHook = await Plugin.hasHook("chat.message");
    console.log("💬 Has chat.message hook:", hasMessageHook);
    
    // Restore original config
    Config.get = originalGet;
    
    console.log("✅ Plugin system test completed successfully!");
    
  } catch (error) {
    console.error("❌ Plugin system test failed:", error.message);
  }
}

testPluginSystem();
EOF

echo "Running direct plugin system test..."
timeout 10s bun run test-plugin-direct.js 2>&1 | head -20

echo
print_status "INFO" "Step 6: Manual Testing Instructions"

echo
echo "🚀 To test the plugin system manually:"
echo
echo "1. Start the server with plugin config:"
echo "   KUUZUKI_CONFIG=.agentrc.local-test ./run.sh dev server 4096"
echo
echo "2. In another terminal, test the plugin API:"
echo "   curl http://localhost:4096/plugin | jq ."
echo
echo "3. Start the TUI with plugin config:"
echo "   KUUZUKI_CONFIG=.agentrc.local-test ./packages/tui/kuuzuki"
echo
echo "4. Test plugin hooks by:"
echo "   - Sending a chat message (triggers chat.message hook)"
echo "   - Running a tool command (triggers tool.execute hooks)"
echo "   - Checking console output for plugin messages"
echo

print_status "INFO" "Step 7: NPM Package Testing"

echo
echo "To test NPM package plugin loading:"
echo
echo "1. Create config with npm package:"
cat > .agentrc.npm-test << 'EOF'
{
  "plugin": [
    "lodash@4.17.21"
  ]
}
EOF

echo "   Created .agentrc.npm-test with lodash package"
echo
echo "2. Test npm package installation:"
echo "   KUUZUKI_CONFIG=.agentrc.npm-test ./run.sh dev server 4098"
echo
echo "   (Note: lodash isn't a valid plugin, but it will test the installation)"
echo

print_status "INFO" "Step 8: Cleanup"

echo
echo "To clean up test files:"
echo "   rm -f test-local-plugin.js test-plugin-direct.js .agentrc.*-test"
echo

print_status "SUCCESS" "Plugin system testing setup complete!"
echo
echo "🎯 Expected Results:"
echo "   - Plugins load without errors"
echo "   - Plugin hooks execute when triggered"
echo "   - Plugin API returns loaded plugin info"
echo "   - Console shows plugin messages"
echo
echo "🐛 If you see issues:"
echo "   - Check file paths in config"
echo "   - Verify plugin exports are correct"
echo "   - Look for error messages in console"
echo "   - Ensure async/await is used in plugin functions"
echo

print_status "INFO" "Ready for manual testing! 🚀"