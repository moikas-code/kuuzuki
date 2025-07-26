import { getKuuzukiServerUrl, waitForKuuzukiServer } from '../utils/kuuzukiServer'

export class KuuzukiApi {
  private baseUrl: string | null = null

  async initialize(): Promise<void> {
    try {
      // Try to get existing server URL
      this.baseUrl = await getKuuzukiServerUrl()

      if (!this.baseUrl) {
        // Wait for server to start (useful if Kuuzuki is starting up)
        console.log('Waiting for Kuuzuki server to start...')
        this.baseUrl = await waitForKuuzukiServer()
      }

      console.log(`Connected to Kuuzuki server at: ${this.baseUrl}`)
    } catch (error) {
      console.error('Failed to connect to Kuuzuki server:', error)
      throw error
    }
  }

  async sendMessage(message: string, sessionId?: string): Promise<any> {
    if (!this.baseUrl) {
      throw new Error('Kuuzuki server not initialized')
    }

    const response = await fetch(`${this.baseUrl}/sessions/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        sessionId,
        // Add other required fields based on the API
      }),
    })

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`)
    }

    return response.json()
  }

  async createSession(): Promise<any> {
    if (!this.baseUrl) {
      throw new Error('Kuuzuki server not initialized')
    }

    const response = await fetch(`${this.baseUrl}/sessions/new`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`)
    }

    return response.json()
  }

  async listProviders(): Promise<any> {
    if (!this.baseUrl) {
      throw new Error('Kuuzuki server not initialized')
    }

    const response = await fetch(`${this.baseUrl}/app/providers`)

    if (!response.ok) {
      throw new Error(`Failed to list providers: ${response.statusText}`)
    }

    return response.json()
  }

  // Add other API methods as needed
}