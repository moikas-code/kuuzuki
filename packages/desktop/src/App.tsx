import { useState } from "react"
import { UnifiedTerminal } from './components/UnifiedTerminal'
import { TerminalDebug } from './components/TerminalDebug'
import './App.css'

// Temporarily show debug terminal
const DEBUG_MODE = false;

function App() {
  const [isReady, setIsReady] = useState(false)

  // Show debug terminal if in debug mode
  if (DEBUG_MODE) {
    return <TerminalDebug />;
  }

  return (
    <div className="app">
      <UnifiedTerminal onReady={() => setIsReady(true)} />
    </div>
  )
}

export default App