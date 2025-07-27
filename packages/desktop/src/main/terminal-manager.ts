import { spawn, IPty } from 'node-pty';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';

export type TerminalMode = 'terminal' | 'kuuzuki' | 'split';

export interface TerminalData {
  terminal: string;
  kuuzuki: string;
}

export class TerminalManager extends EventEmitter {
  private bashPty: IPty | null = null;
  private kuuzukiPty: IPty | null = null;
  private activeMode: TerminalMode = 'terminal';
  private kuuzukiBinary: string = '';
  private isInitialized = false;

  constructor() {
    super();
  }

  async initialize(kuuzukiBinary: string) {
    if (this.isInitialized) return;

    this.kuuzukiBinary = kuuzukiBinary;
    
    // Initialize bash/zsh terminal
    const shell = process.env.SHELL || '/bin/bash';
    this.bashPty = spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: process.env
    });

    // Initialize kuuzuki TUI
    this.kuuzukiPty = spawn(kuuzukiBinary, ['tui'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: process.env
    });

    // Set up event handlers
    this.bashPty.onData((data) => {
      this.emit('terminal-data', data);
    });

    this.bashPty.onExit(() => {
      this.emit('terminal-exit');
    });

    this.kuuzukiPty.onData((data) => {
      this.emit('kuuzuki-data', data);
    });

    this.kuuzukiPty.onExit(() => {
      this.emit('kuuzuki-exit');
    });

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
    if (this.bashPty) {
      this.bashPty.write(data);
    }
  }

  writeToKuuzuki(data: string) {
    if (this.kuuzukiPty) {
      this.kuuzukiPty.write(data);
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
        // In split mode, we need to determine which pane is focused
        // For now, default to terminal
        this.writeToTerminal(data);
        break;
    }
  }

  resizeTerminal(cols: number, rows: number) {
    if (this.bashPty) {
      this.bashPty.resize(cols, rows);
    }
  }

  resizeKuuzuki(cols: number, rows: number) {
    if (this.kuuzukiPty) {
      this.kuuzukiPty.resize(cols, rows);
    }
  }

  resizeBoth(cols: number, rows: number) {
    this.resizeTerminal(cols, rows);
    this.resizeKuuzuki(cols, rows);
  }

  async getCurrentDirectory(): Promise<string> {
    // Get current directory from bash terminal
    // This is platform-specific and might need adjustment
    return new Promise((resolve) => {
      const listener = (data: string) => {
        const match = data.match(/^(.+)\n/);
        if (match) {
          this.bashPty?.removeListener('data', listener);
          resolve(match[1].trim());
        }
      };
      
      this.bashPty?.on('data', listener);
      this.bashPty?.write('pwd\r');
      
      // Timeout fallback
      setTimeout(() => {
        this.bashPty?.removeListener('data', listener);
        resolve(process.cwd());
      }, 1000);
    });
  }

  async syncDirectory() {
    const dir = await this.getCurrentDirectory();
    
    // Change directory in kuuzuki
    if (this.kuuzukiPty) {
      this.kuuzukiPty.write(`cd ${dir}\r`);
    }
  }

  destroy() {
    if (this.bashPty) {
      this.bashPty.kill();
      this.bashPty = null;
    }
    
    if (this.kuuzukiPty) {
      this.kuuzukiPty.kill();
      this.kuuzukiPty = null;
    }
    
    this.isInitialized = false;
    this.removeAllListeners();
  }
}

export const terminalManager = new TerminalManager();