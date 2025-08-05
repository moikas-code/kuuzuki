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
