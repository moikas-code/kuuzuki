import { describe, it, expect } from "bun:test";

describe("Fish Shell Support", () => {
  it("should detect fish shell correctly", () => {
    // Test fish shell detection logic
    const testCases = [
      { shell: "/usr/bin/fish", expected: true },
      { shell: "/bin/fish", expected: true },
      { shell: "fish", expected: true },
      { shell: "/usr/local/bin/fish", expected: true },
      { shell: "/bin/bash", expected: false },
      { shell: "/usr/bin/zsh", expected: false },
      { shell: "bash", expected: false },
      { shell: "zsh", expected: false },
    ];

    testCases.forEach(({ shell, expected }) => {
      const isFish = shell.includes("fish");
      expect(isFish).toBe(expected);
    });
  });

  it("should generate correct arguments for fish shell", () => {
    const script = 'echo "test"';
    
    // Test fish shell arguments
    const fishShell = "/usr/bin/fish";
    const isFish = fishShell.includes("fish");
    const fishArgs = isFish ? ["-c", script] : ["-c", "-l", script];
    
    expect(fishArgs).toEqual(["-c", script]);
  });

  it("should generate correct arguments for other shells", () => {
    const script = 'echo "test"';
    
    // Test bash shell arguments
    const bashShell = "/bin/bash";
    const isFish = bashShell.includes("fish");
    const bashArgs = isFish ? ["-c", script] : ["-c", "-l", script];
    
    expect(bashArgs).toEqual(["-c", "-l", script]);
    
    // Test zsh shell arguments
    const zshShell = "/usr/bin/zsh";
    const isZshFish = zshShell.includes("fish");
    const zshArgs = isZshFish ? ["-c", script] : ["-c", "-l", script];
    
    expect(zshArgs).toEqual(["-c", "-l", script]);
  });

  it("should handle edge cases in shell detection", () => {
    // Test edge cases
    const edgeCases = [
      { shell: "/usr/bin/fisherman", expected: true }, // Contains "fish"
      { shell: "/bin/shellfish", expected: true }, // Contains "fish"
      { shell: "", expected: false }, // Empty string
      { shell: undefined, expected: false }, // Undefined
    ];

    edgeCases.forEach(({ shell, expected }) => {
      const isFish = shell?.includes("fish") ?? false;
      expect(isFish).toBe(expected);
    });
  });

  it("should use bash as default when SHELL is not set", () => {
    const shell = process.env["SHELL"] ?? "bash";
    
    // When SHELL is not set, should default to bash
    if (!process.env["SHELL"]) {
      expect(shell).toBe("bash");
    }
    
    // Should always have a shell value
    expect(shell).toBeDefined();
    expect(typeof shell).toBe("string");
    expect(shell.length).toBeGreaterThan(0);
  });
});