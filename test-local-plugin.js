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
