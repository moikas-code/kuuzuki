import { customAlphabet } from "nanoid"
import type { KVNamespace } from "../types/kv"

const generateKeyPart = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 32)

export interface ApiKey {
  // Identity
  key: string // kz_live_abc123...
  email: string // user@example.com

  // Stripe Integration
  customerId: string // cus_stripe123
  subscriptionId: string // sub_stripe123

  // Status & Permissions
  status: "active" | "canceled" | "past_due" | "incomplete"
  scopes: string[] // ['sharing'] - for future expansion

  // Lifecycle
  createdAt: number // Unix timestamp
  expiresAt?: number // Unix timestamp (optional)
  lastUsed?: number // Unix timestamp

  // Metadata
  metadata?: {
    userAgent?: string // Last used user agent
    ipAddress?: string // Last used IP (hashed)
    version?: string // Kuuzuki version when created
    [key: string]: any // Extensible
  }
}

export interface ApiKeyUsage {
  keyId: string // API key identifier
  action: string // 'verify', 'share', 'api_call'
  timestamp: number // Unix timestamp
  success: boolean // Operation success
  ip?: string // Hashed IP address
  userAgent?: string // User agent string
  metadata?: Record<string, any> // Additional context
}

export function createApiKey(environment: "live" | "test" = "live"): string {
  // 1. Validate environment
  if (!["live", "test"].includes(environment)) {
    throw new Error('Invalid environment. Must be "live" or "test"')
  }

  // 2. Generate cryptographically secure random string
  const randomPart = generateKeyPart()

  // 3. Construct key
  const prefix = "kz"
  const key = `${prefix}_${environment}_${randomPart}`

  // 4. Validate format before returning
  if (!validateApiKeyFormat(key)) {
    throw new Error("Generated key failed validation")
  }

  return key
}

export function validateApiKeyFormat(key: string): boolean {
  // Regex: kz_(live|test)_[a-z0-9]{32}
  const pattern = /^kz_(live|test)_[a-z0-9]{32}$/
  return pattern.test(key)
}

export function getKeyEnvironment(key: string): "live" | "test" | null {
  if (!validateApiKeyFormat(key)) return null

  if (key.startsWith("kz_live_")) return "live"
  if (key.startsWith("kz_test_")) return "test"
  return null
}

export function maskApiKey(key: string): string {
  // Show: kz_live_abcd****wxyz
  if (!validateApiKeyFormat(key)) return key

  const parts = key.split("_")
  const prefix = `${parts[0]}_${parts[1]}_`
  const random = parts[2]
  const masked = random.slice(0, 4) + "****" + random.slice(-4)

  return prefix + masked
}

export async function storeApiKey(kv: KVNamespace, apiKey: ApiKey): Promise<void> {
  const ttl = 60 * 60 * 24 * 365 // 1 year TTL

  // 1. Store primary record
  await kv.put(`apikey:${apiKey.key}`, JSON.stringify(apiKey), {
    expirationTtl: ttl,
  })

  // 2. Store email lookup
  await kv.put(`apikey:email:${apiKey.email}`, apiKey.key, {
    expirationTtl: ttl,
  })

  // 3. Store customer lookup
  await kv.put(`apikey:customer:${apiKey.customerId}`, apiKey.key, {
    expirationTtl: ttl,
  })

  // 4. Store subscription lookup
  await kv.put(`apikey:subscription:${apiKey.subscriptionId}`, apiKey.key, {
    expirationTtl: ttl,
  })
}

export async function getApiKey(kv: KVNamespace, key: string): Promise<ApiKey | null> {
  const data = await kv.get(`apikey:${key}`)
  return data ? JSON.parse(data) : null
}

export async function getApiKeyByEmail(kv: KVNamespace, email: string): Promise<ApiKey | null> {
  const key = await kv.get(`apikey:email:${email}`)
  return key ? getApiKey(kv, key) : null
}

export async function getApiKeyByCustomerId(kv: KVNamespace, customerId: string): Promise<ApiKey | null> {
  const key = await kv.get(`apikey:customer:${customerId}`)
  return key ? getApiKey(kv, key) : null
}

export async function getApiKeyBySubscriptionId(kv: KVNamespace, subscriptionId: string): Promise<ApiKey | null> {
  const key = await kv.get(`apikey:subscription:${subscriptionId}`)
  return key ? getApiKey(kv, key) : null
}

export async function updateApiKeyStatus(kv: KVNamespace, key: string, status: ApiKey["status"]): Promise<void> {
  const apiKey = await getApiKey(kv, key)
  if (!apiKey) throw new Error("API key not found")

  apiKey.status = status

  // Set expiration for canceled keys
  if (status === "canceled") {
    apiKey.expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days grace
  }

  await storeApiKey(kv, apiKey)
}

export async function updateApiKeyUsage(kv: KVNamespace, key: string, metadata?: Record<string, any>): Promise<void> {
  const apiKey = await getApiKey(kv, key)
  if (!apiKey) return

  apiKey.lastUsed = Date.now()
  if (metadata) {
    apiKey.metadata = { ...apiKey.metadata, ...metadata }
  }

  await storeApiKey(kv, apiKey)
}

export async function logApiKeyUsage(kv: KVNamespace, usage: ApiKeyUsage): Promise<void> {
  const usageKey = `usage:${usage.keyId}:${usage.timestamp}`
  await kv.put(usageKey, JSON.stringify(usage), {
    expirationTtl: 60 * 60 * 24 * 30, // 30 days
  })
}

export function isApiKeyValid(apiKey: ApiKey): boolean {
  if (apiKey.status !== "active") return false
  if (apiKey.expiresAt && apiKey.expiresAt < Date.now()) return false
  return true
}
