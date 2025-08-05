/**
 * Simple test plugin for verifying plugin system functionality
 */

export const testPlugin = async ({ client, app, $ }) => {
  console.log("[TestPlugin] Loaded successfully");
  console.log("[TestPlugin] Client baseUrl:", client.baseUrl);
  console.log("[TestPlugin] App root:", app.path.root);

  return {
    // Test event handling
    event: async ({ event }) => {
      console.log("[TestPlugin] Received event:", event.type);
    },

    // Test chat message hook
    "chat.message": async (input, output) => {
      console.log("[TestPlugin] Chat message processed", { input, output });
      // Add a test metadata to verify hook execution
      if (output.parts && output.parts.length > 0) {
        console.log("[TestPlugin] Modifying parts metadata");
        output.parts[0].metadata = {
          ...output.parts[0].metadata,
          testPluginProcessed: true,
          timestamp: Date.now(),
        };
        console.log(
          "[TestPlugin] Modified metadata:",
          output.parts[0].metadata,
        );
      } else {
        console.log("[TestPlugin] No parts to modify");
      }
    },

    // Test permission hook
    "permission.ask": async (input, output) => {
      console.log("[TestPlugin] Permission request:", input.pattern);
      // Don't modify the decision, just log
    },

    // Test tool execution hooks
    "tool.execute.before": async (input, output) => {
      console.log("[TestPlugin] Tool starting:", input.tool);
    },

    "tool.execute.after": async (input, output) => {
      console.log(
        "[TestPlugin] Tool completed:",
        input.tool,
        "->",
        output.title,
      );
    },
  };
};

export default testPlugin;
