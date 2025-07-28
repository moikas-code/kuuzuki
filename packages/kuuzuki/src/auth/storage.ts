import { homedir } from "os"
import { join } from "path"
import { promises as fs } from "fs"

export interface AuthData {
  license: string
  email: string
  validatedAt: number
  status?: string
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

export async function isAuthValid(auth: AuthData): Promise<boolean> {
  // Check if auth is less than 5 minutes old
  const fiveMinutes = 5 * 60 * 1000
  const now = Date.now()
  return now - auth.validatedAt < fiveMinutes
}