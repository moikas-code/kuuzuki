import { exists } from "fs/promises";
import { dirname, join, relative, resolve } from "path";

export namespace Filesystem {
  export function overlaps(a: string, b: string) {
    const relA = relative(a, b);
    const relB = relative(b, a);
    return !relA || !relA.startsWith("..") || !relB || !relB.startsWith("..");
  }

  /**
   * Check if a child path is contained within a parent directory
   * Fixed version that properly checks containment for security
   * @param parent - The parent directory path
   * @param child - The child path to check
   * @returns true if child is within parent directory
   */
  export function contains(parent: string, child: string): boolean {
    try {
      // Resolve both paths to absolute paths
      const resolvedParent = resolve(parent);
      const resolvedChild = resolve(child);

      // Get relative path from parent to child
      const relativePath = relative(resolvedParent, resolvedChild);

      // If relative path starts with '..' or is empty, child is outside or same as parent
      return relativePath !== "" && !relativePath.startsWith("..");
    } catch {
      // If path resolution fails, assume unsafe
      return false;
    }
  }

  /**
   * Validate that a path is safe for file operations
   * @param basePath - The base directory path
   * @param targetPath - The target path to validate
   * @throws Error if path is outside base directory
   */
  export function validatePath(basePath: string, targetPath: string): void {
    if (!contains(basePath, targetPath)) {
      throw new Error(
        `Path '${targetPath}' is outside the allowed directory '${basePath}' and cannot be accessed.`,
      );
    }
  }

  /**
   * Check if a command argument represents a file path that needs validation
   * @param arg - Command argument to check
   * @returns true if argument looks like a file path
   */
  export function isFilePath(arg: string): boolean {
    // Skip flags and options
    if (arg.startsWith("-") || arg.startsWith("+")) {
      return false;
    }

    // Skip URLs
    if (arg.includes("://")) {
      return false;
    }

    // Skip environment variables
    if (arg.startsWith("$")) {
      return false;
    }

    // Consider it a file path if it contains path separators or looks like a filename
    return (
      arg.includes("/") ||
      arg.includes("\\") ||
      arg.includes(".") ||
      !arg.includes(" ")
    );
  }

  /**
   * Extract file paths from command arguments for validation
   * @param command - Array of command parts
   * @returns Array of potential file paths
   */
  export function extractFilePaths(command: string[]): string[] {
    if (command.length === 0) return [];

    const commandName = command[0];
    const args = command.slice(1);

    // Commands that typically operate on files
    const fileCommands = [
      "cd",
      "rm",
      "cp",
      "mv",
      "mkdir",
      "touch",
      "chmod",
      "chown",
      "cat",
      "ls",
      "find",
    ];

    if (!fileCommands.includes(commandName)) {
      return [];
    }

    // Extract file paths from arguments
    return args.filter((arg) => isFilePath(arg));
  }

  /**
   * Validate all file paths in a command against base directory
   * @param basePath - The base directory path
   * @param command - Array of command parts
   * @throws Error if any file path is outside base directory
   */
  export function validateCommandPaths(
    basePath: string,
    command: string[],
  ): void {
    const filePaths = extractFilePaths(command);

    for (const filePath of filePaths) {
      try {
        // Use resolve to handle relative paths and symlinks
        const resolved = resolve(filePath);
        validatePath(basePath, resolved);
      } catch (error) {
        throw new Error(
          `Command references path '${filePath}' outside of ${basePath}, which is not allowed for security reasons.`,
        );
      }
    }
  }

  // Existing functions (preserved for backward compatibility)
  export async function findUp(target: string, start: string, stop?: string) {
    let current = start;
    const result = [];
    while (true) {
      const search = join(current, target);
      if (await exists(search)) result.push(search);
      if (stop === current) break;
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return result;
  }

  export async function* up(options: {
    targets: string[];
    start: string;
    stop?: string;
  }) {
    const { targets, start, stop } = options;
    let current = start;
    while (true) {
      for (const target of targets) {
        const search = join(current, target);
        if (await exists(search)) yield search;
      }
      if (stop === current) break;
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }

  export async function globUp(pattern: string, start: string, stop?: string) {
    let current = start;
    const result = [];
    while (true) {
      try {
        const glob = new Bun.Glob(pattern);
        for await (const match of glob.scan({
          cwd: current,
          absolute: true,
          onlyFiles: true,
          followSymlinks: true,
          dot: true,
        })) {
          result.push(match);
        }
      } catch {
        // Skip invalid glob patterns
      }
      if (stop === current) break;
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return result;
  }
}
