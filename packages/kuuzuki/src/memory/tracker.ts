import { MemoryStorage } from "../tool/memory-storage";
import { App } from "../app/app";
import { randomUUID } from "crypto";

export class UsageTracker {
  private storage: MemoryStorage;
  private sessionId: string;
  private toolsUsed: Set<string>;
  private sessionStartTime: Date;
  private rulesApplied: number;
  private commandsRun: number;
  private static instance: UsageTracker | null = null;

  constructor(sessionId?: string) {
    this.storage = MemoryStorage.getInstance();
    this.sessionId = sessionId || this.generateSessionId();
    this.sessionStartTime = new Date();
    this.toolsUsed = new Set();
    this.rulesApplied = 0;
    this.commandsRun = 0;
    this.startSession();
  }

  private generateSessionId(): string {
    return randomUUID();
  }

  private startSession(): void {
    const app = App.info();
    this.storage.updateSessionContext({
      sessionId: this.sessionId,
      workingDirectory: app.path.root,
      fileTypes: "[]",
      recentFiles: "[]",
      lastActivity: new Date().toISOString(),
      contextData: JSON.stringify({
        startTime: this.sessionStartTime.toISOString(),
        toolsUsed: [],
        rulesApplied: 0,
        commandsRun: 0,
      }),
    });
  }

  // Singleton pattern for global usage tracking
  static getInstance(sessionId?: string): UsageTracker {
    if (!UsageTracker.instance) {
      UsageTracker.instance = new UsageTracker(sessionId);
    }
    return UsageTracker.instance;
  }

  static resetInstance(): void {
    if (UsageTracker.instance) {
      UsageTracker.instance.endSession();
      UsageTracker.instance = null;
    }
  }

  // Track when rules are applied, suggested, or ignored
  trackRuleUsage(
    ruleId: string,
    action: "applied" | "suggested" | "ignored" | "created",
    context?: string,
    effectiveness?: number,
  ): void {
    try {
      this.storage.recordRuleUsage(
        ruleId,
        this.sessionId,
        context,
        effectiveness,
      );

      if (action === "applied") {
        this.rulesApplied++;
      }

      this.updateSessionContext();
    } catch (error) {
      // Fail silently to not break existing functionality
      console.warn("Failed to track rule usage:", error);
    }
  }

  // Track tool executions
  trackToolExecution(
    toolName: string,
    success: boolean,
    context?: any,
    duration?: number,
  ): void {
    try {
      this.toolsUsed.add(toolName);
      this.commandsRun++;
      this.updateSessionContext();
    } catch (error) {
      console.warn("Failed to track tool execution:", error);
    }
  }

  private updateSessionContext(): void {
    try {
      const contextData = {
        startTime: this.sessionStartTime.toISOString(),
        toolsUsed: Array.from(this.toolsUsed),
        rulesApplied: this.rulesApplied,
        commandsRun: this.commandsRun,
        duration: Date.now() - this.sessionStartTime.getTime(),
      };

      this.storage.updateSessionContext({
        sessionId: this.sessionId,
        workingDirectory: App.info().path.root,
        fileTypes: "[]",
        recentFiles: "[]",
        lastActivity: new Date().toISOString(),
        contextData: JSON.stringify(contextData),
      });
    } catch (error) {
      console.warn("Failed to update session context:", error);
    }
  }

  // Track general events
  trackEvent(eventType: string, data: any): void {
    try {
      // Store in session context for now
      this.updateSessionContext();
    } catch (error) {
      console.warn("Failed to track event:", error);
    }
  }

  // Track errors for learning
  trackError(
    toolName: string,
    errorType: string,
    errorMessage: string,
    context?: any,
  ): void {
    try {
      // Store error info in session context
      this.updateSessionContext();
    } catch (trackingError) {
      console.warn("Failed to track error:", trackingError);
    }
  }

  // Track successful patterns for learning
  trackSuccess(toolName: string, successType: string, context?: any): void {
    try {
      // Store success info in session context
      this.updateSessionContext();
    } catch (error) {
      console.warn("Failed to track success pattern:", error);
    }
  }

  // Get current session ID
  getSessionId(): string {
    return this.sessionId;
  }

  // Start a new session
  startNewSession(): string {
    this.endSession();
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = new Date();
    this.toolsUsed.clear();
    this.rulesApplied = 0;
    this.commandsRun = 0;
    this.startSession();
    return this.sessionId;
  }

  // End current session
  endSession(): void {
    try {
      const currentContext = this.storage.getSessionContext(this.sessionId);
      if (currentContext) {
        const contextData = JSON.parse(currentContext.contextData || "{}");
        contextData.endTime = new Date().toISOString();
        contextData.totalDuration =
          Date.now() - this.sessionStartTime.getTime();

        currentContext.contextData = JSON.stringify(contextData);
        this.storage.updateSessionContext(currentContext);
      }
    } catch (error) {
      console.warn("Failed to end session:", error);
    }
  }

  // Get session statistics
  getSessionStats(): {
    sessionId: string;
    duration: number;
    toolsUsed: string[];
    rulesApplied: number;
    commandsRun: number;
  } {
    return {
      sessionId: this.sessionId,
      duration: Date.now() - this.sessionStartTime.getTime(),
      toolsUsed: Array.from(this.toolsUsed),
      rulesApplied: this.rulesApplied,
      commandsRun: this.commandsRun,
    };
  }

  // Cleanup
  close(): void {
    this.endSession();
  }
}

// Global tracker instance for easy access
export const globalTracker = {
  track: (
    ruleId: string,
    action: "applied" | "suggested" | "ignored" | "created",
    context?: string,
    effectiveness?: number,
  ) => {
    try {
      const tracker = UsageTracker.getInstance();
      tracker.trackRuleUsage(ruleId, action, context, effectiveness);
    } catch (error) {
      // Fail silently
    }
  },

  trackTool: (
    toolName: string,
    success: boolean,
    context?: any,
    duration?: number,
  ) => {
    try {
      const tracker = UsageTracker.getInstance();
      tracker.trackToolExecution(toolName, success, context, duration);
    } catch (error) {
      // Fail silently
    }
  },

  trackEvent: (eventType: string, data: any) => {
    try {
      const tracker = UsageTracker.getInstance();
      tracker.trackEvent(eventType, data);
    } catch (error) {
      // Fail silently
    }
  },

  trackError: (
    toolName: string,
    errorType: string,
    errorMessage: string,
    context?: any,
  ) => {
    try {
      const tracker = UsageTracker.getInstance();
      tracker.trackError(toolName, errorType, errorMessage, context);
    } catch (error) {
      // Fail silently
    }
  },

  trackSuccess: (toolName: string, successType: string, context?: any) => {
    try {
      const tracker = UsageTracker.getInstance();
      tracker.trackSuccess(toolName, successType, context);
    } catch (error) {
      // Fail silently
    }
  },
};
