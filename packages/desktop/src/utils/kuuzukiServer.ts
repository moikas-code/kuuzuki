// Auto-detection utility for finding the kuuzuki server
// For Tauri apps, we use a simplified approach that tries common ports

interface ServerInfo {
  port: number
  hostname: string
  url: string
  pid: number
  startTime: string
}

// Common ports that kuuzuki might use
const COMMON_PORTS = [4096, 3000, 8080, 8000, 5000]

async function checkServerHealth(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      mode: 'cors',
    }).catch(() => null)
    return response?.ok || false
  } catch {
    return false
  }
}

export async function getKuuzukiServerUrl(): Promise<string | null> {
  // First, check if there's a server running on the last known port
  const lastKnownPort = localStorage.getItem('kuuzuki-server-port')
  if (lastKnownPort) {
    const url = `http://127.0.0.1:${lastKnownPort}`
    if (await checkServerHealth(url)) {
      return url
    }
  }

  // Try common ports
  for (const port of COMMON_PORTS) {
    const url = `http://127.0.0.1:${port}`
    if (await checkServerHealth(url)) {
      localStorage.setItem('kuuzuki-server-port', port.toString())
      return url
    }
  }

  // Check if running with a dynamic port (port 0)
  // This would require scanning a range of ports
  for (let port = 30000; port < 50000; port += 100) {
    const url = `http://127.0.0.1:${port}`
    if (await checkServerHealth(url)) {
      localStorage.setItem('kuuzuki-server-port', port.toString())
      return url
    }
  }

  return null
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

// Helper to read server info from Tauri backend
// This would need to be implemented as a Tauri command
export async function getServerInfoFromFile(): Promise<ServerInfo | null> {
  // In a real implementation, this would call a Tauri command like:
  // const { invoke } = window.__TAURI__.core
  // return await invoke('read_server_info')

  // For now, return null as this requires Tauri backend implementation
  return null
}