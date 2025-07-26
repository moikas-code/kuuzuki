/**
 * Server auto-detection utility
 * Works with kuuzuki servers
 */

// Common ports used by kuuzuki
const DEFAULT_PORTS = [4096, 3000, 8080, 8000, 5000]
const DYNAMIC_PORT_RANGE = { start: 30000, end: 50000, step: 500 }

interface HealthResponse {
  status: 'ok'
  timestamp: string
  version?: string
}

/**
 * Check if a server is healthy at the given URL
 */
async function checkHealth(url: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 1000) // 1s timeout

    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId))

    if (response.ok) {
      const data = await response.json() as HealthResponse
      return data.status === 'ok'
    }
  } catch {
    // Server not responding or doesn't have health endpoint
  }
  return false
}

/**
 * Try to find a running kuuzuki server
 */
export async function findServer(): Promise<string | null> {
  // Check last known port from localStorage
  const lastPort = localStorage.getItem('kuuzuki-server-port')
  if (lastPort) {
    const url = `http://127.0.0.1:${lastPort}`
    if (await checkHealth(url)) {
      console.log(`Found server at last known port: ${url}`)
      return url
    }
  }

  // Try default ports
  for (const port of DEFAULT_PORTS) {
    const url = `http://127.0.0.1:${port}`
    if (await checkHealth(url)) {
      console.log(`Found server at default port: ${url}`)
      localStorage.setItem('kuuzuki-server-port', port.toString())
      return url
    }
  }

  // Scan dynamic port range (for port 0 assignments)
  console.log('Scanning for server on dynamic ports...')
  for (let port = DYNAMIC_PORT_RANGE.start; port < DYNAMIC_PORT_RANGE.end; port += DYNAMIC_PORT_RANGE.step) {
    // Check 10 ports at a time for faster scanning
    const checks = []
    for (let i = 0; i < 10 && port + i < DYNAMIC_PORT_RANGE.end; i++) {
      const currentPort = port + i
      const url = `http://127.0.0.1:${currentPort}`
      checks.push(
        checkHealth(url).then(healthy => healthy ? { url, port: currentPort } : null)
      )
    }

    const results = await Promise.all(checks)
    const found = results.find(r => r !== null)
    if (found) {
      console.log(`Found server at dynamic port: ${found.url}`)
      localStorage.setItem('kuuzuki-server-port', found.port.toString())
      return found.url
    }
  }

  return null
}

/**
 * Wait for a server to become available
 */
export async function waitForServer(timeout = 30000): Promise<string> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    const url = await findServer()
    if (url) {
      return url
    }

    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  throw new Error('Server did not become available within timeout')
}

/**
 * Simple API client that auto-detects the server
 */
export class AutoDetectClient {
  private serverUrl: string | null = null

  async connect(): Promise<void> {
    this.serverUrl = await findServer()
    if (!this.serverUrl) {
      throw new Error('No server found. Please start kuuzuki first.')
    }
  }

  async ensureConnected(): Promise<string> {
    if (!this.serverUrl) {
      await this.connect()
    }
    return this.serverUrl!
  }

  async request(path: string, options?: RequestInit): Promise<Response> {
    const url = await this.ensureConnected()
    return fetch(`${url}${path}`, options)
  }
}