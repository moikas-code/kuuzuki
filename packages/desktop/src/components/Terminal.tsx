import React, { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import { useKuuzukiServer } from '../hooks/useKuuzukiServer'
import 'xterm/css/xterm.css'

interface TerminalProps {
  className?: string
  onReady?: () => void
}

export const Terminal: React.FC<TerminalProps> = ({ className, onReady }) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const { serverUrl, isConnected, error, reconnect } = useKuuzukiServer()

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        black: '#1e1e1e',
        red: '#f44747',
        green: '#608b4e',
        yellow: '#dcdcaa',
        blue: '#569cd6',
        magenta: '#c678dd',
        cyan: '#56b6c2',
        white: '#d4d4d4',
        brightBlack: '#808080',
        brightRed: '#f44747',
        brightGreen: '#608b4e',
        brightYellow: '#dcdcaa',
        brightBlue: '#569cd6',
        brightMagenta: '#c678dd',
        brightCyan: '#56b6c2',
        brightWhite: '#ffffff'
      }
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(terminalRef.current)

    fitAddon.fit()

    xtermRef.current = term
    fitAddonRef.current = fitAddon
    setIsInitialized(true)

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      term.dispose()
    }
  }, [])

  // Connect to server when ready
  useEffect(() => {
    if (!isInitialized || !xtermRef.current || !isConnected || !serverUrl) return

    const term = xtermRef.current

    // Clear terminal and show connection message
    term.clear()
    term.writeln(`\x1b[32m✓ Connected to Kuuzuki server at ${serverUrl}\x1b[0m`)
    term.writeln('')

    // For now, show server info and instructions
    term.writeln('\x1b[36mKuuzuki Desktop Terminal\x1b[0m')
    term.writeln('')
    term.writeln('The Kuuzuki server is running in the background.')
    term.writeln('')
    term.writeln('Available endpoints:')
    term.writeln(`  • API: ${serverUrl}`)
    term.writeln(`  • Health: ${serverUrl}/health`)
    term.writeln(`  • Docs: ${serverUrl}/doc`)
    term.writeln('')
    term.writeln('You can use the Kuuzuki API to:')
    term.writeln('  • Create and manage sessions')
    term.writeln('  • Send messages to AI providers')
    term.writeln('  • Execute tools and commands')
    term.writeln('')

    // Set up a simple REPL for API testing
    let currentLine = ''

    const disposable = term.onData(async (data) => {
      if (data === '\r') { // Enter key
        term.writeln('')

        if (currentLine.trim()) {
          // Simple command parser
          const [cmd] = currentLine.trim().split(' ')

          switch (cmd) {
            case 'help':
              term.writeln('Available commands:')
              term.writeln('  help     - Show this help')
              term.writeln('  status   - Check server status')
              term.writeln('  providers - List available providers')
              term.writeln('  clear    - Clear terminal')
              break

            case 'status':
              try {
                const response = await fetch(`${serverUrl}/health`)
                const data = await response.json()
                term.writeln(`Server status: ${JSON.stringify(data, null, 2)}`)
              } catch (error) {
                term.writeln(`\x1b[31mError: ${error}\x1b[0m`)
              }
              break

            case 'providers':
              try {
                const response = await fetch(`${serverUrl}/app/providers`)
                const data = await response.json()
                term.writeln(`Available providers: ${JSON.stringify(data, null, 2)}`)
              } catch (error) {
                term.writeln(`\x1b[31mError: ${error}\x1b[0m`)
              }
              break

            case 'clear':
              term.clear()
              break

            default:
              term.writeln(`Unknown command: ${cmd}. Type 'help' for available commands.`)
          }
        }

        term.write('\r\n> ')
        currentLine = ''
      } else if (data === '\x7f') { // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1)
          term.write('\b \b')
        }
      } else if (data >= ' ') { // Printable characters
        currentLine += data
        term.write(data)
      }
    })

    // Show initial prompt
    term.write('> ')
    onReady?.()

    return () => {
      disposable.dispose()
    }
  }, [isInitialized, isConnected, serverUrl, onReady])

  // Show error state
  useEffect(() => {
    if (!error || !xtermRef.current) return

    const term = xtermRef.current
    term.writeln(`\x1b[31mError: ${error}\x1b[0m`)
    term.writeln('\x1b[33mPress Enter to retry...\x1b[0m')

    const disposable = term.onKey((e) => {
      if (e.key === '\r') {
        term.clear()
        term.writeln('\x1b[36mReconnecting...\x1b[0m')
        reconnect()
        disposable.dispose()
      }
    })

    return () => disposable.dispose()
  }, [error, reconnect])

  return (
    <div className={className} style={{ height: '100%', position: 'relative' }}>
      <div ref={terminalRef} style={{ height: '100%' }} />

      {!isConnected && !error && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: '#666'
        }}>
          <div>Connecting to Kuuzuki server...</div>
          <div style={{ marginTop: '10px', fontSize: '12px' }}>
            This may take a moment if the server is starting up
          </div>
        </div>
      )}
    </div>
  )
}