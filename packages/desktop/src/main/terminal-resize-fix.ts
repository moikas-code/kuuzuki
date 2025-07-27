// Terminal resize fix for Kuuzuki Desktop
// This module handles terminal resizing for both PTY and child_process

import { ChildProcess } from 'child_process';

export function sendResizeSignal(process: ChildProcess | any, cols: number, rows: number) {
  // If it's a PTY process with resize method
  if (process && typeof process.resize === 'function') {
    process.resize(cols, rows);
    return true;
  }
  
  // If it's a child process, try to send SIGWINCH
  if (process && process.pid) {
    try {
      // Set environment variables for the new size
      process.env = {
        ...process.env,
        COLUMNS: cols.toString(),
        LINES: rows.toString(),
        TERM: 'xterm-256color'
      };
      
      // Send window change signal
      process.kill('SIGWINCH');
      return true;
    } catch (error) {
      console.error('Failed to send resize signal:', error);
      return false;
    }
  }
  
  return false;
}

export function createPtyEnvironment(cols: number = 80, rows: number = 30) {
  return {
    ...process.env,
    COLUMNS: cols.toString(),
    LINES: rows.toString(),
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    KUUZUKI_NO_PROXY: 'true',
    NO_PROXY_SERVER: 'true'
  };
}