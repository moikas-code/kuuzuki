import { homedir } from "os"
import { join } from "path"
import { promises as fs } from "fs"

export interface AuthData {
  apiKey: string
  email: string
  savedAt: number
  environment: "live" | "test"
}

const AUTH_FILE = join(homedir(), ".kuuzuki", "auth.json")

export async function ensureAuthDir(): Promise<void> {
  const dir = join(homedir(), ".kuuzuki")
  await fs.mkdir(dir, { recursive: true })
}

export async function saveAuth(data: AuthData): Promise<void> {
  await ensureAuthDir()
  await fs.writeFile(AUTH_FILE, JSON.stringify(data, null, 2))
}

export async function getAuth(): Promise<AuthData | null> {
  try {
    const content = await fs.readFile(AUTH_FILE, "utf-8")
    return JSON.parse(content)
  } catch {
    return null
  }
}

export async function clearAuth(): Promise<void> {
  try {
    await fs.unlink(AUTH_FILE)
  } catch {
    // Ignore if file doesn't exist
  }
}

export function validateApiKeyFormat(key: string): boolean {
  return /^kz_(live|test)_[a-z0-9]{32}$/.test(key)
}

export function getKeyEnvironment(key: string): "live" | "test" | null {
  if (key.startsWith("kz_live_")) return "live"
  if (key.startsWith("kz_test_")) return "test"
  return null
}

export function maskApiKey(key: string): string {
  if (!validateApiKeyFormat(key)) return key

  const parts = key.split("_")
  const prefix = `${parts[0]}_${parts[1]}_`
  const random = parts[2]
  const masked = random.slice(0, 4) + "****" + random.slice(-4)

  return prefix + masked
}

// Get API key from environment or storage
export async function getApiKey(): Promise<string | null> {
  // 1. Check environment variable (highest priority)
  const envKey = process.env["KUUZUKI_API_KEY"]
  if (envKey && validateApiKeyFormat(envKey)) {
    return envKey
  }

  // 2. Check local storage
  const auth = await getAuth()
  return auth?.apiKey || null
}
