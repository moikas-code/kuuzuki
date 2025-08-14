/**
 * Wildcard pattern matching utility for permission system
 * Supports glob-style patterns with * and ** wildcards
 * Provides both enhanced kuuzuki API and OpenCode compatibility
 */

export namespace Wildcard {
  /**
   * Pattern matching result with priority information
   */
  export interface MatchResult {
    pattern: string;
    priority: number;
    specificity: number;
  }

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
   * Find all matching patterns with priority ordering
   * Returns the most specific match first, following OpenCode v0.4.3+ pattern priority
   * @param patterns - Array of wildcard patterns to test
   * @param text - The text to match against
   * @returns Array of matching patterns ordered by priority (most specific first)
   */
  export function all(patterns: string[], text: string): MatchResult[] {
    const matches: MatchResult[] = [];

    for (const pattern of patterns) {
      if (match(pattern, text)) {
        const priority = calculatePriority(pattern, text);
        const specificity = calculateSpecificity(pattern);
        
        matches.push({
          pattern,
          priority,
          specificity
        });
      }
    }

    // Sort by priority (higher first), then by specificity (higher first)
    return matches.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return b.specificity - a.specificity;
    });
  }

  /**
   * Calculate pattern priority based on match quality
   * Higher priority = more specific/exact match
   */
  function calculatePriority(pattern: string, text: string): number {
    // Exact match gets highest priority
    if (pattern === text) return 1000;

    // Count literal characters vs wildcards
    const literalChars = pattern.replace(/[*?]/g, '').length;
    const wildcardCount = (pattern.match(/[*?]/g) || []).length;
    
    // More literal characters = higher priority
    // Fewer wildcards = higher priority
    return literalChars * 10 - wildcardCount * 2;
  }

  /**
   * Calculate pattern specificity for tie-breaking
   * Higher specificity = more constrained pattern
   */
  function calculateSpecificity(pattern: string): number {
    let specificity = 0;
    
    // Exact characters add to specificity
    specificity += pattern.replace(/[*?]/g, '').length * 4;
    
    // Single-char wildcards (?) are more specific than multi-char (*)
    specificity += (pattern.match(/\?/g) || []).length * 2;
    specificity -= (pattern.match(/\*/g) || []).length * 1;
    
    // Patterns with word boundaries are more specific
    if (pattern.includes(' ')) specificity += 5;
    
    // Patterns starting/ending with literals are more specific
    if (pattern.length > 0 && !/[*?]/.test(pattern[0])) specificity += 3;
    if (pattern.length > 0 && !/[*?]/.test(pattern[pattern.length - 1])) specificity += 3;
    
    return specificity;
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
    return new RegExp(`^${regexPattern}$`);
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
   * Enhanced tool name pattern matching for configuration
   * Supports both exact tool names and wildcard patterns with priority-based matching
   * @param toolName - The tool name to match (e.g., "bash", "edit", "read")
   * @param patterns - Array of patterns to test against
   * @returns The best matching pattern with priority information or null if no match
   */
  export function matchToolName(toolName: string, patterns: string[]): string | null {
    const matches = all(patterns, toolName);
    return matches.length > 0 ? matches[0].pattern : null;
  }

  /**
   * Enhanced tool name pattern matching with full result information
   * @param toolName - The tool name to match
   * @param patterns - Array of patterns to test against
   * @returns The best matching result with priority and specificity or null if no match
   */
  export function matchToolNameWithResult(toolName: string, patterns: string[]): MatchResult | null {
    const matches = all(patterns, toolName);
    return matches.length > 0 ? matches[0] : null;
  }

  /**
   * Filter tool names based on wildcard patterns
   * @param toolNames - Array of tool names to filter
   * @param includePatterns - Patterns for tools to include (empty array means include all)
   * @param excludePatterns - Patterns for tools to exclude
   * @returns Filtered array of tool names
   */
  export function filterToolNames(
    toolNames: string[],
    includePatterns: string[] = [],
    excludePatterns: string[] = []
  ): string[] {
    let filtered = toolNames;

    // Apply include patterns if specified
    if (includePatterns.length > 0) {
      filtered = filtered.filter(toolName => 
        includePatterns.some(pattern => match(pattern, toolName))
      );
    }

    // Apply exclude patterns
    if (excludePatterns.length > 0) {
      filtered = filtered.filter(toolName => 
        !excludePatterns.some(pattern => match(pattern, toolName))
      );
    }

    return filtered;
  }

  /**
   * Get tool configuration priority for a given tool name
   * Higher priority means more specific configuration should be applied
   * @param toolName - The tool name
   * @param configPatterns - Configuration patterns with their priorities
   * @returns Priority score (higher = more specific)
   */
  export function getToolConfigPriority(
    toolName: string,
    configPatterns: Record<string, any>
  ): number {
    const patterns = Object.keys(configPatterns);
    const matches = all(patterns, toolName);
    return matches.length > 0 ? matches[0].priority : 0;
  }

  /**
   * Enhanced command pattern matching with priority
   * Used by permission system for accurate command matching
   * @param command - The command to match
   * @param patterns - Array of command patterns
   * @returns The best matching pattern with its priority, or null if no match
   */
  export function matchCommand(command: string, patterns: string[]): MatchResult | null {
    const matches = all(patterns, command);
    return matches.length > 0 ? matches[0] : null;
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
