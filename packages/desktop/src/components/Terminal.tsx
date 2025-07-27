import React, { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
// Removed useKuuzukiServer - Terminal now connects directly to PTY
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
  // Terminal now connects directly to PTY, no server connection needed

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

  // Connect to PTY when ready
  useEffect(() => {
    if (!isInitialized || !xtermRef.current) return

    const term = xtermRef.current

    let dataListener: (() => void) | null = null
    let exitListener: (() => void) | null = null
    let ptyStarted = false

    const startPty = async () => {
      // Clear terminal
      term.clear()
      term.writeln('\x1b[36mStarting Kuuzuki TUI...\x1b[0m')
      
      try {
        // Spawn the PTY terminal
        const result = await window.electronAPI.spawnTerminal()
        
        if (!result.success) {
          term.writeln(`\x1b[31mError: ${result.error}\x1b[0m`)
          return
        }

        ptyStarted = true

        // Listen for data from PTY
        dataListener = window.electronAPI.onTerminalData((data) => {
          term.write(data)
        })

        // Listen for PTY exit
        exitListener = window.electronAPI.onTerminalExit(() => {
          ptyStarted = false
          term.writeln('\r\n\x1b[33mTerminal exited. Press Enter to restart...\x1b[0m')
        })

        // Send keystrokes to PTY
        const disposable = term.onData((data) => {
          if (ptyStarted) {
            window.electronAPI.writeTerminal(data)
          } else if (data === '\r') {
            // Restart terminal on Enter when exited
            startPty()
          }
        })

        // Handle resize
        const handleResize = () => {
          if (fitAddonRef.current && xtermRef.current) {
            const { cols, rows } = xtermRef.current
            window.electronAPI.resizeTerminal('terminal', cols, rows)
          }
        }

        // Initial resize
        handleResize()

        // Listen for terminal resize
        term.onResize(({ cols, rows }) => {
          window.electronAPI.resizeTerminal('terminal', cols, rows)
        })

        onReady?.()

        return () => {
          disposable.dispose()
        }
      } catch (error) {
        term.writeln(`\x1b[31mError starting terminal: ${error}\x1b[0m`)
      }
    }

    startPty()

    return () => {
      // Cleanup listeners
      if (dataListener) dataListener()
      if (exitListener) exitListener()
      window.electronAPI.killTerminal()
    }
  }, [isInitialized, onReady])

  // Error handling is now done within the PTY connection logic

  return (
    <div className={className} style={{ height: '100%', position: 'relative' }}>
      <div ref={terminalRef} style={{ height: '100%' }} />

    </div>
  )
}