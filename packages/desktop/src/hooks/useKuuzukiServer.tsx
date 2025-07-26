import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react'
import { AutoDetectClient } from '../utils/serverAutoDetect'

interface KuuzukiServerContextType {
  client: AutoDetectClient | null
  serverUrl: string | null
  isConnecting: boolean
  isConnected: boolean
  error: string | null
  reconnect: () => Promise<void>
}

const KuuzukiServerContext = createContext<KuuzukiServerContextType | null>(null)

interface KuuzukiServerProviderProps {
  children: ReactNode
  autoConnect?: boolean
  onConnect?: (url: string) => void
  onError?: (error: Error) => void
}

export function KuuzukiServerProvider({
  children,
  autoConnect = true,
  onConnect,
  onError
}: KuuzukiServerProviderProps) {
  const [client] = useState(() => new AutoDetectClient())
  const [serverUrl, setServerUrl] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = useCallback(async () => {
    if (isConnecting) return

    setIsConnecting(true)
    setError(null)

    try {
      await client.connect()
      const url = await client.ensureConnected()
      setServerUrl(url)
      setIsConnected(true)
      onConnect?.(url)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error.message)
      setIsConnected(false)
      onError?.(error)
    } finally {
      setIsConnecting(false)
    }
  }, [client, isConnecting, onConnect, onError])

  useEffect(() => {
    if (autoConnect && !isConnected && !isConnecting) {
      connect()
    }
  }, [autoConnect, isConnected, isConnecting, connect])

  // Periodically check connection health
  useEffect(() => {
    if (!isConnected) return

    const checkHealth = async () => {
      try {
        const response = await client.request('/health')
        if (!response.ok) {
          throw new Error('Health check failed')
        }
      } catch (err) {
        setIsConnected(false)
        setServerUrl(null)
        setError('Connection lost')
        // Try to reconnect
        connect()
      }
    }

    const interval = setInterval(checkHealth, 5000) // Check every 5 seconds
    return () => clearInterval(interval)
  }, [isConnected, client, connect])

  const value: KuuzukiServerContextType = {
    client,
    serverUrl,
    isConnecting,
    isConnected,
    error,
    reconnect: connect,
  }

  return (
    <KuuzukiServerContext.Provider value={value}>
      {children}
    </KuuzukiServerContext.Provider>
  )
}

export function useKuuzukiServer() {
  const context = useContext(KuuzukiServerContext)
  if (!context) {
    throw new Error('useKuuzukiServer must be used within KuuzukiServerProvider')
  }
  return context
}

// Convenience hook for making API requests
export function useKuuzukiApi() {
  const { client, isConnected, error } = useKuuzukiServer()

  const request = useCallback(async (path: string, options?: RequestInit) => {
    if (!client || !isConnected) {
      throw new Error('Not connected to server')
    }

    const response = await client.request(path, options)
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`API error: ${response.status} ${text}`)
    }

    return response.json()
  }, [client, isConnected])

  return {
    request,
    isReady: isConnected && !error,
    error,
  }
}