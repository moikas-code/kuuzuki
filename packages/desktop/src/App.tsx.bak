import { useState } from "react"
import { Terminal } from './components/Terminal'
import './App.css'

function App() {
  const [isReady, setIsReady] = useState(false)

  return (
    <div className="app">
      <header className="app-header">
        <h1>Kuuzuki Desktop</h1>
        {isReady && (
          <span className="server-status">
            Terminal Ready
          </span>
        )}
      </header>

      <main className="app-main">
        <Terminal
          className="terminal-container"
          onReady={() => setIsReady(true)}
        />
      </main>

      <footer className="app-footer">
        Press Ctrl+C to exit terminal
      </footer>
    </div>
  )
}

export default App