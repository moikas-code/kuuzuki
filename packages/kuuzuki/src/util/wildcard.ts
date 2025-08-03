/**
 * Wildcard pattern matching utility for permission system
 * Supports glob-style patterns with * and ** wildcards
 * Provides both enhanced kuuzuki API and OpenCode compatibility
 */

export namespace Wildcard {
  /**
   * Check if a string matches a wildcard pattern
   * @param pattern - The wildcard pattern (e.g., "git *", "rm -rf *", "**")
   * @param text - The text to match against
   * @returns true if the text matches the pattern
   */
  export function match(pattern: string, text: string): boolean {
    // Handle exact matches first
    if (pattern === text) return true;

    // Handle universal wildcard
    if (pattern === "**" || pattern === "*") return true;

    // Convert glob pattern to regex
    const regex = globToRegex(pattern);
    return regex.test(text);
  }

  /**
   * Check if any of the patterns match the text
   * @param patterns - Array of wildcard patterns
   * @param text - The text to match against
   * @returns true if any pattern matches
   */
  export function matchAny(patterns: string[], text: string): boolean {
    return patterns.some((pattern) => match(pattern, text));
  }

  /**
   * Convert a glob pattern to a regular expression
   * @param pattern - The glob pattern
   * @returns RegExp object
   */
  function globToRegex(pattern: string): RegExp {
    // Escape special regex characters except * and ?
    let regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "___DOUBLESTAR___")
      .replace(/\*/g, ".*")
      .replace(/___DOUBLESTAR___/g, ".*")
      .replace(/\?/g, ".");

    // Anchor the pattern to match the entire string
    return new RegExp(`^${regexPattern}$`, "i");
  }

  /**
   * Validate that a pattern is well-formed
   * @param pattern - The pattern to validate
   * @returns true if the pattern is valid
   */
  export function isValidPattern(pattern: string): boolean {
    try {
      globToRegex(pattern);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get examples of what a pattern would match
   * @param pattern - The wildcard pattern
   * @returns Array of example matches
   */
  export function getExamples(pattern: string): string[] {
    const examples: string[] = [];

    if (pattern === "**" || pattern === "*") {
      return ["git status", "ls -la", "npm install", "rm file.txt"];
    }

    if (pattern.includes("git")) {
      examples.push("git status", "git add .", "git commit -m 'message'");
    }

    if (pattern.includes("rm")) {
      examples.push("rm file.txt", "rm -rf directory");
    }

    if (pattern.includes("npm")) {
      examples.push("npm install", "npm run build", "npm test");
    }

    if (pattern.includes("curl")) {
      examples.push(
        "curl https://api.example.com",
        "curl -X POST https://api.example.com",
      );
    }

    return examples.length > 0 ? examples : [pattern.replace(/\*/g, "example")];
  }

  // OpenCode Compatibility Functions
  // These maintain the exact OpenCode API while delegating to our enhanced implementation

  /**
   * OpenCode-compatible match function with parameter order (str, pattern)
   * For command patterns, treats "git push" as "git push*" (implicit wildcard)
   * @param str - The string to test
   * @param pattern - The wildcard pattern
   * @returns true if the string matches the pattern
   */
  export function matchOpenCode(str: string, pattern: string): boolean {
    // For command patterns without wildcards, add implicit wildcard for subcommands
    // e.g., "git push" should match "git push origin main"
    if (!pattern.includes("*") && !pattern.includes("?")) {
      const patternParts = pattern.trim().split(/\s+/);
      const strParts = str.trim().split(/\s+/);

      // If pattern has fewer parts than string, check if string starts with pattern
      if (patternParts.length <= strParts.length) {
        const matches = patternParts.every(
          (part, index) => part === strParts[index],
        );
        if (matches) return true;
      }
    }

    return match(pattern, str); // Note: parameter order swap for OpenCode compatibility
  }

  /**
   * OpenCode-style simple wildcard matching (for exact compatibility)
   * Uses OpenCode's regex approach but with our enhanced error handling
   * @param str - The string to test
   * @param pattern - The wildcard pattern
   * @returns true if the string matches the pattern
   */
  export function matchOpenCodeStyle(str: string, pattern: string): boolean {
    try {
      const regex = new RegExp(
        "^" +
          pattern
            .replace(/[.+^${}()|[\]\\]/g, "\\$&") // escape special regex chars
            .replace(/\*/g, ".*") // * becomes .*
            .replace(/\?/g, ".") + // ? becomes .
          "$",
        "s", // s flag enables multiline matching
      );
      return regex.test(str);
    } catch {
      // Fallback to our enhanced implementation if OpenCode style fails
      return match(pattern, str);
    }
  }
}
