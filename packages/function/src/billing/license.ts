import { customAlphabet } from "nanoid"

const generateLicenseKey = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 16)

export interface License {
  key: string
  email: string
  customerId: string
  subscriptionId: string
  status: "active" | "canceled" | "past_due" | "incomplete"
  createdAt: number
  expiresAt?: number
  metadata?: Record<string, any>
}

export function createLicenseKey(): string {
  const key = generateLicenseKey()
  // Format as XXXX-XXXX-XXXX-XXXX
  return key.match(/.{1,4}/g)?.join("-") || key
}

export async function storeLicense(
  kv: KVNamespace,
  license: License
): Promise<void> {
  const key = `license:${license.key}`
  await kv.put(key, JSON.stringify(license), {
    expirationTtl: 60 * 60 * 24 * 365, // 1 year TTL
  })

  // Also store by email for lookups
  const emailKey = `license:email:${license.email}`
  await kv.put(emailKey, license.key, {
    expirationTtl: 60 * 60 * 24 * 365,
  })

  // Store by customer ID
  const customerKey = `license:customer:${license.customerId}`
  await kv.put(customerKey, license.key, {
    expirationTtl: 60 * 60 * 24 * 365,
  })
}

export async function getLicense(
  kv: KVNamespace,
  key: string
): Promise<License | null> {
  const data = await kv.get(`license:${key}`)
  if (!data) return null
  return JSON.parse(data)
}

export async function getLicenseByEmail(
  kv: KVNamespace,
  email: string
): Promise<License | null> {
  const key = await kv.get(`license:email:${email}`)
  if (!key) return null
  return getLicense(kv, key)
}

export async function getLicenseByCustomerId(
  kv: KVNamespace,
  customerId: string
): Promise<License | null> {
  const key = await kv.get(`license:customer:${customerId}`)
  if (!key) return null
  return getLicense(kv, key)
}

export async function updateLicenseStatus(
  kv: KVNamespace,
  key: string,
  status: License["status"]
): Promise<void> {
  const license = await getLicense(kv, key)
  if (!license) throw new Error("License not found")

  license.status = status
  if (status === "canceled") {
    license.expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days grace period
  }

  await storeLicense(kv, license)
}

export function isLicenseValid(license: License): boolean {
  if (license.status !== "active") return false
  if (license.expiresAt && license.expiresAt < Date.now()) return false
  return true
}