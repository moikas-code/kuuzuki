import { describe, it, expect, beforeEach, afterEach } from "bun:test";

describe("Fish Shell Integration", () => {
  let originalShell: string | undefined;

  beforeEach(() => {
    originalShell = process.env["SHELL"];
  });

  afterEach(() => {
    if (originalShell) {
      process.env["SHELL"] = originalShell;
    } else {
      delete process.env["SHELL"];
    }
  });

  it("should handle fish shell environment correctly", () => {
    // Simulate fish shell environment
    process.env["SHELL"] = "/usr/bin/fish";
    
    const shell = process.env["SHELL"] ?? "bash";
    const isFish = shell.includes("fish");
    const script = 'echo "Hello from fish"';
    const args = isFish ? ["-c", script] : ["-c", "-l", script];
    
    expect(shell).toBe("/usr/bin/fish");
    expect(isFish).toBe(true);
    expect(args).toEqual(["-c", script]);
  });

  it("should handle bash shell environment correctly", () => {
    // Simulate bash shell environment
    process.env["SHELL"] = "/bin/bash";
    
    const shell = process.env["SHELL"] ?? "bash";
    const isFish = shell.includes("fish");
    const script = 'echo "Hello from bash"';
    const args = isFish ? ["-c", script] : ["-c", "-l", script];
    
    expect(shell).toBe("/bin/bash");
    expect(isFish).toBe(false);
    expect(args).toEqual(["-c", "-l", script]);
  });

  it("should handle zsh shell environment correctly", () => {
    // Simulate zsh shell environment
    process.env["SHELL"] = "/usr/bin/zsh";
    
    const shell = process.env["SHELL"] ?? "bash";
    const isFish = shell.includes("fish");
    const script = 'echo "Hello from zsh"';
    const args = isFish ? ["-c", script] : ["-c", "-l", script];
    
    expect(shell).toBe("/usr/bin/zsh");
    expect(isFish).toBe(false);
    expect(args).toEqual(["-c", "-l", script]);
  });

  it("should default to bash when SHELL is not set", () => {
    // Simulate missing SHELL environment
    delete process.env["SHELL"];
    
    const shell = process.env["SHELL"] ?? "bash";
    const isFish = shell.includes("fish");
    const script = 'echo "Hello from default"';
    const args = isFish ? ["-c", script] : ["-c", "-l", script];
    
    expect(shell).toBe("bash");
    expect(isFish).toBe(false);
    expect(args).toEqual(["-c", "-l", script]);
  });

  it("should handle various fish shell paths", () => {
    const fishPaths = [
      "/usr/bin/fish",
      "/usr/local/bin/fish",
      "/opt/homebrew/bin/fish",
      "/bin/fish",
      "fish"
    ];

    fishPaths.forEach(fishPath => {
      process.env["SHELL"] = fishPath;
      
      const shell = process.env["SHELL"] ?? "bash";
      const isFish = shell.includes("fish");
      const script = 'echo "test"';
      const args = isFish ? ["-c", script] : ["-c", "-l", script];
      
      expect(isFish).toBe(true);
      expect(args).toEqual(["-c", script]);
    });
  });

  it("should handle script with complex commands", () => {
    process.env["SHELL"] = "/usr/bin/fish";
    
    const shell = process.env["SHELL"] ?? "bash";
    const isFish = shell.includes("fish");
    const complexScript = `
      cd /tmp
      echo "Current directory: $(pwd)"
      ls -la
      eval "echo 'Complex command'"
    `;
    const args = isFish ? ["-c", complexScript] : ["-c", "-l", complexScript];
    
    expect(isFish).toBe(true);
    expect(args).toEqual(["-c", complexScript]);
    expect(args.length).toBe(2); // Only -c and script for fish
  });

  it("should handle script with complex commands for bash", () => {
    process.env["SHELL"] = "/bin/bash";
    
    const shell = process.env["SHELL"] ?? "bash";
    const isFish = shell.includes("fish");
    const complexScript = `
      cd /tmp
      echo "Current directory: $(pwd)"
      ls -la
      eval "echo 'Complex command'"
    `;
    const args = isFish ? ["-c", complexScript] : ["-c", "-l", complexScript];
    
    expect(isFish).toBe(false);
    expect(args).toEqual(["-c", "-l", complexScript]);
    expect(args.length).toBe(3); // -c, -l, and script for bash/zsh
  });
});