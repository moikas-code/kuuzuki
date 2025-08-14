import { safeJsonParse } from "../util/json-utils";
import { z } from "zod"
import { Log } from "../util/log"
import { Providers } from "./providers"
import { NamedError } from "../util/error"
import { homedir } from "os"
import { join } from "path"
import { promises as fs } from "fs"

export namespace ApiKeyManager {
  const log = Log.create({ service: "apikey-manager" })

  export interface StoredApiKey {
    providerId: string
    key: string
    createdAt: number
    lastUsed?: number
    lastHealthCheck?: number
    healthCheckStatus?: "success" | "failed"
    source: "environment" | "config" | "keychain" | "manual"
  }

  export interface KeychainAdapter {
    store(service: string, account: string, password: string): Promise<void>
    retrieve(service: string, account: string): Promise<string | null>
    remove(service: string, account: string): Promise<void>
    list(): Promise<Array<{ service: string; account: string }>>
  }

  const STORAGE_FILE = join(homedir(), ".kuuzuki", "apikeys.json")
  const KEYCHAIN_SERVICE = "kuuzuki-api-keys"

  let keychainAdapter: KeychainAdapter | null = null

  // Initialize keychain adapter if available
  async function initKeychain(): Promise<KeychainAdapter | null> {
    if (keychainAdapter !== null) return keychainAdapter

    try {
      // Try to load system keychain
      if (process.platform === "darwin") {
        // macOS Keychain
        const keychain = await import("./keychain").catch(() => null)
        if (keychain) {
          keychainAdapter = {
            async store(service: string, account: string, password: string) {
              await keychain.default.setPassword(service, account, password)
            },
            async retrieve(service: string, account: string) {
              return await keychain.default.getPassword(service, account)
            },
            async remove(service: string, account: string) {
              await keychain.default.deletePassword(service, account)
            },
            async list() {
              const credentials = await keychain.default.findCredentials(KEYCHAIN_SERVICE)
              return credentials.map((cred) => ({ service: KEYCHAIN_SERVICE, account: cred.account }))
            },
          }
          log.info("keychain adapter initialized", { platform: "darwin" })
          return keychainAdapter
        }
      } else if (process.platform === "linux") {
        // Linux Secret Service
        const keychain = await import("./keychain").catch(() => null)
        if (keychain) {
          keychainAdapter = {
            async store(service: string, account: string, password: string) {
              await keychain.default.setPassword(service, account, password)
            },
            async retrieve(service: string, account: string) {
              return await keychain.default.getPassword(service, account)
            },
            async remove(service: string, account: string) {
              await keychain.default.deletePassword(service, account)
            },
            async list() {
              const credentials = await keychain.default.findCredentials(KEYCHAIN_SERVICE)
              return credentials.map((cred) => ({ service: KEYCHAIN_SERVICE, account: cred.account }))
            },
          }
          log.info("keychain adapter initialized", { platform: "linux" })
          return keychainAdapter
        }
      } else if (process.platform === "win32") {
        // Windows Credential Manager
        const keychain = await import("./keychain").catch(() => null)
        if (keychain) {
          keychainAdapter = {
            async store(service: string, account: string, password: string) {
              await keychain.default.setPassword(service, account, password)
            },
            async retrieve(service: string, account: string) {
              return await keychain.default.getPassword(service, account)
            },
            async remove(service: string, account: string) {
              await keychain.default.deletePassword(service, account)
            },
            async list() {
              const credentials = await keychain.default.findCredentials(KEYCHAIN_SERVICE)
              return credentials.map((cred) => ({ service: KEYCHAIN_SERVICE, account: cred.account }))
            },
          }
          log.info("keychain adapter initialized", { platform: "win32" })
          return keychainAdapter
        }
      }
    } catch (error) {
      log.warn("failed to initialize keychain", { error: error instanceof Error ? error.message : error })
    }

    keychainAdapter = null
    log.info("keychain not available, using file storage")
    return null
  }

  async function ensureStorageDir(): Promise<void> {
    const dir = join(homedir(), ".kuuzuki")
    await fs.mkdir(dir, { recursive: true })
  }

  async function loadStoredKeys(): Promise<Record<string, StoredApiKey>> {
    try {
      const content = await fs.readFile(STORAGE_FILE, "utf-8")
      return safeJsonParse(content, "API key storage")
    } catch {
      return {}
    }
  }

  async function saveStoredKeys(keys: Record<string, StoredApiKey>): Promise<void> {
    await ensureStorageDir()
    await fs.writeFile(STORAGE_FILE, JSON.stringify(keys, null, 2))
  }

  export class ApiKeyManager {
    private keys: Map<string, StoredApiKey> = new Map()
    private keychain: KeychainAdapter | null = null
    private initPromise: Promise<void>

    constructor() {
      this.initPromise = this.init()
    }

    private async init(): Promise<void> {
      this.keychain = await initKeychain()
      await this.loadKeys()
    }

    // Ensure initialization is complete before any operations
    public async ensureInitialized(): Promise<void> {
      await this.initPromise
    }

    private async loadKeys(): Promise<void> {
      // Load from file storage
      const storedKeys = await loadStoredKeys()
      for (const [providerId, key] of Object.entries(storedKeys)) {
        this.keys.set(providerId, key)
      }

      // Load from keychain if available
      if (this.keychain) {
        try {
          const credentials = await this.keychain.list()
          for (const { account } of credentials) {
            if (account.startsWith("kuuzuki-")) {
              const providerId = account.replace("kuuzuki-", "")
              const key = await this.keychain.retrieve(KEYCHAIN_SERVICE, account)
              if (key && Providers.validateProviderKey(providerId, key)) {
                this.keys.set(providerId, {
                  providerId,
                  key,
                  createdAt: Date.now(),
                  source: "keychain",
                })
              }
            }
          }
        } catch (error) {
          log.warn("failed to load keys from keychain", { error: error instanceof Error ? error.message : error })
        }
      }

      // Load from environment variables
      for (const provider of Providers.listSupportedProviders()) {
        const envKey = Providers.getEnvironmentKey(provider.id)
        if (envKey && !this.keys.has(provider.id)) {
          this.keys.set(provider.id, {
            providerId: provider.id,
            key: envKey,
            createdAt: Date.now(),
            source: "environment",
          })
        }
      }

      log.info("loaded api keys", { count: this.keys.size })
    }

    async storeKey(providerId: string, apiKey: string, useKeychain = true): Promise<void> {
      await this.ensureInitialized()
      if (!Providers.validateProviderKey(providerId, apiKey)) {
        throw new InvalidApiKeyError({ providerId })
      }

      const storedKey: StoredApiKey = {
        providerId,
        key: apiKey,
        createdAt: Date.now(),
        source: useKeychain && this.keychain ? "keychain" : "manual",
      }

      // Store in keychain if available and requested
      if (useKeychain && this.keychain) {
        try {
          await this.keychain.store(KEYCHAIN_SERVICE, `kuuzuki-${providerId}`, apiKey)
          storedKey.source = "keychain"
          log.info("stored key in keychain", { providerId })
        } catch (error) {
          log.warn("failed to store key in keychain, falling back to file", {
            providerId,
            error: error instanceof Error ? error.message : error,
          })
          storedKey.source = "manual"
        }
      }

      // Always store in memory
      this.keys.set(providerId, storedKey)

      // Store in file if not using keychain
      if (storedKey.source !== "keychain") {
        const storedKeys = await loadStoredKeys()
        storedKeys[providerId] = storedKey
        await saveStoredKeys(storedKeys)
        log.info("stored key in file", { providerId })
      }
    }

    async getKey(providerId: string): Promise<string | null> {
      await this.ensureInitialized()
      const stored = this.keys.get(providerId)
      if (!stored) return null

      // Update last used timestamp
      stored.lastUsed = Date.now()
      if (stored.source !== "environment" && stored.source !== "keychain") {
        const storedKeys = await loadStoredKeys()
        storedKeys[providerId] = stored
        await saveStoredKeys(storedKeys)
      }

      return stored.key
    }

    async removeKey(providerId: string): Promise<void> {
      await this.ensureInitialized()
      const stored = this.keys.get(providerId)
      if (!stored) return

      // Remove from keychain if stored there
      if (stored.source === "keychain" && this.keychain) {
        try {
          await this.keychain.remove(KEYCHAIN_SERVICE, `kuuzuki-${providerId}`)
          log.info("removed key from keychain", { providerId })
        } catch (error) {
          log.warn("failed to remove key from keychain", {
            providerId,
            error: error instanceof Error ? error.message : error,
          })
        }
      }

      // Remove from file storage
      if (stored.source !== "environment") {
        const storedKeys = await loadStoredKeys()
        delete storedKeys[providerId]
        await saveStoredKeys(storedKeys)
        log.info("removed key from file", { providerId })
      }

      // Remove from memory
      this.keys.delete(providerId)
    }

    async listKeys(): Promise<
      Array<{
        providerId: string
        maskedKey: string
        source: string
        createdAt: number
        lastUsed?: number
        healthStatus?: "success" | "failed"
        lastHealthCheck?: number
      }>
    > {
      await this.ensureInitialized()
      const result = []
      for (const [providerId, stored] of this.keys.entries()) {
        result.push({
          providerId,
          maskedKey: Providers.maskProviderKey(providerId, stored.key),
          source: stored.source,
          createdAt: stored.createdAt,
          lastUsed: stored.lastUsed,
          healthStatus: stored.healthCheckStatus,
          lastHealthCheck: stored.lastHealthCheck,
        })
      }
      return result.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0))
    }

    async validateKey(providerId: string, apiKey?: string): Promise<boolean> {
      await this.ensureInitialized()
      const key = apiKey || (await this.getKey(providerId))
      if (!key) return false
      return Providers.validateProviderKey(providerId, key)
    }

    async healthCheck(providerId: string): Promise<{
      success: boolean
      error?: string
      responseTime?: number
    }> {
      await this.ensureInitialized()
      const key = await this.getKey(providerId)
      if (!key) {
        return { success: false, error: "No API key found" }
      }

      const result = await Providers.healthCheck(providerId, key)

      // Update health check status
      const stored = this.keys.get(providerId)
      if (stored) {
        stored.lastHealthCheck = Date.now()
        stored.healthCheckStatus = result.success ? "success" : "failed"

        if (stored.source !== "environment" && stored.source !== "keychain") {
          const storedKeys = await loadStoredKeys()
          storedKeys[providerId] = stored
          await saveStoredKeys(storedKeys)
        }
      }

      return result
    }

    async healthCheckAll(): Promise<
      Record<
        string,
        {
          success: boolean
          error?: string
          responseTime?: number
        }
      >
    > {
      await this.ensureInitialized()
      const results: Record<string, any> = {}
      const promises = Array.from(this.keys.keys()).map(async (providerId) => {
        results[providerId] = await this.healthCheck(providerId)
      })

      await Promise.allSettled(promises)
      return results
    }

    hasKey(providerId: string): boolean {
      // Note: This is a synchronous method, but we can't await here
      // The caller should ensure initialization is complete
      return this.keys.has(providerId)
    }

    getAvailableProviders(): string[] {
      // Note: This is a synchronous method, but we can't await here
      // The caller should ensure initialization is complete
      return Array.from(this.keys.keys())
    }

    async detectAndStoreKey(apiKey: string, useKeychain = true): Promise<string | null> {
      await this.ensureInitialized()
      const providerId = Providers.detectProvider(apiKey)
      if (!providerId) return null

      await this.storeKey(providerId, apiKey, useKeychain)
      return providerId
    }
  }

  export const InvalidApiKeyError = NamedError.create(
    "InvalidApiKeyError",
    z.object({
      providerId: z.string(),
    }),
  )

  export const KeyNotFoundError = NamedError.create(
    "KeyNotFoundError",
    z.object({
      providerId: z.string(),
    }),
  )

  // Singleton instance
  let instance: ApiKeyManager | null = null
  let instancePromise: Promise<ApiKeyManager> | null = null

  export async function getInstance(): Promise<ApiKeyManager> {
    if (instance) {
      return instance
    }
    
    if (!instancePromise) {
      instancePromise = (async () => {
        const manager = new ApiKeyManager()
        await manager.ensureInitialized()
        instance = manager
        return manager
      })()
    }
    
    return instancePromise
  }

  // Legacy sync method for backward compatibility - will be removed
  export function getInstanceSync(): ApiKeyManager {
    if (!instance) {
      instance = new ApiKeyManager()
    }
    return instance
  }
}
