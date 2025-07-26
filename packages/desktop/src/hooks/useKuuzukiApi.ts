import { useState, useEffect } from 'react'
import { KuuzukiApi } from '../services/kuuzukiApi'

export function useKuuzukiApi() {
  const [api] = useState(() => new KuuzukiApi())
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initializeApi = async () => {
      try {
        await api.initialize()
        setIsConnected(true)
        setError(null)
      } catch (err) {
        setIsConnected(false)
        setError(err instanceof Error ? err.message : 'Failed to connect to Kuuzuki')
      }
    }

    initializeApi()
  }, [api])

  return {
    api,
    isConnected,
    error,
  }
}