// Simple test plugin for local testing
export const simpleTestPlugin = async ({ client, app, $ }) => {
  console.log("🎉 Simple Test Plugin Loaded Successfully!");
  console.log("📍 App root:", app.path?.root || "unknown");
  console.log("🌐 Client URL:", client.baseUrl);
  console.log("⏰ Loaded at:", new Date().toISOString());
  
  return {
    event: async (input) => {
      console.log("📢 [SimplePlugin] Event received:", input.event?.type);
    },
    
    "chat.message": async (input, output) => {
      console.log("💬 [SimplePlugin] Chat message hook triggered!");
      console.log("   Message content preview:", output.message?.content?.slice(0, 50) + "...");
    },
    
    "tool.execute.before": async (input, output) => {
      console.log("🔧 [SimplePlugin] Tool about to execute:", input.tool);
      console.log("   Session ID:", input.sessionID);
    },
    
    "tool.execute.after": async (input, output) => {
      console.log("✅ [SimplePlugin] Tool completed:", input.tool);
      console.log("   Output length:", output.output?.length || 0, "characters");
    }
  };
};

// Also export as default for compatibility
export default simpleTestPlugin;
