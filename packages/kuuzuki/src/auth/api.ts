import { Config } from "../config/config"

export interface VerifyLicenseResponse {
  valid: boolean
  email?: string
  status?: string
  expiresAt?: number
}

export interface ActivateLicenseResponse {
  success: boolean
  valid: boolean
  status: string
}

export interface CreateCheckoutResponse {
  checkoutUrl: string
}

export interface CreatePortalResponse {
  portalUrl: string
}

export async function getApiUrl(): Promise<string> {
  const config = await Config.get()
  const apiUrl = process.env.KUUZUKI_API_URL || config.apiUrl || "https://api.kuuzuki.ai"
  return apiUrl.replace(/\/$/, "") // Remove trailing slash
}

export async function verifyLicense(licenseKey: string): Promise<VerifyLicenseResponse> {
  const apiUrl = await getApiUrl()
  const response = await fetch(`${apiUrl}/api/auth_verify_license?license=${encodeURIComponent(licenseKey)}`)
  
  if (!response.ok) {
    throw new Error(`Failed to verify license: ${response.statusText}`)
  }
  
  return response.json()
}

export async function activateLicense(email: string, licenseKey: string): Promise<ActivateLicenseResponse> {
  const apiUrl = await getApiUrl()
  const response = await fetch(`${apiUrl}/api/auth_activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, licenseKey }),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || `Failed to activate license: ${response.statusText}`)
  }
  
  return response.json()
}

export async function createCheckoutSession(email?: string): Promise<CreateCheckoutResponse> {
  const apiUrl = await getApiUrl()
  const response = await fetch(`${apiUrl}/api/billing_create_checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  })
  
  if (!response.ok) {
    throw new Error(`Failed to create checkout session: ${response.statusText}`)
  }
  
  return response.json()
}

export async function createPortalSession(licenseKey: string): Promise<CreatePortalResponse> {
  const apiUrl = await getApiUrl()
  const response = await fetch(`${apiUrl}/api/billing_portal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ licenseKey }),
  })
  
  if (!response.ok) {
    throw new Error(`Failed to create portal session: ${response.statusText}`)
  }
  
  return response.json()
}