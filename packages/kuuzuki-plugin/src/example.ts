import { definePlugin } from "./index";

/**
 * Example Logger Plugin
 *
 * This plugin demonstrates basic plugin functionality by logging
 * various system events and tool executions.
 */
export const LoggerPlugin = definePlugin(
  {
    name: "logger",
    version: "1.0.0",
    description: "Logs system events and tool executions for debugging",
    author: "kuuzuki community",
    keywords: ["logging", "debugging", "monitoring"],
  },
  async ({ app, client }) => {
    console.log(`[LoggerPlugin] Initialized for app at ${app.path.root}`);
    console.log(`[LoggerPlugin] Using client with baseUrl: ${client.baseUrl}`);

    return {
      // Log all system events
      event: async ({ event }) => {
        console.log(`[LoggerPlugin] Event: ${event.type}`, {
          timestamp: new Date(event.timestamp).toISOString(),
          sessionID: event.sessionID,
          data: event.data,
        });
      },

      // Log chat messages
      "chat.message": async (_input, output) => {
        console.log(`[LoggerPlugin] Chat message:`, {
          messageId: output.message.id,
          sessionID: output.message.sessionID,
          content: output.message.content.substring(0, 100) + "...",
          partsCount: output.parts.length,
        });
      },

      // Log and optionally modify chat parameters
      "chat.params": async (input, output) => {
        console.log(`[LoggerPlugin] Chat params:`, {
          model: input.model.id,
          provider: input.provider.id,
          temperature: output.temperature,
          topP: output.topP,
        });

        // Example: Slightly increase temperature for more creative responses
        if (output.temperature && output.temperature < 0.8) {
          output.temperature = Math.min(output.temperature + 0.1, 0.8);
          console.log(
            `[LoggerPlugin] Adjusted temperature to ${output.temperature}`,
          );
        }
      },

      // Log permission requests
      "permission.ask": async (input, output) => {
        console.log(`[LoggerPlugin] Permission request:`, {
          id: input.id,
          type: input.type,
          pattern: input.pattern,
          status: output.status,
        });
      },

      // Log tool executions (before)
      "tool.execute.before": async (input, output) => {
        console.log(`[LoggerPlugin] Tool execution starting:`, {
          tool: input.tool,
          sessionID: input.sessionID,
          callID: input.callID,
          args: Object.keys(output.args),
        });
      },

      // Log tool executions (after)
      "tool.execute.after": async (input, output) => {
        console.log(`[LoggerPlugin] Tool execution completed:`, {
          tool: input.tool,
          sessionID: input.sessionID,
          callID: input.callID,
          title: output.title,
          outputLength: output.output.length,
          metadata: Object.keys(output.metadata || {}),
        });
      },
    };
  },
);

/**
 * Example Permission Audit Plugin
 *
 * This plugin demonstrates permission system integration by
 * tracking and auditing all permission requests.
 */
export const PermissionAuditPlugin = definePlugin(
  {
    name: "permission-audit",
    version: "1.0.0",
    description:
      "Audits and tracks all permission requests for security monitoring",
    author: "kuuzuki community",
    keywords: ["security", "audit", "permissions"],
  },
  async ({ app }) => {
    console.log(
      `[PermissionAuditPlugin] Initialized for app at ${app.path.root}`,
    );
    const auditLog: Array<{
      timestamp: number;
      permission: any;
      decision: string;
      sessionID?: string;
    }> = [];

    return {
      "permission.ask": async (input, output) => {
        // Log the permission request
        auditLog.push({
          timestamp: Date.now(),
          permission: {
            id: input.id,
            type: input.type,
            pattern: input.pattern,
          },
          decision: output.status,
          sessionID: input.metadata?.sessionID,
        });

        // Example: Auto-deny certain dangerous patterns
        if (
          input.pattern?.includes("rm -rf") ||
          input.pattern?.includes("sudo")
        ) {
          output.status = "deny";
          console.log(
            `[PermissionAuditPlugin] Auto-denied dangerous command: ${input.pattern}`,
          );
        }

        // Example: Auto-allow safe read operations
        if (input.type === "read" && input.pattern?.startsWith("./")) {
          output.status = "allow";
          console.log(
            `[PermissionAuditPlugin] Auto-allowed safe read: ${input.pattern}`,
          );
        }

        console.log(
          `[PermissionAuditPlugin] Audit log now has ${auditLog.length} entries`,
        );
      },

      // Periodically report audit statistics
      event: async ({ event }) => {
        if (event.type === "session.end") {
          const sessionAudits = auditLog.filter(
            (entry) => entry.sessionID === event.data?.sessionID,
          );
          if (sessionAudits.length > 0) {
            console.log(
              `[PermissionAuditPlugin] Session ${event.data?.sessionID} audit summary:`,
              {
                totalRequests: sessionAudits.length,
                allowed: sessionAudits.filter((a) => a.decision === "allow")
                  .length,
                denied: sessionAudits.filter((a) => a.decision === "deny")
                  .length,
                asked: sessionAudits.filter((a) => a.decision === "ask").length,
              },
            );
          }
        }
      },
    };
  },
);

/**
 * Example Chat Enhancement Plugin
 *
 * This plugin demonstrates chat parameter modification and
 * message processing capabilities.
 */
export const ChatEnhancementPlugin = definePlugin(
  {
    name: "chat-enhancement",
    version: "1.0.0",
    description: "Enhances chat interactions with dynamic parameter adjustment",
    author: "kuuzuki community",
    keywords: ["chat", "enhancement", "ai"],
  },
  async ({ app }) => {
    console.log(
      `[ChatEnhancementPlugin] Initialized for app at ${app.path.root}`,
    );
    let messageCount = 0;

    return {
      "chat.message": async (_input, output) => {
        messageCount++;

        // Add metadata to track message sequence
        output.parts.forEach((part) => {
          if (!part.metadata) part.metadata = {};
          part.metadata.messageSequence = messageCount;
          part.metadata.enhancedBy = "chat-enhancement-plugin";
        });
      },

      "chat.params": async (input, output) => {
        // Dynamic temperature adjustment based on message content
        const content = input.message.content.toLowerCase();

        if (content.includes("creative") || content.includes("brainstorm")) {
          output.temperature = 0.9;
          console.log(
            `[ChatEnhancementPlugin] Increased temperature for creative task`,
          );
        } else if (content.includes("precise") || content.includes("exact")) {
          output.temperature = 0.1;
          console.log(
            `[ChatEnhancementPlugin] Decreased temperature for precise task`,
          );
        }

        // Adjust based on message length (longer messages might need more focused responses)
        if (input.message.content.length > 1000) {
          output.temperature = Math.max((output.temperature || 0.7) - 0.2, 0.1);
          console.log(
            `[ChatEnhancementPlugin] Reduced temperature for long message`,
          );
        }
      },
    };
  },
);

// Export all example plugins
export const ExamplePlugins = {
  LoggerPlugin,
  PermissionAuditPlugin,
  ChatEnhancementPlugin,
};
