// Simple plugin for TUI testing
export const tuiTestPlugin = async ({ client, app, $ }) => {
  console.log("🎉 TUI Test Plugin Loaded!");
  console.log("📱 Running in TUI mode");
  console.log("📍 App root:", app.path?.root);
  
  return {
    event: async (input) => {
      console.log("📢 [TUI Plugin] Event:", input.event?.type);
    },
    
    "chat.message": async (input, output) => {
      console.log("💬 [TUI Plugin] Chat message received!");
      console.log("   Message preview:", output.message?.content?.slice(0, 30) + "...");
    },
    
    "tool.execute.before": async (input, output) => {
      console.log("🔧 [TUI Plugin] Tool starting:", input.tool);
    },
    
    "tool.execute.after": async (input, output) => {
      console.log("✅ [TUI Plugin] Tool finished:", input.tool);
    }
  };
};

export default tuiTestPlugin;
