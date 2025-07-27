import React, { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'

interface MultiTerminalProps {
  mode: 'terminal' | 'kuuzuki' | 'split'
  onReady?: () => void
  onModeChange?: (mode: 'terminal' | 'kuuzuki' | 'split') => void
  onFocusChange?: (pane: 'terminal' | 'kuuzuki') => void
}

export const MultiTerminal: React.FC<MultiTerminalProps> = ({ 
  mode, 
  onReady,
  onFocusChange 
}) => {
  const terminalContainerRef = useRef<HTMLDivElement>(null)
  const kuuzukiContainerRef = useRef<HTMLDivElement>(null)
  
  const terminalRef = useRef<XTerm | null>(null)
  const kuuzukiRef = useRef<XTerm | null>(null)
  
  const terminalFitRef = useRef<FitAddon | null>(null)
  const kuuzukiFitRef = useRef<FitAddon | null>(null)
  
  const [isInitialized, setIsInitialized] = useState(false)
  const [focusedPane, setFocusedPane] = useState<'terminal' | 'kuuzuki'>('terminal')
  const [terminalNeedsRestart, setTerminalNeedsRestart] = useState(false)
  const [kuuzukiNeedsRestart, setKuuzukiNeedsRestart] = useState(false)

  // Theme configuration
  const terminalTheme = {
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

  // Initialize terminals
  useEffect(() => {
    if (!terminalContainerRef.current || !kuuzukiContainerRef.current) return

    // Initialize bash terminal
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: terminalTheme,
      rightClickSelectsWord: true,
      allowProposedApi: true
    })

    const termFit = new FitAddon()
    const termWebLinks = new WebLinksAddon()
    term.loadAddon(termFit)
    term.loadAddon(termWebLinks)
    
    // Initialize kuuzuki terminal
    const kuuzuki = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: terminalTheme,
      rightClickSelectsWord: true,
      allowProposedApi: true
    })

    const kuuzukiFit = new FitAddon()
    const kuuzukiWebLinks = new WebLinksAddon()
    kuuzuki.loadAddon(kuuzukiFit)
    kuuzuki.loadAddon(kuuzukiWebLinks)

    // Open terminals
    term.open(terminalContainerRef.current)
    kuuzuki.open(kuuzukiContainerRef.current)

    // Fit to container
    termFit.fit()
    kuuzukiFit.fit()

    // Store refs
    terminalRef.current = term
    kuuzukiRef.current = kuuzuki
    terminalFitRef.current = termFit
    kuuzukiFitRef.current = kuuzukiFit

    setIsInitialized(true)

    // Handle window resize
    const handleResize = () => {
      if (mode === 'terminal' || mode === 'split') {
        termFit.fit()
      }
      if (mode === 'kuuzuki' || mode === 'split') {
        kuuzukiFit.fit()
      }
    }
    
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      // Dispose terminals only if they exist
      if (terminalRef.current) {
        terminalRef.current.dispose()
        terminalRef.current = null
      }
      if (kuuzukiRef.current) {
        kuuzukiRef.current.dispose()
        kuuzukiRef.current = null
      }
    }
  }, [])

  // Initialize terminal manager
  useEffect(() => {
    if (!isInitialized) return

    const initializeManager = async () => {
      try {
        await window.electronAPI.initTerminal()
        
        // Set up terminal data handlers
        const terminalDataUnsubscribe = window.electronAPI.onTerminalData((data) => {
          terminalRef.current?.write(data)
        })
        
        const kuuzukiDataUnsubscribe = window.electronAPI.onKuuzukiData((data) => {
          kuuzukiRef.current?.write(data)
        })
        
        // Set up exit handlers
        const terminalExitUnsubscribe = window.electronAPI.onTerminalExit(() => {
          terminalRef.current?.writeln('\r\n\x1b[33mTerminal exited. Press Enter to restart...\x1b[0m')
          // Set flag to restart on next Enter
          setTerminalNeedsRestart(true)
        })
        
        const kuuzukiExitUnsubscribe = window.electronAPI.onKuuzukiExit(() => {
          kuuzukiRef.current?.writeln('\r\n\x1b[33mKuuzuki exited. Press Enter to restart...\x1b[0m')
          // Set flag to restart on next Enter
          setKuuzukiNeedsRestart(true)
        })

        // Handle terminal input
        const termDisposable = terminalRef.current?.onData(async (data) => {
          if (mode === 'terminal' || (mode === 'split' && focusedPane === 'terminal')) {
            // Check if we need to restart the terminal
            if (terminalNeedsRestart && data === '\r') {
              setTerminalNeedsRestart(false)
              terminalRef.current?.clear()
              terminalRef.current?.writeln('Restarting terminal...')
              await window.electronAPI.restartTerminal('terminal')
            } else {
              window.electronAPI.writeToTerminal('terminal', data)
            }
          }
        })
        
        // Handle copy/paste for terminal
        terminalRef.current?.attachCustomKeyEventHandler((event) => {
          // Copy: Ctrl+C or Cmd+C
          if ((event.ctrlKey || event.metaKey) && event.key === 'c' && terminalRef.current?.hasSelection()) {
            navigator.clipboard.writeText(terminalRef.current.getSelection())
            return false // prevent default
          }
          // Paste: Ctrl+V or Cmd+V
          if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
            navigator.clipboard.readText().then(text => {
              if (text && (mode === 'terminal' || (mode === 'split' && focusedPane === 'terminal'))) {
                window.electronAPI.writeToTerminal('terminal', text)
              }
            })
            return false // prevent default
          }
          return true // allow other keys
        })

        // Handle kuuzuki input
        const kuuzukiDisposable = kuuzukiRef.current?.onData(async (data) => {
          if (mode === 'kuuzuki' || (mode === 'split' && focusedPane === 'kuuzuki')) {
            // Check if we need to restart kuuzuki
            if (kuuzukiNeedsRestart && data === '\r') {
              setKuuzukiNeedsRestart(false)
              kuuzukiRef.current?.clear()
              kuuzukiRef.current?.writeln('Restarting Kuuzuki...')
              await window.electronAPI.restartTerminal('kuuzuki')
            } else {
              window.electronAPI.writeToTerminal('kuuzuki', data)
            }
          }
        })
        
        // Handle copy/paste for kuuzuki
        kuuzukiRef.current?.attachCustomKeyEventHandler((event) => {
          // Copy: Ctrl+C or Cmd+C
          if ((event.ctrlKey || event.metaKey) && event.key === 'c' && kuuzukiRef.current?.hasSelection()) {
            navigator.clipboard.writeText(kuuzukiRef.current.getSelection())
            return false // prevent default
          }
          // Paste: Ctrl+V or Cmd+V
          if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
            navigator.clipboard.readText().then(text => {
              if (text && (mode === 'kuuzuki' || (mode === 'split' && focusedPane === 'kuuzuki'))) {
                window.electronAPI.writeToTerminal('kuuzuki', text)
              }
            })
            return false // prevent default
          }
          return true // allow other keys
        })

        // Handle resize
        terminalRef.current?.onResize(({ cols, rows }) => {
          if (mode === 'terminal' || mode === 'split') {
            window.electronAPI.resizeTerminal('terminal', cols, rows)
          }
        })

        kuuzukiRef.current?.onResize(({ cols, rows }) => {
          if (mode === 'kuuzuki' || mode === 'split') {
            window.electronAPI.resizeTerminal('kuuzuki', cols, rows)
          }
        })

        // Enable auto-sync for split mode
        window.electronAPI.enableAutoSync(3000)
        
        // Add right-click context menu
        const handleContextMenu = (e: MouseEvent) => {
          e.preventDefault()
          const target = e.target as HTMLElement
          const isTerminal = terminalContainerRef.current?.contains(target)
          const isKuuzuki = kuuzukiContainerRef.current?.contains(target)
          
          if (isTerminal && terminalRef.current?.hasSelection()) {
            // Copy selection on right click if there's a selection
            navigator.clipboard.writeText(terminalRef.current.getSelection())
          } else if (isKuuzuki && kuuzukiRef.current?.hasSelection()) {
            // Copy selection on right click if there's a selection
            navigator.clipboard.writeText(kuuzukiRef.current.getSelection())
          }
        }
        
        document.addEventListener('contextmenu', handleContextMenu)
        
        // Listen for context updates
        const dirSyncUnsubscribe = window.electronAPI.onDirectorySynced((dir) => {
          console.log('Directory synced:', dir)
        })
        
        const historyUnsubscribe = window.electronAPI.onHistoryUpdated((history) => {
          console.log('History updated:', history.length, 'commands')
        })

        onReady?.()

        return () => {
          terminalDataUnsubscribe()
          kuuzukiDataUnsubscribe()
          terminalExitUnsubscribe()
          kuuzukiExitUnsubscribe()
          dirSyncUnsubscribe()
          historyUnsubscribe()
          termDisposable?.dispose()
          kuuzukiDisposable?.dispose()
          document.removeEventListener('contextmenu', handleContextMenu)
        }
      } catch (error) {
        console.error('Failed to initialize terminal manager:', error)
      }
    }

    initializeManager()

    // Cleanup only on unmount, not on every dependency change
    return () => {
      // Only destroy terminal when component unmounts
      if (isInitialized) {
        window.electronAPI.destroyTerminal()
      }
    }
  }, [isInitialized]) // Reduced dependencies to prevent unnecessary cleanup

  // Handle mode changes
  useEffect(() => {
    if (!isInitialized) return
    
    window.electronAPI.setTerminalMode(mode)
    
    // Trigger resize when mode changes
    setTimeout(() => {
      if (mode === 'terminal' || mode === 'split') {
        terminalFitRef.current?.fit()
      }
      if (mode === 'kuuzuki' || mode === 'split') {
        kuuzukiFitRef.current?.fit()
      }
    }, 100)
  }, [mode, isInitialized])

  // Handle focus changes
  const handlePaneFocus = (pane: 'terminal' | 'kuuzuki') => {
    setFocusedPane(pane)
    window.electronAPI.setTerminalFocus(pane)
    onFocusChange?.(pane)
  }

  // Render based on mode
  const renderTerminals = () => {
    switch (mode) {
      case 'terminal':
        return (
          <div className="terminal-single">
            <div 
              ref={terminalContainerRef} 
              className="terminal-pane terminal-focused"
              onClick={() => handlePaneFocus('terminal')}
            />
            <div ref={kuuzukiContainerRef} style={{ display: 'none' }} />
          </div>
        )
      
      case 'kuuzuki':
        return (
          <div className="terminal-single">
            <div ref={terminalContainerRef} style={{ display: 'none' }} />
            <div 
              ref={kuuzukiContainerRef} 
              className="terminal-pane kuuzuki-focused"
              onClick={() => handlePaneFocus('kuuzuki')}
            />
          </div>
        )
      
      case 'split':
        return (
          <div className="terminal-split">
            <div 
              ref={terminalContainerRef} 
              className={`terminal-pane terminal-left ${focusedPane === 'terminal' ? 'pane-focused' : ''}`}
              onClick={() => handlePaneFocus('terminal')}
            />
            <div className="terminal-divider" />
            <div 
              ref={kuuzukiContainerRef} 
              className={`terminal-pane terminal-right ${focusedPane === 'kuuzuki' ? 'pane-focused' : ''}`}
              onClick={() => handlePaneFocus('kuuzuki')}
            />
          </div>
        )
    }
  }

  return (
    <div className="multi-terminal-container">
      {renderTerminals()}
    </div>
  )
}