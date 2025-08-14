import { App } from "../app/app";
import { z } from "zod";
import { Bus } from "../bus";
import { Log } from "../util/log";
import { Identifier } from "../id/id";
import { Plugin } from "../plugin";
import { Wildcard } from "../util/wildcard";
import { NamedError } from "../util/error";

export namespace Permission {
  const log = Log.create({ service: "permission" });

  // Agent-level permission configuration schema
  export const AgentPermissionConfig = z.object({
    edit: z.enum(["ask", "allow", "deny"]).optional(),
    bash: z.union([
      z.enum(["ask", "allow", "deny"]),
      z.record(z.string(), z.enum(["ask", "allow", "deny"]))
    ]).optional(),
    webfetch: z.enum(["ask", "allow", "deny"]).optional(),
    write: z.enum(["ask", "allow", "deny"]).optional(),
    read: z.enum(["ask", "allow", "deny"]).optional(),
    tools: z.record(z.string(), z.enum(["ask", "allow", "deny"])).optional(),
  });
  export type AgentPermissionConfig = z.infer<typeof AgentPermissionConfig>;

  // Enhanced permission configuration supporting agent-level permissions
  export const PermissionConfig = z.union([
    // Simple array format (kuuzuki style)
    z.array(z.string()),
    // Object format with optional agent-level permissions
    z.object({
      edit: z.enum(["ask", "allow", "deny"]).optional(),
      bash: z.union([
        z.enum(["ask", "allow", "deny"]),
        z.record(z.string(), z.enum(["ask", "allow", "deny"]))
      ]).optional(),
      webfetch: z.enum(["ask", "allow", "deny"]).optional(),
      write: z.enum(["ask", "allow", "deny"]).optional(),
      read: z.enum(["ask", "allow", "deny"]).optional(),
      tools: z.record(z.string(), z.enum(["ask", "allow", "deny"])).optional(),
      // Agent-specific permissions override global settings
      agents: z.record(z.string(), AgentPermissionConfig).optional(),
    })
  ]);
  export type PermissionConfig = z.infer<typeof PermissionConfig>;

  export const Info = z
    .object({
      id: z.string(),
      type: z.string(),
      pattern: z.string().optional(),
      sessionID: z.string(),
      messageID: z.string(),
      callID: z.string().optional(),
      agentName: z.string().optional(),
      title: z.string(),
      metadata: z.record(z.any()),
      time: z.object({
        created: z.number(),
      }),
    })
    .openapi({
      ref: "permission.info",
    });
  export type Info = z.infer<typeof Info>;

  export const Event = {
    Updated: Bus.event("permission.updated", Info),
    TuiUpdated: Bus.event("permission.tui.updated", Info),
  };

  const state = App.state(
    "permission",
    () => {
      const pending: {
        [sessionID: string]: {
          [permissionID: string]: {
            info: Info;
            resolve: () => void;
            reject: (e: any) => void;
          };
        };
      } = {};

      const approved: {
        [sessionID: string]: {
          [patternOrType: string]: boolean;
        };
      } = {};

      return {
        pending,
        approved,
      };
    },
    async (state) => {
      for (const pending of Object.values(state.pending)) {
        for (const item of Object.values(pending)) {
          item.reject(new RejectedError(item.info.sessionID, item.info.id));
        }
      }
    },
  );

  // Environment variable permission configuration with validation
  export function getEnvironmentPermissions(): PermissionConfig | null {
    const envPermissions = process.env.OPENCODE_PERMISSION;
    if (!envPermissions) return null;
    
    try {
      const parsed = JSON.parse(envPermissions);
      const result = PermissionConfig.safeParse(parsed);
      if (result.success) {
        log.info("Successfully loaded permissions from OPENCODE_PERMISSION environment variable", {
          type: Array.isArray(result.data) ? "array" : "object",
          hasAgentPermissions: typeof result.data === "object" && !Array.isArray(result.data) && result.data.agents ? true : false
        });
        return result.data;
      } else {
        log.error("Invalid OPENCODE_PERMISSION format, ignoring", { 
          error: result.error.issues,
          rawValue: envPermissions.substring(0, 100) + (envPermissions.length > 100 ? "..." : "")
        });
        return null;
      }
    } catch (error) {
      log.error("Failed to parse OPENCODE_PERMISSION environment variable as JSON", { 
        error: error instanceof Error ? error.message : String(error),
        rawValue: envPermissions.substring(0, 100) + (envPermissions.length > 100 ? "..." : "")
      });
      return null;
    }
  }

  // Enhanced permission checking with priority system: Environment > Config > Defaults
  export function checkPermission(input: {
    type: string;
    pattern?: string;
    agentName?: string;
    config?: any;
  }): "ask" | "allow" | "deny" {
    const { type, pattern, agentName, config } = input;
    
    // Priority 1: Environment permissions (highest priority)
    const envPermissions = getEnvironmentPermissions();
    if (envPermissions) {
      const envResult = evaluatePermissions(envPermissions, type, pattern, agentName);
      if (envResult !== null) {
        log.debug("Permission resolved by environment variable", {
          type,
          pattern,
          agentName,
          result: envResult,
          source: "OPENCODE_PERMISSION"
        });
        return envResult;
      }
    }
    
    // Priority 2: Config file permissions
    const configPermissions = config?.permission;
    if (configPermissions) {
      const configResult = evaluatePermissions(configPermissions, type, pattern, agentName);
      if (configResult !== null) {
        log.debug("Permission resolved by configuration", {
          type,
          pattern,
          agentName,
          result: configResult,
          source: "config"
        });
        return configResult;
      }
    }
    
    // Priority 3: Default behavior (allow)
    log.debug("Permission resolved by default policy", {
      type,
      pattern,
      agentName,
      result: "allow",
      source: "default"
    });
    return "allow";
  }

  // Evaluate permissions against a permission configuration
  function evaluatePermissions(
    permissions: PermissionConfig,
    type: string,
    pattern?: string,
    agentName?: string
  ): "ask" | "allow" | "deny" | null {
    // Handle array format (kuuzuki style)
    if (Array.isArray(permissions)) {
      if (pattern && Wildcard.matchAny(permissions, pattern)) {
        return "ask";
      }
      return "allow";
    }
    
    // Handle object format with potential agent-level permissions
    if (typeof permissions === "object") {
      // Check agent-specific permissions first
      if (agentName && permissions.agents?.[agentName]) {
        const agentPerms = permissions.agents[agentName];
        const agentResult = checkToolPermission(type, pattern, agentPerms);
        if (agentResult !== null) return agentResult;
        
        // Check agent-specific tool name patterns
        const agentToolResult = checkToolNamePermission(type, agentPerms.tools);
        if (agentToolResult !== null) return agentToolResult;
      }
      
      // Check global tool name patterns with enhanced wildcard matching
      const globalToolResult = checkToolNamePermission(type, permissions.tools);
      if (globalToolResult !== null) return globalToolResult;
      
      // Fall back to global permissions
      return checkToolPermission(type, pattern, permissions);
    }
    
    return null; // No applicable permissions found
  }

  // Helper function to check tool name pattern permissions with enhanced wildcard matching
  function checkToolNamePermission(
    toolName: string,
    toolPatterns: Record<string, "ask" | "allow" | "deny"> | undefined
  ): "ask" | "allow" | "deny" | null {
    if (!toolPatterns) return null;
    
    // Use enhanced wildcard matching with priority system
    const patterns = Object.keys(toolPatterns);
    const matchResult = Wildcard.matchToolNameWithResult(toolName, patterns);
    
    if (matchResult) {
      const action = toolPatterns[matchResult.pattern];
      log.info("Tool name pattern matched with priority", {
        toolName,
        matchedPattern: matchResult.pattern,
        priority: matchResult.priority,
        specificity: matchResult.specificity,
        action
      });
      return action;
    }
    
    return null;
  }

  // Helper function to check tool-specific permissions with enhanced pattern matching
  function checkToolPermission(
    type: string, 
    pattern: string | undefined, 
    permissions: any
  ): "ask" | "allow" | "deny" | null {
    const toolPerms = permissions[type];
    if (!toolPerms) return null;
    
    if (typeof toolPerms === "string") {
      // Validate that the string is a valid permission action
      if (toolPerms === "ask" || toolPerms === "allow" || toolPerms === "deny") {
        return toolPerms;
      }
      // Return null for invalid values to fall back to default behavior
      return null;
    }
    
    // Handle pattern-based permissions (mainly for bash)
    if (typeof toolPerms === "object" && pattern) {
      // Use enhanced wildcard matching with priority
      const patterns = Object.keys(toolPerms);
      const matchResult = Wildcard.matchCommand(pattern, patterns);
      
      if (matchResult) {
        const action = toolPerms[matchResult.pattern];
        log.info("Pattern matched with priority", {
          pattern,
          matchedPattern: matchResult.pattern,
          priority: matchResult.priority,
          specificity: matchResult.specificity,
          action
        });
        return action as "ask" | "allow" | "deny";
      }
      
      // If no pattern matched, default to ask for security
      return "ask";
    }
    
    return null;
  }

  export async function ask(input: {
    type: Info["type"];
    title: Info["title"];
    pattern?: Info["pattern"];
    callID?: Info["callID"];
    agentName?: Info["agentName"];
    sessionID: Info["sessionID"];
    messageID: Info["messageID"];
    metadata: Info["metadata"];
  }) {
    const { pending, approved } = state();

    log.info("asking", {
      sessionID: input.sessionID,
      messageID: input.messageID,
      toolCallID: input.callID,
      type: input.type,
      pattern: input.pattern,
      agentName: input.agentName,
    });

    // Check if this pattern/type was previously approved
    const approvalKey = input.pattern ?? input.type;
    if (approved[input.sessionID]?.[approvalKey]) {
      log.info("previously approved", {
        sessionID: input.sessionID,
        type: input.type,
        pattern: input.pattern,
        agentName: input.agentName,
      });
      return;
    }

    // Check permissions using priority system (environment > config > defaults)
    const config = await import("../config/config").then(m => m.Config.get());
    const permissionResult = checkPermission({
      type: input.type,
      pattern: input.pattern,
      agentName: input.agentName,
      config,
    });

    // Handle automatic allow/deny based on permission configuration
    if (permissionResult === "allow") {
      log.info("automatically allowed by permission configuration", {
        sessionID: input.sessionID,
        type: input.type,
        pattern: input.pattern,
        agentName: input.agentName,
      });
      // Mark as approved for future use
      approved[input.sessionID] = approved[input.sessionID] || {};
      approved[input.sessionID][approvalKey] = true;
      return;
    } else if (permissionResult === "deny") {
      log.info("automatically denied by permission configuration", {
        sessionID: input.sessionID,
        type: input.type,
        pattern: input.pattern,
        agentName: input.agentName,
      });
      throw new Error(
        `Permission denied by configuration: ${input.type} ${input.pattern || ""}`,
      );
    }

    const info: Info = {
      id: Identifier.ascending("permission"),
      type: input.type,
      pattern: input.pattern,
      sessionID: input.sessionID,
      messageID: input.messageID,
      callID: input.callID,
      agentName: input.agentName,
      title: input.title,
      metadata: input.metadata,
      time: {
        created: Date.now(),
      },
    };

    // Trigger plugin hook for permission request
    const permissionDecision = { status: "ask" as "ask" | "deny" | "allow" };
    await Plugin.trigger("permission.ask", info, permissionDecision);

    // Handle plugin decision
    if (permissionDecision.status === "allow") {
      log.info("Plugin auto-approved permission", {
        sessionID: input.sessionID,
        type: input.type,
        pattern: input.pattern,
      });
      // Mark as approved for future use
      approved[input.sessionID] = approved[input.sessionID] || {};
      approved[input.sessionID][approvalKey] = true;
      return;
    } else if (permissionDecision.status === "deny") {
      log.info("Plugin denied permission", {
        sessionID: input.sessionID,
        type: input.type,
        pattern: input.pattern,
      });
      throw new Error(
        `Permission denied by plugin: ${input.type} ${input.pattern || ""}`,
      );
    }

    // If status is "ask", continue with normal permission flow
    pending[input.sessionID] = pending[input.sessionID] || {};
    return new Promise<void>((resolve, reject) => {
      // Add 30-second timeout to prevent infinite hanging
      const timeout = setTimeout(() => {
        // Clean up pending request
        if (pending[input.sessionID] && pending[input.sessionID][info.id]) {
          delete pending[input.sessionID][info.id];
          log.warn("Permission request timed out", {
            sessionID: input.sessionID,
            permissionID: info.id,
            type: input.type,
            timeout: "30 seconds"
          });
        }
        reject(new Error(`Permission request timed out after 30 seconds: ${input.type} ${input.pattern || ""}`));
      }, 30000);

      pending[input.sessionID][info.id] = {
        info,
        resolve: (value?: void) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error?: any) => {
          clearTimeout(timeout);
          reject(error);
        },
      };
      Bus.publish(Event.Updated, info);
      Bus.publish(Event.TuiUpdated, info);
    });
  }

  export const Response = z.enum(["once", "always", "reject"]);
  export type Response = z.infer<typeof Response>;

  export function respond(input: {
    sessionID: Info["sessionID"];
    permissionID: Info["id"];
    response: Response;
  }) {
    log.info("response", input);
    const { pending, approved } = state();
    const match = pending[input.sessionID]?.[input.permissionID];
    if (!match) return;
    delete pending[input.sessionID][input.permissionID];
    if (input.response === "reject") {
      match.reject(
        new RejectedError(
          input.sessionID,
          input.permissionID,
          match.info.callID,
        ),
      );
      return;
    }
    match.resolve();
    if (input.response === "always") {
      approved[input.sessionID] = approved[input.sessionID] || {};
      const approvalKey = match.info.pattern ?? match.info.type;
      approved[input.sessionID][approvalKey] = true;

      // Auto-approve any other pending requests with the same pattern/type
      // Collect items to approve first to avoid modifying collection during iteration
      const itemsToApprove = Object.values(pending[input.sessionID]).filter(item => {
        const itemApprovalKey = item.info.pattern ?? item.info.type;
        return itemApprovalKey === approvalKey && item.info.id !== input.permissionID;
      });
      
      // Approve collected items without recursion
      for (const item of itemsToApprove) {
        delete pending[input.sessionID][item.info.id];
        item.resolve();
      }
    }
  }

  export class RejectedError extends Error {
    constructor(
      public readonly sessionID: string,
      public readonly permissionID: string,
      public readonly toolCallID?: string,
    ) {
      super(`The user rejected permission to use this functionality`);
    }
  }

  // Error classes for permission configuration issues
  export const PermissionConfigError = NamedError.create(
    "PermissionConfigError",
    z.object({
      source: z.enum(["environment", "config", "validation"]),
      message: z.string(),
      rawValue: z.string().optional(),
    }),
  );

  export const PermissionValidationError = NamedError.create(
    "PermissionValidationError",
    z.object({
      issues: z.array(z.any()),
      source: z.string(),
      rawValue: z.string().optional(),
    }),
  );

  // TUI-specific helper functions
  export function getPendingForSession(sessionID: string): Info[] {
    const { pending } = state();
    const sessionPending = pending[sessionID];
    if (!sessionPending) return [];
    return Object.values(sessionPending).map((item) => item.info);
  }

  export function getCurrentPermission(sessionID: string): Info | null {
    const pendingList = getPendingForSession(sessionID);
    return pendingList.length > 0 ? pendingList[0] : null;
  }

  export function getPermissionDisplayInfo(info: Info): {
    title: string;
    command?: string;
    filePath?: string;
    pattern?: string;
    isDangerous: boolean;
    toolIcon: string;
    shortDescription: string;
  } {
    const metadata = info.metadata || {};

    // Determine if operation is dangerous
    const isDangerous =
      (info.type === "bash" &&
        (metadata.command?.includes("rm ") ||
          metadata.command?.includes("delete") ||
          metadata.command?.includes("DROP") ||
          info.pattern?.includes("rm "))) ||
      (info.type === "edit" && metadata.filePath?.includes("config")) ||
      (info.type === "write" && metadata.filePath?.includes("config"));

    // Get tool-specific icon and description
    let toolIcon = "🔧";
    let shortDescription = info.title;

    switch (info.type) {
      case "bash":
        toolIcon = "⚡";
        shortDescription = `Execute: ${metadata.command || "command"}`;
        break;
      case "edit":
        toolIcon = "✏️";
        shortDescription = `Edit: ${metadata.filePath || "file"}`;
        break;
      case "write":
        toolIcon = "📝";
        shortDescription = `Write: ${metadata.filePath || "file"}`;
        break;
      case "read":
        toolIcon = "📖";
        shortDescription = `Read: ${metadata.filePath || "file"}`;
        break;
      default:
        toolIcon = "🔧";
        shortDescription = info.title;
    }

    return {
      title: info.title,
      command: metadata.command as string,
      filePath: metadata.filePath as string,
      pattern: info.pattern,
      isDangerous,
      toolIcon,
      shortDescription,
    };
  }

  // Cleanup function to cancel all pending permissions for a session
  export function cancelPendingForSession(sessionID: string, reason = "Session ended") {
    const { pending } = state();
    const sessionPending = pending[sessionID];
    if (!sessionPending) return;

    log.info("Cancelling pending permissions for session", {
      sessionID,
      count: Object.keys(sessionPending).length,
      reason
    });

    // Reject all pending permissions for this session
    for (const item of Object.values(sessionPending)) {
      item.reject(new Error(`Permission cancelled: ${reason}`));
    }

    // Clear the session's pending permissions
    delete pending[sessionID];
  }
}
