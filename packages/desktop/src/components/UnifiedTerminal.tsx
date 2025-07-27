import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

export const UnifiedTerminal: React.FC = () => {
  const bashContainerRef = useRef<HTMLDivElement>(null);
  const kuuzukiContainerRef = useRef<HTMLDivElement>(null);
  const bashTermRef = useRef<XTerm | null>(null);
  const kuuzukiTermRef = useRef<XTerm | null>(null);
  const bashFitRef = useRef<FitAddon | null>(null);
  const kuuzukiFitRef = useRef<FitAddon | null>(null);
  
  const [isSplit, setIsSplit] = useState(false);
  const [currentDir, setCurrentDir] = useState('');
  const [bashNeedsRestart, setBashNeedsRestart] = useState(false);
  const [kuuzukiNeedsRestart, setKuuzukiNeedsRestart] = useState(false);

  // Terminal theme
  const terminalTheme = {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#d4d4d4',
    cursorAccent: '#1e1e1e',
    selection: '#3e4451',
    black: '#1e1e1e',
    red: '#f44747',
    green: '#4ec9b0',
    yellow: '#dcdcaa',
    blue: '#569cd6',
    magenta: '#c678dd',
    cyan: '#56b6c2',
    white: '#d4d4d4',
    brightBlack: '#545454',
    brightRed: '#f44747',
    brightGreen: '#4ec9b0',
    brightYellow: '#dcdcaa',
    brightBlue: '#569cd6',
    brightMagenta: '#c678dd',
    brightCyan: '#56b6c2',
    brightWhite: '#e5e5e5'
  };

  // Initialize terminals
  useEffect(() => {
    if (!bashContainerRef.current) return;
    if (bashTermRef.current) return; // Already initialized

    console.log('Setting up bash terminal');
    
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (!bashContainerRef.current) {
        console.error('Bash container ref not available after timeout');
        return;
      }

      try {
        // Initialize bash terminal
        const bashTerm = new XTerm({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
          theme: terminalTheme,
          allowProposedApi: true,
          scrollback: 10000,
          convertEol: true,
        });

        const bashFit = new FitAddon();
        const bashLinks = new WebLinksAddon();
        bashTerm.loadAddon(bashFit);
        bashTerm.loadAddon(bashLinks);

        console.log('Opening bash terminal in container');
        bashTerm.open(bashContainerRef.current);
        bashFit.fit();

        bashTermRef.current = bashTerm;
        bashFitRef.current = bashFit;

        console.log('Bash terminal opened, initializing IPC connection');
        // Initialize terminal manager
        initializeTerminals();

        // Handle window resize
        const handleResize = () => {
          if (bashFitRef.current && bashTermRef.current) {
            bashFitRef.current.fit();
          }
          if (isSplit && kuuzukiFitRef.current && kuuzukiTermRef.current) {
            kuuzukiFitRef.current.fit();
          }
        };

        window.addEventListener('resize', handleResize);
        
        // Store cleanup function
        const cleanup = () => {
          window.removeEventListener('resize', handleResize);
          bashTerm.dispose();
        };
        
        // Return cleanup
        return cleanup;
      } catch (error) {
        console.error('Error initializing bash terminal:', error);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  // Initialize kuuzuki terminal when split mode is enabled
  useEffect(() => {
    if (isSplit && kuuzukiContainerRef.current && !kuuzukiTermRef.current) {
      const kuuzukiTerm = new XTerm({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
        theme: terminalTheme,
        allowProposedApi: true,
        scrollback: 10000,
        convertEol: true,
      });

      const kuuzukiFit = new FitAddon();
      const kuuzukiLinks = new WebLinksAddon();
      kuuzukiTerm.loadAddon(kuuzukiFit);
      kuuzukiTerm.loadAddon(kuuzukiLinks);

      kuuzukiTerm.open(kuuzukiContainerRef.current);
      kuuzukiFit.fit();

      kuuzukiTermRef.current = kuuzukiTerm;
      kuuzukiFitRef.current = kuuzukiFit;

      // Set up kuuzuki handlers
      setupKuuzukiHandlers();
    }
  }, [isSplit]);

  const initializeTerminals = async () => {
    console.log('Initializing terminals from React component');
    try {
      const result = await window.electronAPI.initUnifiedTerminal();
      console.log('Terminal init result:', result);
      
      // Set up bash handlers
      const bashDataUnsub = window.electronAPI.onBashData((data) => {
        console.log('Received bash data:', data.length, 'bytes');
        bashTermRef.current?.write(data);
      });

      const bashExitUnsub = window.electronAPI.onBashExit(() => {
        bashTermRef.current?.writeln('\r\n\x1b[33mTerminal exited. Press Enter to restart...\x1b[0m');
        setBashNeedsRestart(true);
      });

      const modeChangeUnsub = window.electronAPI.onModeChanged((mode) => {
        setIsSplit(mode === 'split');
      });

      const dirChangeUnsub = window.electronAPI.onDirectoryChanged((dir) => {
        setCurrentDir(dir);
      });

      // Handle bash input
      bashTermRef.current?.onData(async (data) => {
        if (bashNeedsRestart && data === '\r') {
          setBashNeedsRestart(false);
          bashTermRef.current?.clear();
          await window.electronAPI.restartBash();
        } else {
          window.electronAPI.writeToBash(data);
        }
      });

      // Copy/paste support
      bashTermRef.current?.attachCustomKeyEventHandler((event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'c' && bashTermRef.current?.hasSelection()) {
          navigator.clipboard.writeText(bashTermRef.current.getSelection());
          return false;
        }
        if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
          navigator.clipboard.readText().then(text => {
            if (text) window.electronAPI.writeToBash(text);
          });
          return false;
        }
        // Toggle split mode with Cmd/Ctrl+D
        if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
          event.preventDefault();
          window.electronAPI.toggleSplitMode();
          return false;
        }
        return true;
      });

      // Handle resize
      bashTermRef.current?.onResize(({ cols, rows }) => {
        window.electronAPI.resizeBash(cols, rows);
      });


      return () => {
        bashDataUnsub();
        bashExitUnsub();
        modeChangeUnsub();
        dirChangeUnsub();
      };
    } catch (error) {
      console.error('Failed to initialize terminals:', error);
      bashTermRef.current?.writeln('\r\n\x1b[31mError: Failed to initialize terminal\x1b[0m');
    }
  };

  const setupKuuzukiHandlers = () => {
    if (!kuuzukiTermRef.current) return;

    window.electronAPI.onKuuzukiData((data) => {
      kuuzukiTermRef.current?.write(data);
    });

    window.electronAPI.onKuuzukiExit(() => {
      kuuzukiTermRef.current?.writeln('\r\n\x1b[33mKuuzuki exited. Press Enter to restart...\x1b[0m');
      setKuuzukiNeedsRestart(true);
    });

    // Handle kuuzuki input
    kuuzukiTermRef.current.onData(async (data) => {
      if (kuuzukiNeedsRestart && data === '\r') {
        setKuuzukiNeedsRestart(false);
        kuuzukiTermRef.current?.clear();
        await window.electronAPI.restartKuuzuki();
      } else {
        window.electronAPI.writeToKuuzuki(data);
      }
    });

    // Copy/paste support
    kuuzukiTermRef.current.attachCustomKeyEventHandler((event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'c' && kuuzukiTermRef.current?.hasSelection()) {
        navigator.clipboard.writeText(kuuzukiTermRef.current.getSelection());
        return false;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        navigator.clipboard.readText().then(text => {
          if (text) window.electronAPI.writeToKuuzuki(text);
        });
        return false;
      }
      return true;
    });

    // Handle resize
    kuuzukiTermRef.current.onResize(({ cols, rows }) => {
      window.electronAPI.resizeKuuzuki(cols, rows);
    });
  };

  console.log('UnifiedTerminal rendering, isSplit:', isSplit);
  
  return (
    <div className="unified-terminal-container">
      <div className="terminal-header">
        <div className="terminal-title">
          {isSplit ? 'Terminal & Kuuzuki AI' : 'Terminal'}
          {currentDir && <span className="terminal-path"> - {currentDir}</span>}
        </div>
        <div className="terminal-hint">
          Press {navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+D to toggle split view
        </div>
      </div>
      
      <div className={`terminal-content ${isSplit ? 'split' : 'single'}`}>
        <div className="terminal-pane bash-pane">
          <div ref={bashContainerRef} className="terminal-container" />
        </div>
        
        {isSplit && (
          <>
            <div className="terminal-divider" />
            <div className="terminal-pane kuuzuki-pane">
              <div ref={kuuzukiContainerRef} className="terminal-container" />
            </div>
          </>
        )}
      </div>
    </div>
  );
};