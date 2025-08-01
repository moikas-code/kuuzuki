import { Config } from "../config/config"

export interface VerifyApiKeyResponse {
  valid: boolean
  email?: string
  status?: string
  scopes?: string[]
  expiresAt?: number
}

export interface RecoverApiKeyResponse {
  apiKey?: string
  email?: string
}

export interface CreateCheckoutResponse {
  checkoutUrl: string
}

export interface CreatePortalResponse {
  portalUrl: string
}

export async function getApiUrl(): Promise<string> {
  const config = await Config.get()
  const apiUrl = process.env["KUUZUKI_API_URL"] || config.apiUrl || "https://api.kuuzuki.ai"
  return apiUrl.replace(/\/$/, "") // Remove trailing slash
}

export async function verifyApiKey(apiKey: string): Promise<VerifyApiKeyResponse> {
  const apiUrl = await getApiUrl()
  const response = await fetch(`${apiUrl}/api/auth_verify_apikey`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "User-Agent": "kuuzuki-cli",
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to verify API key: ${response.statusText}`)
  }

  return response.json()
}

export async function recoverApiKey(email: string): Promise<RecoverApiKeyResponse> {
  const apiUrl = await getApiUrl()
  const response = await fetch(`${apiUrl}/api/auth_recover_apikey`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || `Failed to recover API key: ${response.statusText}`)
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

export async function createPortalSession(apiKey: string): Promise<CreatePortalResponse> {
  const apiUrl = await getApiUrl()
  const response = await fetch(`${apiUrl}/api/billing_portal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ apiKey }),
  })

  if (!response.ok) {
    throw new Error(`Failed to create portal session: ${response.statusText}`)
  }

  return response.json()
}
