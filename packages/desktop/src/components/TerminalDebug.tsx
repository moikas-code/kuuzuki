import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export const TerminalDebug: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const term = new XTerm({
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(terminalRef.current);
    fitAddon.fit();
    
    term.writeln('=== Terminal Debug Mode ===');
    term.writeln('');
    
    // Test basic terminal
    term.writeln('✓ xterm.js loaded successfully');
    term.writeln('✓ Terminal rendered');
    term.writeln('');
    term.writeln('Testing IPC connection...');
    
    // Test IPC
    window.electronAPI.initTerminal().then(result => {
      if (result.success) {
        term.writeln('✓ IPC connection successful');
        setStatus('Connected');
      } else {
        term.writeln(`✗ IPC connection failed: ${result.error}`);
        setStatus('Failed');
      }
    }).catch(error => {
      term.writeln(`✗ IPC error: ${error}`);
      setStatus('Error');
    });

    xtermRef.current = term;

    return () => {
      term.dispose();
    };
  }, []);

  return (
    <div style={{ height: '100vh', width: '100vw', padding: '10px' }}>
      <div style={{ color: 'white', marginBottom: '10px' }}>Status: {status}</div>
      <div ref={terminalRef} style={{ height: 'calc(100% - 40px)', width: '100%' }} />
    </div>
  );
};