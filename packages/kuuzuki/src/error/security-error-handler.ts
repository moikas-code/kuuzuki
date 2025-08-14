import { Log } from "../util/log"
import { ErrorHandler } from "./handler"
import { 
  KuuzukiError, 
  ValidationError,
  FilePermissionError,
  AuthError
} from "./types"

const log = Log.create({ service: "security-error-handler" })

export interface SecurityContext {
  operation: string
  resource: string
  sessionId?: string
  userId?: string
  agentName?: string
  requestId?: string
}

export interface SecurityValidationResult {
  allowed: boolean
  error?: KuuzukiError
  warnings: string[]
  blockedReasons: string[]
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

export class SecurityErrorHandler {
  private static readonly DANGEROUS_PATTERNS = [
    // Command injection
    /;\s*rm\s+-rf\s*\/|;\s*rm\s+-rf\s*\*/,
    /\|\s*sh\s*$|\|\s*bash\s*$/,
    /`.*rm.*`|\$\(.*rm.*\)/,
    
    // Path traversal
    /\.\.\/|\.\.\\|\.\.\%2f|\.\.\%5c/i,
    /\/etc\/passwd|\/etc\/shadow|\/etc\/hosts/i,
    /\\windows\\system32|\\windows\\syswow64/i,
    
    // Code injection
    /<script|javascript:|data:text\/html/i,
    /eval\s*\(|Function\s*\(|setTimeout\s*\(/,
    /document\.write|innerHTML\s*=/,
    
    // SQL injection
    /union\s+select|drop\s+table|delete\s+from/i,
    /'\s*or\s*'1'\s*=\s*'1|'\s*or\s*1\s*=\s*1/i,
    
    // System access
    /\/proc\/|\/sys\/|\/dev\//,
    /sudo\s+|su\s+|chmod\s+777/,
    /passwd\s+|useradd\s+|usermod\s+/
  ]

  private static readonly SENSITIVE_PATTERNS = [
    // API keys and tokens
    /sk-[A-Za-z0-9]{48}/,  // OpenAI
    /xoxb-[A-Za-z0-9-]+/,  // Slack
    /ghp_[A-Za-z0-9]{36}/, // GitHub
    /AKIA[A-Z0-9]{16}/,    // AWS
    /ya29\.[A-Za-z0-9_-]+/, // Google OAuth
    
    // Private keys
    /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
    /-----BEGIN\s+OPENSSH\s+PRIVATE\s+KEY-----/,
    
    // Database URLs
    /mongodb:\/\/.*:.*@/,
    /postgres:\/\/.*:.*@/,
    /mysql:\/\/.*:.*@/,
    
    // Generic secrets
    /password\s*[:=]\s*["']?[^"'\s]{8,}/i,
    /secret\s*[:=]\s*["']?[^"'\s]{16,}/i,
    /token\s*[:=]\s*["']?[^"'\s]{20,}/i
  ]

  private static readonly RESTRICTED_PATHS = [
    '/etc/',
    '/proc/',
    '/sys/',
    '/dev/',
    '/root/',
    '/boot/',
    '/var/log/',
    'C:\\Windows\\',
    'C:\\Program Files\\',
    'C:\\Users\\Administrator\\'
  ]

  private static readonly RESTRICTED_COMMANDS = [
    'rm -rf /',
    'dd if=',
    'mkfs',
    'fdisk',
    'format',
    'sudo rm',
    'chmod 777 /',
    'chown -R',
    'killall',
    'pkill -9'
  ]

  /**
   * Validate input for security threats
   */
  static validateInput(
    input: string,
    context: SecurityContext
  ): SecurityValidationResult {
    const warnings: string[] = []
    const blockedReasons: string[] = []
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'

    // Check for dangerous patterns
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(input)) {
        blockedReasons.push(`Dangerous pattern detected: ${pattern.source}`)
        riskLevel = 'critical'
      }
    }

    // Check for sensitive data exposure
    for (const pattern of this.SENSITIVE_PATTERNS) {
      if (pattern.test(input)) {
        warnings.push(`Potential sensitive data detected`)
        if (riskLevel === 'low') riskLevel = 'high'
      }
    }

    // Check for restricted paths
    for (const path of this.RESTRICTED_PATHS) {
      if (input.toLowerCase().includes(path.toLowerCase())) {
        blockedReasons.push(`Access to restricted path: ${path}`)
        if (riskLevel === 'low') riskLevel = 'high'
      }
    }

    // Check for restricted commands
    for (const command of this.RESTRICTED_COMMANDS) {
      if (input.toLowerCase().includes(command.toLowerCase())) {
        blockedReasons.push(`Restricted command detected: ${command}`)
        riskLevel = 'critical'
      }
    }

    // Additional context-specific checks
    if (context.operation === 'bash') {
      const bashRisks = this.validateBashCommand(input)
      warnings.push(...bashRisks.warnings)
      blockedReasons.push(...bashRisks.blockedReasons)
      if (bashRisks.riskLevel === 'critical') riskLevel = 'critical'
    }

    const allowed = blockedReasons.length === 0

    let error: KuuzukiError | undefined
    if (!allowed) {
      error = new ValidationError(
        `Security validation failed: ${blockedReasons.join(', ')}`,
        "SECURITY_VALIDATION_FAILED",
        `This operation was blocked for security reasons: ${blockedReasons.join(', ')}`,
        {
          sessionId: context.sessionId,
          userId: context.userId,
          metadata: {
            operation: context.operation,
            resource: context.resource,
            riskLevel,
            blockedReasons,
            warnings,
            agentName: context.agentName
          }
        }
      )
    }

    return {
      allowed,
      error,
      warnings,
      blockedReasons,
      riskLevel
    }
  }

  /**
   * Validate bash command for security
   */
  private static validateBashCommand(command: string): {
    warnings: string[]
    blockedReasons: string[]
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  } {
    const warnings: string[] = []
    const blockedReasons: string[] = []
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'

    // Check for command chaining with dangerous commands
    if (/;\s*rm\s+|&&\s*rm\s+|\|\s*rm\s+/.test(command)) {
      blockedReasons.push("Command chaining with rm detected")
      riskLevel = 'critical'
    }

    // Check for output redirection to sensitive files
    if (/>\s*\/etc\/|>\s*\/root\/|>\s*\/boot\//.test(command)) {
      blockedReasons.push("Output redirection to sensitive system directories")
      riskLevel = 'critical'
    }

    // Check for network operations
    if (/curl\s+.*\|\s*sh|wget\s+.*\|\s*sh/.test(command)) {
      blockedReasons.push("Network download and execution detected")
      riskLevel = 'critical'
    }

    // Check for privilege escalation
    if (/sudo\s+|su\s+-/.test(command)) {
      warnings.push("Privilege escalation command detected")
      if (riskLevel === 'low') riskLevel = 'medium'
    }

    // Check for process manipulation
    if (/kill\s+-9|killall|pkill/.test(command)) {
      warnings.push("Process termination command detected")
      if (riskLevel === 'low') riskLevel = 'medium'
    }

    return { warnings, blockedReasons, riskLevel }
  }

  /**
   * Validate file path for security
   */
  static validateFilePath(
    filePath: string,
    operation: 'read' | 'write' | 'execute',
    context: SecurityContext
  ): SecurityValidationResult {
    const warnings: string[] = []
    const blockedReasons: string[] = []
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'

    // Normalize path
    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase()

    // Check for path traversal
    if (normalizedPath.includes('../') || normalizedPath.includes('..\\')) {
      blockedReasons.push("Path traversal attempt detected")
      riskLevel = 'critical'
    }

    // Check for restricted paths
    for (const restrictedPath of this.RESTRICTED_PATHS) {
      if (normalizedPath.startsWith(restrictedPath.toLowerCase())) {
        if (operation === 'write' || operation === 'execute') {
          blockedReasons.push(`Write/execute access to restricted path: ${restrictedPath}`)
          riskLevel = 'critical'
        } else {
          warnings.push(`Read access to sensitive path: ${restrictedPath}`)
          if (riskLevel === 'low') riskLevel = 'medium'
        }
      }
    }

    // Check for sensitive file extensions
    const sensitiveExtensions = ['.key', '.pem', '.p12', '.pfx', '.crt', '.cer']
    const extension = filePath.toLowerCase().split('.').pop()
    if (extension && sensitiveExtensions.includes(`.${extension}`)) {
      warnings.push(`Access to potentially sensitive file type: .${extension}`)
      if (riskLevel === 'low') riskLevel = 'medium'
    }

    // Check for hidden files in sensitive locations
    if (normalizedPath.includes('/.') && (
      normalizedPath.includes('/home/') || 
      normalizedPath.includes('/users/')
    )) {
      warnings.push("Access to hidden file in user directory")
      if (riskLevel === 'low') riskLevel = 'medium'
    }

    const allowed = blockedReasons.length === 0

    let error: KuuzukiError | undefined
    if (!allowed) {
      error = new FilePermissionError(
        filePath,
        operation,
        {
          sessionId: context.sessionId,
          userId: context.userId,
          metadata: {
            operation: context.operation,
            resource: context.resource,
            riskLevel,
            blockedReasons,
            warnings,
            agentName: context.agentName
          }
        }
      )
    }

    return {
      allowed,
      error,
      warnings,
      blockedReasons,
      riskLevel
    }
  }

  /**
   * Sanitize output to remove sensitive information
   */
  static sanitizeOutput(output: string, context: SecurityContext): {
    sanitized: string
    redactions: number
    warnings: string[]
  } {
    let sanitized = output
    let redactions = 0
    const warnings: string[] = []

    // Redact sensitive patterns
    for (const pattern of this.SENSITIVE_PATTERNS) {
      const matches = sanitized.match(pattern)
      if (matches) {
        sanitized = sanitized.replace(pattern, '[REDACTED]')
        redactions += matches.length
        warnings.push(`Sensitive data redacted from output`)
      }
    }

    // Redact file paths that might contain usernames
    sanitized = sanitized.replace(/\/home\/[^\/\s]+/g, '/home/[USER]')
    sanitized = sanitized.replace(/\/Users\/[^\/\s]+/g, '/Users/[USER]')
    sanitized = sanitized.replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\[USER]')

    // Redact IP addresses (basic pattern)
    const ipPattern = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g
    const ipMatches = sanitized.match(ipPattern)
    if (ipMatches) {
      sanitized = sanitized.replace(ipPattern, '[IP_ADDRESS]')
      redactions += ipMatches.length
      warnings.push(`IP addresses redacted from output`)
    }

    // Log security events
    if (redactions > 0) {
      log.warn("Sensitive data redacted from output", {
        sessionId: context.sessionId,
        operation: context.operation,
        redactions,
        agentName: context.agentName
      })
    }

    return { sanitized, redactions, warnings }
  }

  /**
   * Check for permission bypass attempts
   */
  static detectPermissionBypass(
    input: string,
    context: SecurityContext
  ): SecurityValidationResult {
    const warnings: string[] = []
    const blockedReasons: string[] = []
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'

    // Check for common bypass techniques
    const bypassPatterns = [
      /chmod\s+\+x|chmod\s+777/,  // Permission modification
      /sudo\s+-u\s+|su\s+-\s+/,   // User switching
      /export\s+PATH=|PATH=/,      // PATH manipulation
      /alias\s+\w+=|function\s+\w+/, // Command aliasing
      /source\s+|\.\/|bash\s+-c/,  // Script execution
      /eval\s+|exec\s+/,           // Dynamic execution
    ]

    for (const pattern of bypassPatterns) {
      if (pattern.test(input)) {
        blockedReasons.push(`Permission bypass attempt detected: ${pattern.source}`)
        riskLevel = 'critical'
      }
    }

    // Check for encoding/obfuscation attempts
    if (/base64|hex|url|unicode/.test(input.toLowerCase()) && 
        /decode|unescape|fromcharcode/.test(input.toLowerCase())) {
      warnings.push("Potential encoding/obfuscation detected")
      if (riskLevel === 'low') riskLevel = 'medium'
    }

    const allowed = blockedReasons.length === 0

    let error: KuuzukiError | undefined
    if (!allowed) {
      error = new AuthError(
        `Permission bypass attempt detected`,
        "SECURITY_BYPASS_ATTEMPT",
        "This operation appears to be attempting to bypass security restrictions.",
        {
          sessionId: context.sessionId,
          userId: context.userId,
          metadata: {
            operation: context.operation,
            resource: context.resource,
            riskLevel,
            blockedReasons,
            warnings,
            agentName: context.agentName,
            input: input.substring(0, 100) // Log first 100 chars for analysis
          }
        }
      )
    }

    return {
      allowed,
      error,
      warnings,
      blockedReasons,
      riskLevel
    }
  }

  /**
   * Generate security report
   */
  static generateSecurityReport(
    validationResults: SecurityValidationResult[],
    context: SecurityContext
  ): {
    overallRisk: 'low' | 'medium' | 'high' | 'critical'
    totalWarnings: number
    totalBlocked: number
    recommendations: string[]
    summary: string
  } {
    const allWarnings = validationResults.flatMap(r => r.warnings)
    const allBlocked = validationResults.flatMap(r => r.blockedReasons)
    const riskLevels = validationResults.map(r => r.riskLevel)

    const overallRisk = riskLevels.includes('critical') ? 'critical' :
                       riskLevels.includes('high') ? 'high' :
                       riskLevels.includes('medium') ? 'medium' : 'low'

    const recommendations: string[] = []

    if (allBlocked.length > 0) {
      recommendations.push("Review and modify blocked operations to comply with security policies")
    }

    if (allWarnings.length > 0) {
      recommendations.push("Consider additional security measures for flagged operations")
    }

    if (overallRisk === 'critical' || overallRisk === 'high') {
      recommendations.push("Implement additional monitoring and logging for this session")
      recommendations.push("Consider restricting agent permissions")
    }

    const summary = `Security validation completed: ${allBlocked.length} operations blocked, ${allWarnings.length} warnings issued. Overall risk level: ${overallRisk}.`

    return {
      overallRisk,
      totalWarnings: allWarnings.length,
      totalBlocked: allBlocked.length,
      recommendations,
      summary
    }
  }
}