import { EventEmitter } from 'events';
import { spawn as nodeSpawn, ChildProcess } from 'child_process';

// Try to import node-pty
let pty: typeof import('node-pty') | null = null;
try {
  pty = require('node-pty');
} catch (error) {
  console.warn('node-pty not available in terminal manager:', error);
}

export type TerminalMode = 'terminal' | 'kuuzuki' | 'split';

export interface TerminalData {
  terminal: string;
  kuuzuki: string;
}

type PtyProcess = any; // Will be IPty when available

export class TerminalManager extends EventEmitter {
  private bashPty: PtyProcess | ChildProcess | null = null;
  private kuuzukiPty: PtyProcess | ChildProcess | null = null;
  private activeMode: TerminalMode = 'terminal';
  private isInitialized = false;
  private focusedPane: 'terminal' | 'kuuzuki' = 'terminal'; // For split mode
  private autoSyncInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  async initialize(kuuzukiBinary: string) {
    if (this.isInitialized) return;
    
    // Initialize bash/zsh terminal
    const shell = process.env.SHELL || '/bin/bash';
    
    if (pty) {
      // Use node-pty for better terminal emulation
      this.bashPty = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 30,
        cwd: process.cwd(),
        env: process.env as any
      });

      this.kuuzukiPty = pty.spawn(kuuzukiBinary, ['tui'], {
        name: 'xterm-256color',
        cols: 80,
        rows: 30,
        cwd: process.cwd(),
        env: process.env as any
      });

      // PTY event handlers
      (this.bashPty as any).onData((data: string) => {
        this.emit('terminal-data', data);
      });

      (this.bashPty as any).onExit(() => {
        this.emit('terminal-exit');
      });

      (this.kuuzukiPty as any).onData((data: string) => {
        this.emit('kuuzuki-data', data);
      });

      (this.kuuzukiPty as any).onExit(() => {
        this.emit('kuuzuki-exit');
      });
    } else {
      // Fallback to child_process
      console.log('Using child_process fallback for terminals');
      this.bashPty = nodeSpawn(shell, ['-i'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLUMNS: '80',
          LINES: '30'
        },
        stdio: 'pipe'
      });

      this.kuuzukiPty = nodeSpawn(kuuzukiBinary, ['tui'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLUMNS: '80',
          LINES: '30',
          KUUZUKI_NO_PROXY: 'true',
          NO_PROXY_SERVER: 'true'
        },
        stdio: 'pipe'
      });

      // Child process event handlers
      const bashProc = this.bashPty as ChildProcess;
      const kuuzukiProc = this.kuuzukiPty as ChildProcess;

      bashProc.stdout?.on('data', (data) => {
        this.emit('terminal-data', data.toString());
      });

      bashProc.stderr?.on('data', (data) => {
        this.emit('terminal-data', data.toString());
      });

      bashProc.on('exit', () => {
        this.emit('terminal-exit');
      });

      kuuzukiProc.stdout?.on('data', (data) => {
        this.emit('kuuzuki-data', data.toString());
      });

      kuuzukiProc.stderr?.on('data', (data) => {
        this.emit('kuuzuki-data', data.toString());
      });

      kuuzukiProc.on('exit', () => {
        this.emit('kuuzuki-exit');
      });
    }

    this.isInitialized = true;
    this.emit('initialized');
  }

  setMode(mode: TerminalMode) {
    this.activeMode = mode;
    this.emit('mode-changed', mode);
  }

  getMode(): TerminalMode {
    return this.activeMode;
  }

  writeToTerminal(data: string) {
    if (!this.bashPty) return;
    
    if (pty && 'write' in this.bashPty) {
      (this.bashPty as any).write(data);
    } else {
      const proc = this.bashPty as ChildProcess;
      proc.stdin?.write(data);
    }
  }

  writeToKuuzuki(data: string) {
    if (!this.kuuzukiPty) return;
    
    if (pty && 'write' in this.kuuzukiPty) {
      (this.kuuzukiPty as any).write(data);
    } else {
      const proc = this.kuuzukiPty as ChildProcess;
      proc.stdin?.write(data);
    }
  }

  writeToActive(data: string) {
    switch (this.activeMode) {
      case 'terminal':
        this.writeToTerminal(data);
        break;
      case 'kuuzuki':
        this.writeToKuuzuki(data);
        break;
      case 'split':
        // In split mode, write to the focused pane
        if (this.focusedPane === 'terminal') {
          this.writeToTerminal(data);
        } else {
          this.writeToKuuzuki(data);
        }
        break;
    }
  }

  setFocusedPane(pane: 'terminal' | 'kuuzuki') {
    this.focusedPane = pane;
    this.emit('focus-changed', pane);
  }

  getFocusedPane(): 'terminal' | 'kuuzuki' {
    return this.focusedPane;
  }

  resizeTerminal(cols: number, rows: number) {
    if (this.bashPty && pty && 'resize' in this.bashPty) {
      (this.bashPty as any).resize(cols, rows);
    }
    // Note: Regular child processes don't support resize
  }

  resizeKuuzuki(cols: number, rows: number) {
    if (this.kuuzukiPty && pty && 'resize' in this.kuuzukiPty) {
      (this.kuuzukiPty as any).resize(cols, rows);
    }
    // Note: Regular child processes don't support resize
  }

  resizeBoth(cols: number, rows: number) {
    this.resizeTerminal(cols, rows);
    this.resizeKuuzuki(cols, rows);
  }

  async getCurrentDirectory(): Promise<string> {
    // Get current directory from bash terminal
    return new Promise((resolve) => {
      let output = '';
      const listener = (data: string) => {
        output += data;
        // Look for the prompt with pwd output
        const lines = output.split('\n');
        if (lines.length >= 2) {
          // The second-to-last line should be the directory
          const dir = lines[lines.length - 2].trim();
          if (dir && dir !== 'pwd' && !dir.includes('$')) {
            this.bashPty?.removeListener('data', listener);
            resolve(dir);
          }
        }
      };
      
      if (pty && 'on' in this.bashPty!) {
        this.bashPty.on('data', listener);
      } else {
        const proc = this.bashPty as ChildProcess;
        const stdoutListener = (data: Buffer) => listener(data.toString());
        proc.stdout?.on('data', stdoutListener);
      }
      
      // Send pwd command
      this.writeToTerminal('pwd\r');
      
      // Timeout fallback
      setTimeout(() => {
        if (pty && 'removeListener' in this.bashPty!) {
          this.bashPty.removeListener('data', listener);
        }
        resolve(process.cwd());
      }, 1000);
    });
  }

  async syncDirectory() {
    const dir = await this.getCurrentDirectory();
    
    // Change directory in kuuzuki
    this.writeToKuuzuki(`cd ${dir}\r`);
    
    // Emit event for UI updates
    this.emit('directory-synced', dir);
  }

  // Get environment variables from terminal
  async getEnvironment(): Promise<Record<string, string>> {
    return new Promise((resolve) => {
      let output = '';
      const listener = (data: string) => {
        output += data;
        // Check if we have the full env output
        if (output.includes('__ENV_END__')) {
          if (pty && 'removeListener' in this.bashPty!) {
            this.bashPty.removeListener('data', listener);
          }
          
          // Parse environment variables
          const env: Record<string, string> = {};
          const lines = output.split('\n');
          for (const line of lines) {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
              env[match[1]] = match[2];
            }
          }
          resolve(env);
        }
      };
      
      if (pty && 'on' in this.bashPty!) {
        this.bashPty.on('data', listener);
      } else {
        const proc = this.bashPty as ChildProcess;
        const stdoutListener = (data: Buffer) => listener(data.toString());
        proc.stdout?.on('data', stdoutListener);
      }
      
      // Send env command with marker
      this.writeToTerminal('env && echo "__ENV_END__"\r');
      
      // Timeout fallback
      setTimeout(() => {
        if (pty && 'removeListener' in this.bashPty!) {
          this.bashPty.removeListener('data', listener);
        }
        resolve(process.env as Record<string, string>);
      }, 2000);
    });
  }

  // Share command history between terminals
  private commandHistory: string[] = [];
  // private historyIndex = 0; // Reserved for future command history navigation

  addToHistory(command: string) {
    if (command.trim() && command !== this.commandHistory[this.commandHistory.length - 1]) {
      this.commandHistory.push(command);
      // this.historyIndex = this.commandHistory.length; // For future history navigation
      this.emit('history-updated', this.commandHistory);
    }
  }

  getHistory(): string[] {
    return [...this.commandHistory];
  }

  // Context sharing methods
  async shareContext() {
    const context = {
      directory: await this.getCurrentDirectory(),
      environment: await this.getEnvironment(),
      history: this.getHistory(),
      mode: this.activeMode,
      focusedPane: this.focusedPane
    };
    
    this.emit('context-shared', context);
    return context;
  }

  // Auto-sync on directory changes
  enableAutoSync(interval = 5000) {
    // Clear any existing interval
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }
    
    this.autoSyncInterval = setInterval(async () => {
      if (this.activeMode === 'split') {
        await this.syncDirectory();
      }
    }, interval);
  }

  restartBash() {
    // Kill existing bash process
    if (this.bashPty) {
      if (pty && 'kill' in this.bashPty) {
        (this.bashPty as any).kill();
      } else {
        (this.bashPty as ChildProcess).kill();
      }
    }
    
    // Start new bash process
    const shell = process.env.SHELL || '/bin/bash';
    if (pty) {
      this.bashPty = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 30,
        cwd: process.cwd(),
        env: process.env as any
      });
      
      (this.bashPty as any).onData((data: string) => {
        this.emit('terminal-data', data);
      });
      
      (this.bashPty as any).onExit(() => {
        this.emit('terminal-exit');
      });
    } else {
      this.bashPty = nodeSpawn(shell, ['-i'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLUMNS: '80',
          LINES: '30'
        },
        stdio: 'pipe'
      });
      
      const bashProc = this.bashPty as ChildProcess;
      bashProc.stdout?.on('data', (data) => {
        this.emit('terminal-data', data.toString());
      });
      
      bashProc.stderr?.on('data', (data) => {
        this.emit('terminal-data', data.toString());
      });
      
      bashProc.on('exit', () => {
        this.emit('terminal-exit');
      });
    }
  }
  
  restartKuuzuki(kuuzukiBinary: string) {
    // Kill existing kuuzuki process
    if (this.kuuzukiPty) {
      if (pty && 'kill' in this.kuuzukiPty) {
        (this.kuuzukiPty as any).kill();
      } else {
        (this.kuuzukiPty as ChildProcess).kill();
      }
    }
    
    // Start new kuuzuki process
    if (pty) {
      this.kuuzukiPty = pty.spawn(kuuzukiBinary, ['tui'], {
        name: 'xterm-256color',
        cols: 80,
        rows: 30,
        cwd: process.cwd(),
        env: process.env as any
      });
      
      (this.kuuzukiPty as any).onData((data: string) => {
        this.emit('kuuzuki-data', data);
      });
      
      (this.kuuzukiPty as any).onExit(() => {
        this.emit('kuuzuki-exit');
      });
    } else {
      this.kuuzukiPty = nodeSpawn(kuuzukiBinary, ['tui'], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLUMNS: '80',
          LINES: '30',
          KUUZUKI_NO_PROXY: 'true',
          NO_PROXY_SERVER: 'true'
        },
        stdio: 'pipe'
      });
      
      const kuuzukiProc = this.kuuzukiPty as ChildProcess;
      kuuzukiProc.stdout?.on('data', (data) => {
        this.emit('kuuzuki-data', data.toString());
      });
      
      kuuzukiProc.stderr?.on('data', (data) => {
        this.emit('kuuzuki-data', data.toString());
      });
      
      kuuzukiProc.on('exit', () => {
        this.emit('kuuzuki-exit');
      });
    }
  }

  destroy() {
    // Clear auto-sync interval
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
    
    // Kill bash process
    if (this.bashPty) {
      try {
        if (pty && 'kill' in this.bashPty) {
          (this.bashPty as any).kill();
        } else {
          const proc = this.bashPty as ChildProcess;
          proc.kill('SIGTERM');
          // Force kill after timeout
          setTimeout(() => {
            if (proc.exitCode === null) {
              proc.kill('SIGKILL');
            }
          }, 1000);
        }
      } catch (error) {
        console.error('Error killing bash process:', error);
      }
      this.bashPty = null;
    }
    
    // Kill kuuzuki process
    if (this.kuuzukiPty) {
      try {
        if (pty && 'kill' in this.kuuzukiPty) {
          (this.kuuzukiPty as any).kill();
        } else {
          const proc = this.kuuzukiPty as ChildProcess;
          proc.kill('SIGTERM');
          // Force kill after timeout
          setTimeout(() => {
            if (proc.exitCode === null) {
              proc.kill('SIGKILL');
            }
          }, 1000);
        }
      } catch (error) {
        console.error('Error killing kuuzuki process:', error);
      }
      this.kuuzukiPty = null;
    }
    
    this.isInitialized = false;
    this.removeAllListeners();
  }
}

export const terminalManager = new TerminalManager();