// Electron API wrapper for kuuzuki server management

export interface ServerInfo {
  port: number
  hostname: string
  url: string
  pid: number
  startTime: string
}

export async function readServerInfo(): Promise<ServerInfo | null> {
  if (window.electronAPI) {
    return await window.electronAPI.findServer()
  }
  return null
}

export async function findKuuzukiServer(): Promise<ServerInfo | null> {
  if (window.electronAPI) {
    return await window.electronAPI.findServer()
  }
  return null
}

export async function checkServerHealth(url: string): Promise<boolean> {
  if (window.electronAPI) {
    return await window.electronAPI.checkServerHealth(url)
  }
  
  // Fallback to direct fetch
  try {
    const response = await fetch(`${url}/health`)
    return response.ok
  } catch {
    return false
  }
}

export async function startKuuzukiServer(): Promise<string> {
  if (window.electronAPI) {
    const result = await window.electronAPI.startServer()
    if (result.success && result.url) {
      return result.url
    }
    throw new Error(result.error || 'Failed to start server')
  }
  throw new Error('Electron API not available')
}

export async function getKuuzukiServerUrl(): Promise<string | null> {
  const server = await findKuuzukiServer()
  return server?.url || null
}

export async function waitForKuuzukiServer(timeout = 30000): Promise<string> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    const url = await getKuuzukiServerUrl()
    if (url) {
      return url
    }

    // Wait a bit before trying again
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  throw new Error('Kuuzuki server did not start within timeout')
}