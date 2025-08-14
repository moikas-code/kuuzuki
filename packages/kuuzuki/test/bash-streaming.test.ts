import { describe, test, expect } from "bun:test";
import { BashTool } from "../src/tool/bash";

describe("Bash Tool Progressive Streaming", () => {

  test("should stream output progressively for long-running command", async () => {
    const tool = await BashTool.init();
    const metadataUpdates: any[] = [];
    
    const result = await tool.execute(
      {
        command: "echo 'Line 1'; sleep 1; echo 'Line 2'; sleep 1; echo 'Line 3'",
        description: "Test progressive streaming",
      },
      {
        sessionID: "test-session",
        messageID: "test-message",
        toolCallID: "test-call",
        abort: new AbortController().signal,
        metadata: async (update) => {
          metadataUpdates.push(update);
        },
      }
    );

    // Should have received multiple metadata updates during streaming
    expect(metadataUpdates.length).toBeGreaterThan(1);
    
    // Check that streaming indicators were present
    const streamingUpdates = metadataUpdates.filter(
      update => update.metadata?.streaming === true
    );
    expect(streamingUpdates.length).toBeGreaterThan(0);
    
    // Check final result contains all output
    expect(result.metadata.stdout).toContain("Line 1");
    expect(result.metadata.stdout).toContain("Line 2");
    expect(result.metadata.stdout).toContain("Line 3");
    
    // Check that final result is not streaming
    expect(result.output).toContain("Line 1");
    expect(result.output).toContain("Line 2");
    expect(result.output).toContain("Line 3");
  });

  test("should handle stderr streaming", async () => {
    const tool = await BashTool.init();
    const metadataUpdates: any[] = [];
    
    const result = await tool.execute(
      {
        command: "echo 'stdout'; echo 'stderr' >&2",
        description: "Test stderr streaming",
      },
      {
        sessionID: "test-session",
        messageID: "test-message", 
        toolCallID: "test-call",
        abort: new AbortController().signal,
        metadata: async (update) => {
          metadataUpdates.push(update);
        },
      }
    );

    expect(result.metadata.stdout).toContain("stdout");
    expect(result.metadata.stderr).toContain("stderr");
  });

  test("should provide progress information", async () => {
    const tool = await BashTool.init();
    let progressUpdate: any = null;
    
    await tool.execute(
      {
        command: "echo 'test output'",
        description: "Test progress tracking",
      },
      {
        sessionID: "test-session",
        messageID: "test-message",
        toolCallID: "test-call", 
        abort: new AbortController().signal,
        metadata: async (update) => {
          if (update.metadata?.progress) {
            progressUpdate = update.metadata.progress;
          }
        },
      }
    );

    expect(progressUpdate).toBeTruthy();
    expect(progressUpdate.stdoutLines).toBeGreaterThanOrEqual(0);
    expect(progressUpdate.elapsed).toBeGreaterThanOrEqual(0);
    expect(progressUpdate.bytesReceived).toBeGreaterThanOrEqual(0);
  });

  test("should handle command timeout gracefully", async () => {
    const tool = await BashTool.init();
    
    const startTime = Date.now();
    const result = await tool.execute(
      {
        command: "sleep 10", // Long running command
        description: "Test timeout handling",
        timeout: 2000, // 2 second timeout
      },
      {
        sessionID: "test-session",
        messageID: "test-message",
        toolCallID: "test-call",
        abort: new AbortController().signal,
        metadata: async () => {},
      }
    );
    const elapsed = Date.now() - startTime;

    // Should timeout within reasonable time
    expect(elapsed).toBeLessThan(5000);
    expect(result.metadata.exit).not.toBe(0); // Non-zero exit code for timeout
  });

  test("should handle abort signal", async () => {
    const tool = await BashTool.init();
    const abortController = new AbortController();
    
    // Start a long-running command and abort it
    const promise = tool.execute(
      {
        command: "sleep 10",
        description: "Test abort handling",
      },
      {
        sessionID: "test-session",
        messageID: "test-message",
        toolCallID: "test-call",
        abort: abortController.signal,
        metadata: async () => {},
      }
    );

    // Abort after 500ms
    setTimeout(() => abortController.abort(), 500);
    
    const startTime = Date.now();
    try {
      await promise;
    } catch (error) {
      // Expected to be aborted
    }
    const elapsed = Date.now() - startTime;
    
    // Should abort quickly
    expect(elapsed).toBeLessThan(2000);
  });

  test("should truncate output at line limit", async () => {
    const tool = await BashTool.init();
    
    // Generate more than 1000 lines
    const result = await tool.execute(
      {
        command: "for i in {1..1200}; do echo \"Line $i\"; done",
        description: "Test line truncation",
      },
      {
        sessionID: "test-session",
        messageID: "test-message",
        toolCallID: "test-call",
        abort: new AbortController().signal,
        metadata: async () => {},
      }
    );

    expect(result.metadata.truncated).toBe(true);
    expect(result.metadata.stdout).toContain("Output truncated after 1000 lines");
    expect(result.metadata.lines.stdout).toBe(1000);
  });
});