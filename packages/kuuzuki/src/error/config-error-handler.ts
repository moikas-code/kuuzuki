import { Log } from "../util/log"
import { ErrorHandler } from "./handler"
import { 
  KuuzukiError, 
  ValidationError,
  FileError,
  FileNotFoundError,
  FilePermissionError
} from "./types"
import { safeJsonParse, JsonParseError } from "../util/json-utils"
import { z } from "zod"

const log = Log.create({ service: "config-error-handler" })

export interface ConfigValidationContext {
  configPath: string
  configType: 'agentrc' | 'package.json' | 'environment' | 'permission'
  sessionId?: string
  operation: 'read' | 'write' | 'validate' | 'parse'
}

export interface ConfigValidationResult {
  success: boolean
  config?: any
  error?: KuuzukiError
  warnings: string[]
  suggestions: string[]
}

export class ConfigErrorHandler {
  private static readonly REQUIRED_AGENTRC_FIELDS = [
    'project.name',
    'commands',
    'codeStyle'
  ]

  private static readonly SENSITIVE_CONFIG_FIELDS = [
    'apiKey',
    'secret',
    'token',
    'password',
    'auth',
    'credential'
  ]

  /**
   * Validate and parse configuration with comprehensive error handling
   */
  static async validateConfig(
    configContent: string,
    context: ConfigValidationContext
  ): Promise<ConfigValidationResult> {
    const warnings: string[] = []
    const suggestions: string[] = []

    try {
      // Parse JSON with detailed error handling
      let parsedConfig: any
      try {
        parsedConfig = safeJsonParse(configContent, context.configPath)
      } catch (error) {
        if (error instanceof JsonParseError) {
          return {
            success: false,
            error: new ValidationError(
              `Invalid JSON in ${context.configType}`,
              "CONFIG_INVALID_JSON",
              this.getJsonErrorHelp(error.message, context.configType),
              { 
                sessionId: context.sessionId,
                metadata: { 
                  configPath: context.configPath,
                  configType: context.configType,
                  parseError: error.message
                }
              }
            ),
            warnings,
            suggestions: this.getJsonFixSuggestions(error.message)
          }
        }
        throw error
      }

      // Type-specific validation
      const validationResult = await this.validateConfigType(parsedConfig, context)
      if (!validationResult.success) {
        return {
          ...validationResult,
          warnings,
          suggestions: [...suggestions, ...validationResult.suggestions]
        }
      }

      // Security validation
      const securityIssues = this.validateConfigSecurity(parsedConfig, context)
      warnings.push(...securityIssues.warnings)
      suggestions.push(...securityIssues.suggestions)

      // Structure validation
      const structureIssues = this.validateConfigStructure(parsedConfig, context)
      warnings.push(...structureIssues.warnings)
      suggestions.push(...structureIssues.suggestions)

      return {
        success: true,
        config: parsedConfig,
        warnings,
        suggestions
      }

    } catch (error) {
      const handledError = ErrorHandler.handle(error, {
        sessionId: context.sessionId,
        metadata: {
          configPath: context.configPath,
          configType: context.configType,
          operation: context.operation
        }
      })

      return {
        success: false,
        error: handledError,
        warnings,
        suggestions
      }
    }
  }

  /**
   * Handle configuration file access errors
   */
  static handleConfigFileError(
    error: unknown,
    context: ConfigValidationContext
  ): KuuzukiError {
    const errorContext = {
      sessionId: context.sessionId,
      metadata: {
        configPath: context.configPath,
        configType: context.configType,
        operation: context.operation
      }
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      // File not found
      if (message.includes('enoent') || message.includes('not found')) {
        return new FileNotFoundError(context.configPath, {
          ...errorContext,
          metadata: {
            ...errorContext.metadata,
            suggestions: this.getFileNotFoundSuggestions(context)
          }
        })
      }

      // Permission denied
      if (message.includes('eacces') || message.includes('permission denied')) {
        return new FilePermissionError(
          context.configPath,
          context.operation,
          {
            ...errorContext,
            metadata: {
              ...errorContext.metadata,
              suggestions: this.getPermissionSuggestions(context)
            }
          }
        )
      }

      // File too large
      if (message.includes('file too large') || message.includes('efbig')) {
        return new FileError(
          `Configuration file too large: ${context.configPath}`,
          "CONFIG_FILE_TOO_LARGE",
          `The configuration file "${context.configPath}" is too large to process. Please reduce its size.`,
          errorContext
        )
      }
    }

    return ErrorHandler.handle(error, errorContext)
  }

  /**
   * Validate specific configuration types
   */
  private static async validateConfigType(
    config: any,
    context: ConfigValidationContext
  ): Promise<ConfigValidationResult> {
    const warnings: string[] = []
    const suggestions: string[] = []

    switch (context.configType) {
      case 'agentrc':
        return this.validateAgentrcConfig(config, context)
      
      case 'package.json':
        return this.validatePackageJsonConfig(config, context)
      
      case 'environment':
        return this.validateEnvironmentConfig(config, context)
      
      case 'permission':
        return this.validatePermissionConfig(config, context)
      
      default:
        return {
          success: true,
          config,
          warnings,
          suggestions
        }
    }
  }

  /**
   * Validate .agentrc configuration
   */
  private static validateAgentrcConfig(
    config: any,
    context: ConfigValidationContext
  ): ConfigValidationResult {
    const warnings: string[] = []
    const suggestions: string[] = []

    // Check required fields
    for (const field of this.REQUIRED_AGENTRC_FIELDS) {
      if (!this.hasNestedProperty(config, field)) {
        warnings.push(`Missing required field: ${field}`)
        suggestions.push(`Add "${field}" to your .agentrc configuration`)
      }
    }

    // Validate project structure
    if (config.project) {
      if (!config.project.name) {
        warnings.push("Project name is missing")
        suggestions.push("Add a project name to help identify your configuration")
      }

      if (!config.project.description) {
        suggestions.push("Consider adding a project description for better documentation")
      }
    }

    // Validate commands
    if (config.commands) {
      const invalidCommands = Object.entries(config.commands).filter(
        ([key, value]) => typeof value !== 'string'
      )
      
      if (invalidCommands.length > 0) {
        warnings.push(`Invalid command definitions: ${invalidCommands.map(([k]) => k).join(', ')}`)
        suggestions.push("All commands should be strings")
      }
    }

    // Validate code style
    if (config.codeStyle) {
      const requiredStyleFields = ['language', 'formatter', 'linter']
      for (const field of requiredStyleFields) {
        if (!config.codeStyle[field]) {
          suggestions.push(`Consider specifying codeStyle.${field} for better consistency`)
        }
      }
    }

    return {
      success: warnings.length === 0,
      config,
      warnings,
      suggestions,
      error: warnings.length > 0 ? new ValidationError(
        "Invalid .agentrc configuration",
        "AGENTRC_VALIDATION_FAILED",
        `Configuration validation failed: ${warnings.join(', ')}`,
        { 
          sessionId: context.sessionId,
          metadata: { warnings, suggestions }
        }
      ) : undefined
    }
  }

  /**
   * Validate package.json configuration
   */
  private static validatePackageJsonConfig(
    config: any,
    context: ConfigValidationContext
  ): ConfigValidationResult {
    const warnings: string[] = []
    const suggestions: string[] = []

    // Check required fields
    if (!config.name) {
      warnings.push("Package name is required")
    }

    if (!config.version) {
      warnings.push("Package version is required")
    }

    // Validate scripts
    if (config.scripts) {
      const dangerousScripts = Object.entries(config.scripts).filter(
        ([key, value]) => typeof value === 'string' && (
          value.includes('rm -rf') ||
          value.includes('sudo') ||
          value.includes('curl') && value.includes('| sh')
        )
      )

      if (dangerousScripts.length > 0) {
        warnings.push(`Potentially dangerous scripts detected: ${dangerousScripts.map(([k]) => k).join(', ')}`)
        suggestions.push("Review scripts for security implications")
      }
    }

    return {
      success: warnings.length === 0,
      config,
      warnings,
      suggestions
    }
  }

  /**
   * Validate environment configuration
   */
  private static validateEnvironmentConfig(
    config: any,
    context: ConfigValidationContext
  ): ConfigValidationResult {
    const warnings: string[] = []
    const suggestions: string[] = []

    // Check for exposed secrets
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string' && this.looksLikeSecret(value)) {
        warnings.push(`Potential secret exposed in environment variable: ${key}`)
        suggestions.push(`Consider using a secure secret management system for ${key}`)
      }
    }

    return {
      success: true,
      config,
      warnings,
      suggestions
    }
  }

  /**
   * Validate permission configuration
   */
  private static validatePermissionConfig(
    config: any,
    context: ConfigValidationContext
  ): ConfigValidationResult {
    const warnings: string[] = []
    const suggestions: string[] = []

    // Validate permission structure
    if (config.permission) {
      const validActions = ['allow', 'deny', 'ask']
      
      for (const [tool, permissions] of Object.entries(config.permission)) {
        if (typeof permissions === 'object' && permissions !== null) {
          for (const [pattern, action] of Object.entries(permissions)) {
            if (!validActions.includes(action as string)) {
              warnings.push(`Invalid permission action "${action}" for ${tool}.${pattern}`)
              suggestions.push(`Use one of: ${validActions.join(', ')}`)
            }
          }
        }
      }
    }

    return {
      success: warnings.length === 0,
      config,
      warnings,
      suggestions
    }
  }

  /**
   * Validate configuration security
   */
  private static validateConfigSecurity(
    config: any,
    context: ConfigValidationContext
  ): { warnings: string[], suggestions: string[] } {
    const warnings: string[] = []
    const suggestions: string[] = []

    // Check for sensitive data
    this.scanForSensitiveData(config, '', warnings, suggestions)

    // Check for overly permissive permissions
    if (config.permission) {
      const overlyPermissive = this.findOverlyPermissiveRules(config.permission)
      if (overlyPermissive.length > 0) {
        warnings.push(`Overly permissive rules detected: ${overlyPermissive.join(', ')}`)
        suggestions.push("Consider using more restrictive permissions for security")
      }
    }

    return { warnings, suggestions }
  }

  /**
   * Validate configuration structure
   */
  private static validateConfigStructure(
    config: any,
    context: ConfigValidationContext
  ): { warnings: string[], suggestions: string[] } {
    const warnings: string[] = []
    const suggestions: string[] = []

    // Check for circular references
    try {
      JSON.stringify(config)
    } catch (error) {
      if (error instanceof Error && error.message.includes('circular')) {
        warnings.push("Circular reference detected in configuration")
        suggestions.push("Remove circular references from your configuration")
      }
    }

    // Check for excessively deep nesting
    const maxDepth = this.getObjectDepth(config)
    if (maxDepth > 10) {
      warnings.push(`Configuration is deeply nested (${maxDepth} levels)`)
      suggestions.push("Consider flattening your configuration structure")
    }

    return { warnings, suggestions }
  }

  /**
   * Helper methods
   */
  private static hasNestedProperty(obj: any, path: string): boolean {
    return path.split('.').reduce((current, key) => current?.[key], obj) !== undefined
  }

  private static looksLikeSecret(value: string): boolean {
    // Basic heuristics for detecting secrets
    return (
      value.length > 20 &&
      /^[A-Za-z0-9+/=_-]+$/.test(value) &&
      !/^[0-9]+$/.test(value) // Not just numbers
    )
  }

  private static scanForSensitiveData(
    obj: any,
    path: string,
    warnings: string[],
    suggestions: string[]
  ): void {
    if (typeof obj !== 'object' || obj === null) return

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key
      
      if (this.SENSITIVE_CONFIG_FIELDS.some(field => 
        key.toLowerCase().includes(field.toLowerCase())
      )) {
        warnings.push(`Sensitive field detected: ${currentPath}`)
        suggestions.push(`Consider using environment variables for ${currentPath}`)
      }

      if (typeof value === 'object') {
        this.scanForSensitiveData(value, currentPath, warnings, suggestions)
      }
    }
  }

  private static findOverlyPermissiveRules(permissions: any): string[] {
    const overly: string[] = []
    
    for (const [tool, rules] of Object.entries(permissions)) {
      if (typeof rules === 'object' && rules !== null) {
        for (const [pattern, action] of Object.entries(rules)) {
          if (action === 'allow' && (pattern === '*' || pattern === '**')) {
            overly.push(`${tool}.${pattern}`)
          }
        }
      }
    }
    
    return overly
  }

  private static getObjectDepth(obj: any, depth = 0): number {
    if (typeof obj !== 'object' || obj === null) return depth
    
    return Math.max(
      depth,
      ...Object.values(obj).map(value => this.getObjectDepth(value, depth + 1))
    )
  }

  private static getJsonErrorHelp(errorMessage: string, configType: string): string {
    if (errorMessage.includes('Unexpected token')) {
      return `JSON syntax error in ${configType}. Check for missing commas, quotes, or brackets.`
    }
    if (errorMessage.includes('Unexpected end')) {
      return `Incomplete JSON in ${configType}. Check for missing closing brackets or braces.`
    }
    return `Invalid JSON format in ${configType}. Please check the syntax.`
  }

  private static getJsonFixSuggestions(errorMessage: string): string[] {
    const suggestions: string[] = []
    
    if (errorMessage.includes('Unexpected token')) {
      suggestions.push("Check for missing commas between object properties")
      suggestions.push("Ensure all strings are properly quoted")
      suggestions.push("Verify bracket and brace matching")
    }
    
    if (errorMessage.includes('Unexpected end')) {
      suggestions.push("Check for missing closing brackets ']' or braces '}'")
      suggestions.push("Ensure the JSON structure is complete")
    }
    
    suggestions.push("Use a JSON validator to check syntax")
    suggestions.push("Consider using a code editor with JSON syntax highlighting")
    
    return suggestions
  }

  private static getFileNotFoundSuggestions(context: ConfigValidationContext): string[] {
    const suggestions: string[] = []
    
    switch (context.configType) {
      case 'agentrc':
        suggestions.push("Create a .agentrc file in your project root")
        suggestions.push("Use 'kuuzuki init' to generate a default configuration")
        break
      case 'package.json':
        suggestions.push("Initialize a new npm project with 'npm init'")
        suggestions.push("Ensure you're in the correct project directory")
        break
      default:
        suggestions.push(`Create the missing ${context.configType} configuration file`)
    }
    
    return suggestions
  }

  private static getPermissionSuggestions(context: ConfigValidationContext): string[] {
    return [
      `Check file permissions for ${context.configPath}`,
      "Ensure you have read/write access to the configuration directory",
      "Try running with appropriate permissions or as the file owner"
    ]
  }
}