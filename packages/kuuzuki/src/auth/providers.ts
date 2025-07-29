import { z } from "zod"
import { Log } from "../util/log"

export namespace Providers {
  const log = Log.create({ service: "auth-providers" })

  export const ProviderType = z.enum(["anthropic", "openai", "openrouter", "github-copilot", "amazon-bedrock"])
  export type ProviderType = z.infer<typeof ProviderType>

  export interface ProviderConfig {
    id: ProviderType
    name: string
    keyFormat: RegExp
    keyPrefix?: string
    healthCheckUrl?: string
    healthCheckHeaders?: Record<string, string>
    environmentVariables: string[]
    validateKey: (key: string) => boolean
    maskKey: (key: string) => string
  }

  export const PROVIDER_CONFIGS: Record<ProviderType, ProviderConfig> = {
    anthropic: {
      id: "anthropic",
      name: "Anthropic Claude",
      keyFormat: /^sk-ant-api03-[a-zA-Z0-9_-]{95}$/,
      keyPrefix: "sk-ant-api03-",
      healthCheckUrl: "https://api.anthropic.com/v1/messages",
      healthCheckHeaders: {
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      environmentVariables: ["ANTHROPIC_API_KEY", "CLAUDE_API_KEY"],
      validateKey: (key: string) => /^sk-ant-api03-[a-zA-Z0-9_-]{95}$/.test(key),
      maskKey: (key: string) => {
        if (key.length < 20) return key
        return key.slice(0, 12) + "****" + key.slice(-8)
      },
    },
    openai: {
      id: "openai",
      name: "OpenAI",
      keyFormat: /^sk-[a-zA-Z0-9]{48,}$/,
      keyPrefix: "sk-",
      healthCheckUrl: "https://api.openai.com/v1/models",
      environmentVariables: ["OPENAI_API_KEY"],
      validateKey: (key: string) => /^sk-[a-zA-Z0-9]{48,}$/.test(key),
      maskKey: (key: string) => {
        if (key.length < 12) return key
        return key.slice(0, 7) + "****" + key.slice(-8)
      },
    },
    openrouter: {
      id: "openrouter",
      name: "OpenRouter",
      keyFormat: /^sk-or-v1-[a-f0-9]{64}$/,
      keyPrefix: "sk-or-v1-",
      healthCheckUrl: "https://openrouter.ai/api/v1/models",
      environmentVariables: ["OPENROUTER_API_KEY"],
      validateKey: (key: string) => /^sk-or-v1-[a-f0-9]{64}$/.test(key),
      maskKey: (key: string) => {
        if (key.length < 16) return key
        return key.slice(0, 12) + "****" + key.slice(-8)
      },
    },
    "github-copilot": {
      id: "github-copilot",
      name: "GitHub Copilot",
      keyFormat: /^ghu_[a-zA-Z0-9]{36}$|^ghp_[a-zA-Z0-9]{36}$/,
      keyPrefix: "ghu_",
      environmentVariables: ["GITHUB_TOKEN", "COPILOT_API_KEY"],
      validateKey: (key: string) => /^ghu_[a-zA-Z0-9]{36}$|^ghp_[a-zA-Z0-9]{36}$/.test(key),
      maskKey: (key: string) => {
        if (key.length < 12) return key
        return key.slice(0, 8) + "****" + key.slice(-6)
      },
    },
    "amazon-bedrock": {
      id: "amazon-bedrock",
      name: "Amazon Bedrock",
      keyFormat: /^AKIA[0-9A-Z]{16}$/,
      keyPrefix: "AKIA",
      environmentVariables: ["AWS_ACCESS_KEY_ID", "AWS_BEARER_TOKEN_BEDROCK"],
      validateKey: (key: string) => /^AKIA[0-9A-Z]{16}$/.test(key),
      maskKey: (key: string) => {
        if (key.length < 12) return key
        return key.slice(0, 8) + "****" + key.slice(-4)
      },
    },
  }

  export function getProvider(providerId: string): ProviderConfig | null {
    return PROVIDER_CONFIGS[providerId as ProviderType] || null
  }

  export function validateProviderKey(providerId: string, key: string): boolean {
    const provider = getProvider(providerId)
    if (!provider) return false
    return provider.validateKey(key)
  }

  export function maskProviderKey(providerId: string, key: string): string {
    const provider = getProvider(providerId)
    if (!provider) return key
    return provider.maskKey(key)
  }

  export async function healthCheck(
    providerId: string,
    apiKey: string,
  ): Promise<{
    success: boolean
    error?: string
    responseTime?: number
  }> {
    const provider = getProvider(providerId)
    if (!provider || !provider.healthCheckUrl) {
      return { success: false, error: "Health check not supported for this provider" }
    }

    const startTime = Date.now()

    try {
      log.info("health check", { providerId })

      const headers: Record<string, string> = {
        ["Authorization"]: `Bearer ${apiKey}`,
        ...provider.healthCheckHeaders,
      }

      // Special handling for different providers
      if (providerId === "anthropic") {
        headers["x-api-key"] = apiKey
        delete headers["Authorization"]
      }

      const response = await fetch(provider.healthCheckUrl, {
        method: providerId === "anthropic" ? "POST" : "GET",
        headers,
        body:
          providerId === "anthropic"
            ? JSON.stringify({
                model: "claude-3-haiku-20240307",
                max_tokens: 1,
                messages: [{ role: "user", content: "test" }],
              })
            : undefined,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      const responseTime = Date.now() - startTime

      if (response.ok || (providerId === "anthropic" && response.status === 400)) {
        // For Anthropic, a 400 with proper error structure means the key is valid
        log.info("health check success", { providerId, responseTime })
        return { success: true, responseTime }
      }

      const errorText = await response.text().catch(() => "Unknown error")
      log.warn("health check failed", { providerId, status: response.status, error: errorText })

      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        responseTime,
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : "Unknown error"

      log.error("health check error", { providerId, error: errorMessage })

      return {
        success: false,
        error: errorMessage,
        responseTime,
      }
    }
  }

  export function detectProvider(apiKey: string): ProviderType | null {
    for (const [providerId, config] of Object.entries(PROVIDER_CONFIGS)) {
      if (config.validateKey(apiKey)) {
        return providerId as ProviderType
      }
    }
    return null
  }

  export function getEnvironmentKey(providerId: string): string | null {
    const provider = getProvider(providerId)
    if (!provider) return null

    for (const envVar of provider.environmentVariables) {
      const value = process.env[envVar]
      if (value && provider.validateKey(value)) {
        return value
      }
    }
    return null
  }

  export function listSupportedProviders(): ProviderConfig[] {
    return Object.values(PROVIDER_CONFIGS)
  }
}
