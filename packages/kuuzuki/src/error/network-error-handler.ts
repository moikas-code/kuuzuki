import { Log } from "../util/log"
import { ErrorHandler } from "./handler"
import { 
  KuuzukiError, 
  NetworkError,
  ConnectionTimeoutError,
  RateLimitError,
  InvalidApiKeyError,
  ProviderUnavailableError
} from "./types"
import { ErrorRecoveryManager } from "./recovery"

const log = Log.create({ service: "network-error-handler" })

export interface NetworkRequestContext {
  url: string
  method: string
  timeout: number
  retries: number
  provider?: string
  sessionId?: string
  requestId?: string
}

export interface NetworkRequestResult<T = any> {
  success: boolean
  data?: T
  error?: KuuzukiError
  statusCode?: number
  headers?: Record<string, string>
  attempts: number
  totalTime: number
  fromCache?: boolean
}

export interface ConnectivityStatus {
  online: boolean
  latency?: number
  dnsWorking: boolean
  httpWorking: boolean
  httpsWorking: boolean
  lastChecked: number
}

export class NetworkErrorHandler {
  private static connectivityCache: ConnectivityStatus | null = null
  private static readonly CONNECTIVITY_CACHE_TTL = 30000 // 30 seconds
  
  private static readonly PROVIDER_ENDPOINTS = {
    anthropic: 'https://api.anthropic.com/v1/messages',
    openai: 'https://api.openai.com/v1/chat/completions',
    github: 'https://api.github.com',
    npm: 'https://registry.npmjs.org'
  }

  private static readonly RETRY_STATUS_CODES = [408, 429, 500, 502, 503, 504]
  private static readonly AUTH_STATUS_CODES = [401, 403]

  /**
   * Execute network request with comprehensive error handling
   */
  static async executeRequest<T>(
    requestFn: () => Promise<Response>,
    context: NetworkRequestContext
  ): Promise<NetworkRequestResult<T>> {
    const startTime = Date.now()

    // Check connectivity first
    const connectivity = await this.checkConnectivity()
    if (!connectivity.online) {
      return {
        success: false,
        error: new NetworkError(
          "No internet connectivity",
          "NETWORK_OFFLINE",
          "No internet connection detected. Please check your network and try again.",
          { 
            sessionId: context.sessionId,
            requestId: context.requestId,
            metadata: { connectivity }
          }
        ),
        attempts: 0,
        totalTime: Date.now() - startTime
      }
    }

    // Execute with recovery
    const result = await ErrorRecoveryManager.executeWithRecovery(
      async () => {
        const response = await this.executeWithTimeout(requestFn, context.timeout)
        return await this.processResponse<T>(response, context)
      },
      {
        operation: "network_request",
        sessionId: context.sessionId,
        maxAttempts: context.retries + 1
      },
      {
        retryable: true,
        retryDelay: 1000,
        maxRetries: context.retries
      }
    )

    const endTime = Date.now()

    if (result.success && result.result) {
      return {
        success: true,
        data: result.result.data,
        statusCode: result.result.statusCode,
        headers: result.result.headers,
        attempts: result.attempts,
        totalTime: endTime - startTime
      }
    } else {
      return {
        success: false,
        error: result.error,
        attempts: result.attempts,
        totalTime: endTime - startTime
      }
    }
  }

  /**
   * Execute request with timeout handling
   */
  private static async executeWithTimeout(
    requestFn: () => Promise<Response>,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await requestFn()
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ConnectionTimeoutError({
          metadata: { timeout, timeoutType: 'request' }
        })
      }
      
      throw error
    }
  }

  /**
   * Process HTTP response and handle errors
   */
  private static async processResponse<T>(
    response: Response,
    context: NetworkRequestContext
  ): Promise<{ data: T; statusCode: number; headers: Record<string, string> }> {
    const statusCode = response.status
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })

    // Handle authentication errors
    if (this.AUTH_STATUS_CODES.includes(statusCode)) {
      const errorText = await response.text().catch(() => 'Authentication failed')
      throw new InvalidApiKeyError(context.provider, {
        sessionId: context.sessionId,
        requestId: context.requestId,
        metadata: {
          statusCode,
          url: context.url,
          method: context.method,
          responseText: errorText
        }
      })
    }

    // Handle rate limiting
    if (statusCode === 429) {
      const retryAfter = this.parseRetryAfter(headers['retry-after'])
      throw new RateLimitError(retryAfter, {
        sessionId: context.sessionId,
        requestId: context.requestId,
        metadata: {
          statusCode,
          url: context.url,
          method: context.method,
          retryAfter
        }
      })
    }

    // Handle server errors
    if (statusCode >= 500) {
      const errorText = await response.text().catch(() => 'Server error')
      throw new ProviderUnavailableError(context.provider || 'unknown', {
        sessionId: context.sessionId,
        requestId: context.requestId,
        metadata: {
          statusCode,
          url: context.url,
          method: context.method,
          responseText: errorText
        }
      })
    }

    // Handle client errors
    if (statusCode >= 400) {
      const errorText = await response.text().catch(() => 'Client error')
      throw new NetworkError(
        `HTTP ${statusCode}: ${errorText}`,
        "NETWORK_HTTP_ERROR",
        `Request failed with status ${statusCode}. ${this.getStatusCodeHelp(statusCode)}`,
        {
          sessionId: context.sessionId,
          requestId: context.requestId,
          metadata: {
            statusCode,
            url: context.url,
            method: context.method,
            responseText: errorText
          }
        }
      )
    }

    // Parse successful response
    try {
      const data = await response.json() as T
      return { data, statusCode, headers }
    } catch (parseError) {
      throw new NetworkError(
        "Failed to parse response JSON",
        "NETWORK_PARSE_ERROR",
        "The server response could not be parsed. The service may be experiencing issues.",
        {
          sessionId: context.sessionId,
          requestId: context.requestId,
          metadata: {
            statusCode,
            url: context.url,
            parseError: parseError instanceof Error ? parseError.message : String(parseError)
          }
        }
      )
    }
  }

  /**
   * Check internet connectivity
   */
  static async checkConnectivity(): Promise<ConnectivityStatus> {
    const now = Date.now()
    
    // Return cached result if still valid
    if (this.connectivityCache && 
        (now - this.connectivityCache.lastChecked) < this.CONNECTIVITY_CACHE_TTL) {
      return this.connectivityCache
    }

    const status: ConnectivityStatus = {
      online: false,
      dnsWorking: false,
      httpWorking: false,
      httpsWorking: false,
      lastChecked: now
    }

    try {
      // Test DNS resolution
      const dnsStart = Date.now()
      await fetch('https://1.1.1.1', { 
        method: 'HEAD',
        signal: AbortSignal.timeout(3000)
      })
      status.dnsWorking = true
      status.latency = Date.now() - dnsStart

      // Test HTTP connectivity
      await fetch('http://httpbin.org/status/200', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      })
      status.httpWorking = true

      // Test HTTPS connectivity
      await fetch('https://httpbin.org/status/200', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      })
      status.httpsWorking = true

      status.online = status.dnsWorking && status.httpsWorking

    } catch (error) {
      log.warn("Connectivity check failed", {
        error: error instanceof Error ? error.message : String(error)
      })
    }

    this.connectivityCache = status
    return status
  }

  /**
   * Test specific provider connectivity
   */
  static async testProviderConnectivity(provider: string): Promise<{
    available: boolean
    latency?: number
    error?: string
  }> {
    const endpoint = this.PROVIDER_ENDPOINTS[provider as keyof typeof this.PROVIDER_ENDPOINTS]
    if (!endpoint) {
      return { available: false, error: `Unknown provider: ${provider}` }
    }

    try {
      const start = Date.now()
      const response = await fetch(endpoint, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000)
      })
      
      const latency = Date.now() - start
      const available = response.status < 500 // Accept 4xx as "available but auth required"
      
      return { available, latency }
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Handle network-specific errors
   */
  static handleNetworkError(
    error: unknown,
    context: NetworkRequestContext
  ): KuuzukiError {
    const errorContext = {
      sessionId: context.sessionId,
      requestId: context.requestId,
      metadata: {
        url: context.url,
        method: context.method,
        timeout: context.timeout,
        provider: context.provider
      }
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      // Connection errors
      if (message.includes('econnrefused') || message.includes('connection refused')) {
        return new NetworkError(
          "Connection refused",
          "NETWORK_CONNECTION_REFUSED",
          "The server refused the connection. The service may be down or unreachable.",
          errorContext
        )
      }

      if (message.includes('enotfound') || message.includes('not found')) {
        return new NetworkError(
          "DNS resolution failed",
          "NETWORK_DNS_FAILED",
          "Could not resolve the server address. Check your internet connection and DNS settings.",
          errorContext
        )
      }

      if (message.includes('etimedout') || message.includes('timeout')) {
        return new ConnectionTimeoutError(errorContext)
      }

      if (message.includes('econnreset') || message.includes('connection reset')) {
        return new NetworkError(
          "Connection reset",
          "NETWORK_CONNECTION_RESET",
          "The connection was reset by the server. This may be a temporary issue.",
          errorContext,
          true // recoverable
        )
      }

      // SSL/TLS errors
      if (message.includes('cert') || message.includes('ssl') || message.includes('tls')) {
        return new NetworkError(
          "SSL/TLS error",
          "NETWORK_SSL_ERROR",
          "SSL/TLS certificate verification failed. This may indicate a security issue.",
          errorContext
        )
      }

      // Proxy errors
      if (message.includes('proxy')) {
        return new NetworkError(
          "Proxy error",
          "NETWORK_PROXY_ERROR",
          "Proxy connection failed. Check your proxy settings.",
          errorContext
        )
      }
    }

    return ErrorHandler.handle(error, errorContext)
  }

  /**
   * Get network diagnostics
   */
  static async getDiagnostics(): Promise<{
    connectivity: ConnectivityStatus
    providers: Record<string, any>
    recommendations: string[]
  }> {
    const connectivity = await this.checkConnectivity()
    const providers: Record<string, any> = {}
    const recommendations: string[] = []

    // Test all known providers
    for (const provider of Object.keys(this.PROVIDER_ENDPOINTS)) {
      providers[provider] = await this.testProviderConnectivity(provider)
    }

    // Generate recommendations
    if (!connectivity.online) {
      recommendations.push("Check your internet connection")
      recommendations.push("Verify network settings and firewall configuration")
    }

    if (!connectivity.dnsWorking) {
      recommendations.push("DNS resolution is failing - check DNS settings")
      recommendations.push("Try using alternative DNS servers (8.8.8.8, 1.1.1.1)")
    }

    if (connectivity.latency && connectivity.latency > 5000) {
      recommendations.push("High network latency detected - consider using a faster connection")
    }

    const unavailableProviders = Object.entries(providers)
      .filter(([, status]) => !status.available)
      .map(([name]) => name)

    if (unavailableProviders.length > 0) {
      recommendations.push(`Some providers are unavailable: ${unavailableProviders.join(', ')}`)
    }

    return { connectivity, providers, recommendations }
  }

  /**
   * Helper methods
   */
  private static parseRetryAfter(retryAfter?: string): number {
    if (!retryAfter) return 60

    const parsed = parseInt(retryAfter, 10)
    return isNaN(parsed) ? 60 : Math.min(parsed, 300) // Cap at 5 minutes
  }

  private static getStatusCodeHelp(statusCode: number): string {
    switch (statusCode) {
      case 400:
        return "The request was malformed. Check your input parameters."
      case 401:
        return "Authentication failed. Check your API key."
      case 403:
        return "Access forbidden. You may not have permission for this operation."
      case 404:
        return "The requested resource was not found."
      case 429:
        return "Rate limit exceeded. Please wait before making more requests."
      case 500:
        return "Internal server error. The service is experiencing issues."
      case 502:
        return "Bad gateway. The service may be temporarily unavailable."
      case 503:
        return "Service unavailable. Please try again later."
      case 504:
        return "Gateway timeout. The request took too long to process."
      default:
        return "An HTTP error occurred."
    }
  }

  /**
   * Clear connectivity cache (for testing or manual refresh)
   */
  static clearConnectivityCache(): void {
    this.connectivityCache = null
  }
}