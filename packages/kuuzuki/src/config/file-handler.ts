import { z } from "zod";
import { Log } from "../util/log";
import { ConfigSchema } from "./schema";
import { NamedError } from "../util/error";
import { type ParseError as JsoncParseError, parse as parseJsonc, printParseErrorCode } from "jsonc-parser";
import path from "path";
import { Filesystem } from "../util/filesystem";

export namespace ConfigFileHandler {
  const log = Log.create({ service: "config-file-handler" });

  // Enhanced configuration file discovery with priority
  export const CONFIG_FILE_PATTERNS = [
    // Kuuzuki-specific files (highest priority)
    { pattern: "kuuzuki.jsonc", priority: 100, type: "kuuzuki" as const },
    { pattern: "kuuzuki.json", priority: 95, type: "kuuzuki" as const },
    { pattern: ".kuuzuki.jsonc", priority: 90, type: "kuuzuki" as const },
    { pattern: ".kuuzuki.json", priority: 85, type: "kuuzuki" as const },
    
    // OpenCode compatibility files (medium priority)
    { pattern: "opencode.jsonc", priority: 80, type: "opencode" as const },
    { pattern: "opencode.json", priority: 75, type: "opencode" as const },
    { pattern: ".opencode.jsonc", priority: 70, type: "opencode" as const },
    { pattern: ".opencode.json", priority: 65, type: "opencode" as const },
    
    // Additional configuration files (lower priority)
    { pattern: "biome.jsonc", priority: 50, type: "biome" as const },
    { pattern: "biome.json", priority: 45, type: "biome" as const },
    { pattern: ".vscode/settings.json", priority: 40, type: "vscode" as const },
    { pattern: "package.json", priority: 35, type: "package" as const },
    { pattern: "tsconfig.json", priority: 30, type: "typescript" as const },
    
    // Legacy files (lowest priority)
    { pattern: "config.json", priority: 20, type: "legacy" as const },
    { pattern: ".config.json", priority: 15, type: "legacy" as const },
  ] as const;

  export type ConfigFileType = typeof CONFIG_FILE_PATTERNS[number]["type"];

  export interface ConfigFile {
    path: string;
    type: ConfigFileType;
    priority: number;
    exists: boolean;
    content?: any;
    errors?: string[];
    warnings?: string[];
  }

  export interface FileReference {
    path: string;
    resolvedPath: string;
    content: string;
    type: "file" | "env";
  }

  /**
   * Discover all configuration files in the project hierarchy
   */
  export async function discoverConfigFiles(
    startPath: string,
    rootPath: string
  ): Promise<ConfigFile[]> {
    const discoveredFiles: ConfigFile[] = [];

    for (const { pattern, priority, type } of CONFIG_FILE_PATTERNS) {
      try {
        const found = await Filesystem.findUp(pattern, startPath, rootPath);
        
        for (const filePath of found) {
          const exists = await Bun.file(filePath).exists();
          discoveredFiles.push({
            path: filePath,
            type,
            priority,
            exists,
          });
        }
      } catch (error) {
        log.debug(`Error discovering config files for pattern ${pattern}`, { error });
      }
    }

    // Sort by priority (highest first) and then by path specificity
    return discoveredFiles.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // Prefer files closer to the start path
      return a.path.length - b.path.length;
    });
  }

  /**
   * Load and parse a configuration file with enhanced error handling
   */
  export async function loadConfigFile(filePath: string): Promise<ConfigFile> {
    const fileInfo: ConfigFile = {
      path: filePath,
      type: inferConfigType(filePath),
      priority: getFilePriority(filePath),
      exists: false,
      errors: [],
      warnings: [],
    };

    try {
      const file = Bun.file(filePath);
      fileInfo.exists = await file.exists();
      
      if (!fileInfo.exists) {
        fileInfo.errors?.push(`File does not exist: ${filePath}`);
        return fileInfo;
      }

      let text = await file.text();
      if (!text.trim()) {
        fileInfo.warnings?.push(`File is empty: ${filePath}`);
        fileInfo.content = {};
        return fileInfo;
      }

      // Process file references and environment variables
      const processedText = await processFileReferences(text, filePath);
      const finalText = processEnvironmentVariables(processedText);

      // Parse based on file type
      if (fileInfo.type === "package") {
        fileInfo.content = await parsePackageJson(finalText, filePath);
      } else if (fileInfo.type === "typescript") {
        fileInfo.content = await parseTsConfig(finalText, filePath);
      } else if (fileInfo.type === "vscode") {
        fileInfo.content = await parseVSCodeSettings(finalText, filePath);
      } else if (fileInfo.type === "biome") {
        fileInfo.content = await parseBiomeConfig(finalText, filePath);
      } else {
        // Standard JSON/JSONC parsing
        fileInfo.content = await parseJsonConfig(finalText, filePath);
      }

      // Validate configuration if it's a kuuzuki/opencode config
      if (fileInfo.type === "kuuzuki" || fileInfo.type === "opencode") {
        try {
          fileInfo.content = ConfigSchema.validateConfig(fileInfo.content, filePath);
          
          // Update schema reference if missing
          if (!fileInfo.content.$schema) {
            fileInfo.content.$schema = ConfigSchema.SCHEMA_URL;
            fileInfo.warnings?.push("Added missing $schema reference");
          }
        } catch (error) {
          if (error instanceof ConfigSchema.ValidationError) {
            fileInfo.errors?.push(`Validation failed: ${error.data.issues.map(i => i.message).join(", ")}`);
          } else {
            fileInfo.errors?.push(`Validation error: ${error}`);
          }
        }
      }

    } catch (error) {
      fileInfo.errors?.push(`Failed to load file: ${error}`);
    }

    return fileInfo;
  }

  /**
   * Process file references in configuration text
   */
  async function processFileReferences(text: string, configPath: string): Promise<string> {
    const fileMatches = text.match(/"?\{file:([^}]+)\}"?/g);
    if (!fileMatches) return text;

    const configDir = path.dirname(configPath);
    const references: FileReference[] = [];

    for (const match of fileMatches) {
      const filePath = match.replace(/^"?\{file:/, "").replace(/\}"?$/, "");
      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(configDir, filePath);

      try {
        const content = await Bun.file(resolvedPath).text();
        references.push({
          path: filePath,
          resolvedPath,
          content,
          type: "file",
        });
        
        text = text.replace(match, JSON.stringify(content));
      } catch (error) {
        const errMsg = `bad file reference: "${match}"`;
        if ((error as any).code === "ENOENT") {
          throw new ConfigFileError(
            { path: configPath, message: `${errMsg} - ${resolvedPath} does not exist` },
            { cause: error }
          );
        }
        throw new ConfigFileError({ path: configPath, message: errMsg }, { cause: error });
      }
    }

    if (references.length > 0) {
      log.debug("Processed file references", { configPath, references: references.length });
    }

    return text;
  }

  /**
   * Process environment variable references in configuration text
   */
  function processEnvironmentVariables(text: string): string {
    // Handle {env:VAR_NAME} patterns
    text = text.replace(/\{env:([^}]+)\}/g, (_, varName) => {
      return process.env[varName] || "";
    });

    // Handle API key environment variables specifically
    const apiKeyEnvVars = [
      "ANTHROPIC_API_KEY",
      "CLAUDE_API_KEY",
      "OPENAI_API_KEY",
      "OPENROUTER_API_KEY",
      "GITHUB_TOKEN",
      "COPILOT_API_KEY",
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "AWS_BEARER_TOKEN_BEDROCK",
      "GOOGLE_API_KEY",
      "AZURE_API_KEY",
      "COHERE_API_KEY",
    ];

    for (const envVar of apiKeyEnvVars) {
      const value = process.env[envVar];
      if (value) {
        text = text.replace(new RegExp(`\\{env:${envVar}\\}`, "g"), value);
      }
    }

    return text;
  }

  /**
   * Parse JSON/JSONC configuration with enhanced error reporting
   */
  async function parseJsonConfig(text: string, filePath: string): Promise<any> {
    const errors: JsoncParseError[] = [];
    const data = parseJsonc(text, errors, { 
      allowTrailingComma: true,
      disallowComments: false,
    });

    if (errors.length > 0) {
      const errorMessages = errors.map((e) => {
        const lines = text.substring(0, e.offset).split("\n");
        const line = lines.length;
        const column = lines[lines.length - 1].length + 1;
        return `${printParseErrorCode(e.error)} at line ${line}, column ${column}`;
      });

      throw new ConfigFileError({
        path: filePath,
        message: `JSON parsing failed: ${errorMessages.join("; ")}`,
      });
    }

    return data || {};
  }

  /**
   * Parse package.json and extract relevant configuration
   */
  async function parsePackageJson(text: string, filePath: string): Promise<any> {
    const packageJson = JSON.parse(text);
    const config: any = {};

    // Extract kuuzuki-specific configuration from package.json
    if (packageJson.kuuzuki) {
      Object.assign(config, packageJson.kuuzuki);
    }

    // Extract scripts that might be relevant
    if (packageJson.scripts) {
      config.commands = {
        build: packageJson.scripts.build,
        test: packageJson.scripts.test,
        dev: packageJson.scripts.dev || packageJson.scripts.start,
        lint: packageJson.scripts.lint,
        typecheck: packageJson.scripts.typecheck || packageJson.scripts["type-check"],
      };
    }

    // Extract dependencies information
    if (packageJson.dependencies || packageJson.devDependencies) {
      config.dependencies = {
        runtime: Object.keys(packageJson.dependencies || {}),
        development: Object.keys(packageJson.devDependencies || {}),
      };
    }

    return config;
  }

  /**
   * Parse tsconfig.json and extract relevant configuration
   */
  async function parseTsConfig(text: string, filePath: string): Promise<any> {
    const tsconfig = await parseJsonConfig(text, filePath);
    const config: any = {};

    if (tsconfig.compilerOptions) {
      config.typescript = {
        target: tsconfig.compilerOptions.target,
        module: tsconfig.compilerOptions.module,
        moduleResolution: tsconfig.compilerOptions.moduleResolution,
        strict: tsconfig.compilerOptions.strict,
        esModuleInterop: tsconfig.compilerOptions.esModuleInterop,
      };
    }

    return config;
  }

  /**
   * Parse VS Code settings and extract relevant configuration
   */
  async function parseVSCodeSettings(text: string, filePath: string): Promise<any> {
    const settings = await parseJsonConfig(text, filePath);
    const config: any = {};

    // Extract editor preferences
    if (settings["editor.tabSize"]) {
      config.codeStyle = config.codeStyle || {};
      config.codeStyle.indentation = {
        type: settings["editor.insertSpaces"] ? "spaces" : "tabs",
        size: settings["editor.tabSize"],
      };
    }

    // Extract formatter preferences
    if (settings["editor.defaultFormatter"]) {
      config.codeStyle = config.codeStyle || {};
      config.codeStyle.formatter = settings["editor.defaultFormatter"];
    }

    return config;
  }

  /**
   * Parse Biome configuration and extract relevant settings
   */
  async function parseBiomeConfig(text: string, filePath: string): Promise<any> {
    const biome = await parseJsonConfig(text, filePath);
    const config: any = {};

    if (biome.formatter) {
      config.codeStyle = {
        formatter: "biome",
        indentation: {
          type: biome.formatter.indentStyle === "space" ? "spaces" : "tabs",
          size: biome.formatter.indentWidth || 2,
        },
        lineWidth: biome.formatter.lineWidth,
      };
    }

    if (biome.linter) {
      config.codeStyle = config.codeStyle || {};
      config.codeStyle.linter = "biome";
    }

    return config;
  }

  /**
   * Infer configuration file type from path
   */
  function inferConfigType(filePath: string): ConfigFileType {
    const fileName = path.basename(filePath);
    
    for (const { pattern, type } of CONFIG_FILE_PATTERNS) {
      if (fileName === pattern || filePath.endsWith(pattern)) {
        return type;
      }
    }
    
    return "legacy";
  }

  /**
   * Get file priority based on path
   */
  function getFilePriority(filePath: string): number {
    const fileName = path.basename(filePath);
    
    for (const { pattern, priority } of CONFIG_FILE_PATTERNS) {
      if (fileName === pattern || filePath.endsWith(pattern)) {
        return priority;
      }
    }
    
    return 10; // Default low priority
  }

  /**
   * Merge multiple configuration files with priority handling
   */
  export function mergeConfigFiles(configFiles: ConfigFile[]): any {
    const merged: any = {};
    const mergeLog: Array<{ file: string; type: ConfigFileType; priority: number }> = [];

    // Sort by priority (lowest first, so higher priority overwrites)
    const sortedFiles = configFiles
      .filter(f => f.exists && f.content && !f.errors?.length)
      .sort((a, b) => a.priority - b.priority);

    for (const configFile of sortedFiles) {
      if (configFile.content) {
        // Deep merge configuration
        mergeDeep(merged, configFile.content);
        mergeLog.push({
          file: configFile.path,
          type: configFile.type,
          priority: configFile.priority,
        });
      }
    }

    if (mergeLog.length > 0) {
      log.debug("Merged configuration files", { files: mergeLog });
    }

    return merged;
  }

  /**
   * Deep merge utility function
   */
  function mergeDeep(target: any, source: any): any {
    for (const key in source) {
      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        mergeDeep(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  /**
   * Write configuration file with proper formatting
   */
  export async function writeConfigFile(
    filePath: string,
    config: any,
    options: {
      format?: "json" | "jsonc";
      indent?: number;
      addSchema?: boolean;
    } = {}
  ): Promise<void> {
    const { format = "jsonc", indent = 2, addSchema = true } = options;

    // Ensure schema is set for kuuzuki/opencode configs
    if (addSchema && !config.$schema) {
      config.$schema = ConfigSchema.SCHEMA_URL;
    }

    // Format the configuration
    const formatted = JSON.stringify(config, null, indent);
    
    await Bun.write(filePath, formatted);
    log.info("Configuration file written", { path: filePath, format });
  }

  /**
   * Backup configuration file before modification
   */
  export async function backupConfigFile(filePath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `${filePath}.backup.${timestamp}`;
    
    try {
      const content = await Bun.file(filePath).text();
      await Bun.write(backupPath, content);
      log.info("Configuration backup created", { original: filePath, backup: backupPath });
      return backupPath;
    } catch (error) {
      throw new ConfigFileError({
        path: filePath,
        message: `Failed to create backup: ${error}`,
      });
    }
  }

  /**
   * Validate configuration file without loading
   */
  export async function validateConfigFile(filePath: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const result = { valid: true, errors: [] as string[], warnings: [] as string[] };

    try {
      const configFile = await loadConfigFile(filePath);
      
      if (configFile.errors?.length) {
        result.valid = false;
        result.errors.push(...configFile.errors);
      }
      
      if (configFile.warnings?.length) {
        result.warnings.push(...configFile.warnings);
      }
    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation failed: ${error}`);
    }

    return result;
  }

  // Error types
  export const ConfigFileError = NamedError.create(
    "ConfigFileError",
    z.object({
      path: z.string(),
      message: z.string(),
      type: z.enum(["parse", "reference", "validation", "io"]).optional(),
    })
  );

  export const FileReferenceError = NamedError.create(
    "FileReferenceError",
    z.object({
      configPath: z.string(),
      referencePath: z.string(),
      message: z.string(),
    })
  );
}