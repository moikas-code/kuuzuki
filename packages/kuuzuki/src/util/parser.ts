/**
 * Command parsing utilities for bash command analysis
 * Provides both AST parsing (when available) and fallback parsing
 * Falls back gracefully when tree-sitter is not available
 */

import { lazy } from "./lazy";

export namespace Parser {
  /**
   * Lazy-loaded tree-sitter parser for bash
   * Will be null if tree-sitter is not available
   */
  const bashParser = lazy(async () => {
    try {
      // Use dynamic require to avoid TypeScript errors
      const TreeSitter = await (
        Function('return import("tree-sitter")')() as Promise<any>
      )
        .then((m) => m.default)
        .catch(() => null);

      const Bash = await (
        Function('return import("tree-sitter-bash")')() as Promise<any>
      ).catch(() => null);

      if (!TreeSitter || !Bash) {
        return null;
      }

      const parser = new TreeSitter();
      parser.setLanguage(Bash.language);
      return parser;
    } catch {
      return null;
    }
  });

  /**
   * Parse a bash command into an AST
   * @param command - The bash command string to parse
   * @returns Tree-sitter tree or null if parsing fails
   */
  export async function parseBash(command: string) {
    try {
      const parser = await bashParser();
      if (!parser) return null;
      return parser.parse(command);
    } catch {
      return null;
    }
  }

  /**
   * Extract command nodes from a parsed AST
   * @param tree - Tree-sitter tree
   * @returns Array of command nodes
   */
  export function extractCommands(tree: any): any[] {
    if (!tree || !tree.rootNode) return [];

    try {
      return tree.rootNode.descendantsOfType("command");
    } catch {
      return [];
    }
  }

  /**
   * Extract command parts (name and arguments) from a command node
   * @param commandNode - Tree-sitter command node
   * @returns Array of command parts
   */
  export function extractCommandParts(commandNode: any): string[] {
    if (!commandNode) return [];

    try {
      const parts: string[] = [];

      for (let i = 0; i < commandNode.childCount; i++) {
        const child = commandNode.child(i);
        if (!child) continue;

        // Include relevant node types for command analysis
        if (
          child.type === "command_name" ||
          child.type === "word" ||
          child.type === "string" ||
          child.type === "raw_string" ||
          child.type === "concatenation"
        ) {
          parts.push(child.text);
        }
      }

      return parts;
    } catch {
      return [];
    }
  }

  /**
   * Parse a bash command and extract all command parts
   * @param command - The bash command string
   * @returns Array of arrays, each containing command parts
   */
  export async function parseCommandParts(
    command: string,
  ): Promise<string[][]> {
    const tree = await parseBash(command);
    if (!tree) {
      // Fallback to simple string splitting if AST parsing fails
      return [simpleParse(command)];
    }

    const commands = extractCommands(tree);
    return commands.map((cmd) => extractCommandParts(cmd));
  }

  /**
   * Check if tree-sitter is available and working
   * @returns true if tree-sitter can be used
   */
  export async function isAvailable(): Promise<boolean> {
    try {
      const parser = await bashParser();
      return parser !== null;
    } catch {
      return false;
    }
  }

  /**
   * Simple fallback parser for when tree-sitter is not available
   * @param command - The bash command string
   * @returns Array of command parts
   */
  export function simpleParse(command: string): string[] {
    // Basic command parsing - split on whitespace but respect quotes
    const parts: string[] = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";

    for (let i = 0; i < command.length; i++) {
      const char = command[i];

      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        current += char;
        quoteChar = "";
      } else if (!inQuotes && /\s/.test(char)) {
        if (current.trim()) {
          parts.push(current.trim());
          current = "";
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts;
  }
}
