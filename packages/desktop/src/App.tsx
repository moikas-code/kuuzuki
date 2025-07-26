import { useState } from "react"
import { KuuzukiServerProvider } from './hooks/useKuuzukiServer'
import { Terminal } from './components/Terminal'
import './App.css'

function App() {
  const [serverUrl, setServerUrl] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  return (
    <KuuzukiServerProvider
      autoConnect={true}
      onConnect={(url) => {
        console.log('Connected to server:', url)
        setServerUrl(url)
      }}
      onError={(error) => {
        console.error('Server connection error:', error)
      }}
    >
      <div className="app">
        <header className="app-header">
          <h1>Kuuzuki Desktop</h1>
          {serverUrl && (
            <span className="server-status">
              Connected to {serverUrl}
            </span>
          )}
        </header>

        <main className="app-main">
          <Terminal
            className="terminal-container"
            onReady={() => setIsReady(true)}
          />
        </main>

        {isReady && (
          <footer className="app-footer">
            <span>Ready</span>
          </footer>
        )}
      </div>
    </KuuzukiServerProvider>
  )
}

export default App