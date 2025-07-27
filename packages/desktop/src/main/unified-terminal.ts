import { EventEmitter } from 'events';
import * as pty from 'node-pty-prebuilt-multiarch';
import { IPty } from 'node-pty-prebuilt-multiarch';
import * as path from 'path';
import * as os from 'os';

export type TerminalMode = 'single' | 'split';

export class UnifiedTerminalManager extends EventEmitter {
  private bashPty: IPty | null = null;
  private kuuzukiPty: IPty | null = null;
  private currentMode: TerminalMode = 'single';
  private currentDirectory: string = process.cwd();
  private kuuzukiBinary: string = '';
  private isKuuzukiVisible: boolean = false;

  async initialize(kuuzukiBinary: string) {
    this.kuuzukiBinary = kuuzukiBinary;
    console.log('Initializing unified terminal with binary:', kuuzukiBinary);
    
    // Initialize bash terminal
    await this.startBashTerminal();
    
    // Don't start kuuzuki until split mode is activated
    this.emit('initialized');
  }

  private async startBashTerminal() {
    if (this.bashPty) {
      this.bashPty.kill();
    }

    const shell = process.env.SHELL || '/bin/bash';
    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      FORCE_COLOR: '1',
      // Fix for terminal formatting
      PS1: '\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ '
    };

    this.bashPty = pty.spawn(shell, ['--login'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd: this.currentDirectory,
      env: env as any,
    });

    this.bashPty.onData((data: string) => {
      this.emit('bash-data', data);
      
      // Track directory changes
      this.checkDirectoryChange(data);
    });

    this.bashPty.onExit(() => {
      this.emit('bash-exit');
    });

    // Send initial clear command to clean up
    this.bashPty.write('clear\r');
  }

  private async startKuuzukiTerminal() {
    if (this.kuuzukiPty) {
      this.kuuzukiPty.kill();
    }

    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      NO_PROXY_SERVER: 'true',
      KUUZUKI_NO_PROXY: 'true',
      FORCE_COLOR: '1'
    };

    this.kuuzukiPty = pty.spawn(this.kuuzukiBinary, ['tui'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd: this.currentDirectory,
      env: env as any,
    });

    this.kuuzukiPty.onData((data: string) => {
      this.emit('kuuzuki-data', data);
    });

    this.kuuzukiPty.onExit(() => {
      this.emit('kuuzuki-exit');
    });
  }

  private checkDirectoryChange(data: string) {
    // Simple directory tracking - look for cd commands
    const cdMatch = data.match(/cd\s+([^\r\n]+)/);
    if (cdMatch) {
      const newDir = cdMatch[1].trim();
      if (newDir) {
        // Handle relative and absolute paths
        if (newDir.startsWith('/')) {
          this.currentDirectory = newDir;
        } else if (newDir === '~') {
          this.currentDirectory = os.homedir();
        } else if (newDir === '..') {
          this.currentDirectory = path.dirname(this.currentDirectory);
        } else {
          this.currentDirectory = path.join(this.currentDirectory, newDir);
        }
        
        // If kuuzuki is running, update its directory
        if (this.kuuzukiPty && this.currentMode === 'split') {
          this.syncKuuzukiDirectory();
        }
        
        this.emit('directory-changed', this.currentDirectory);
      }
    }
  }

  private async syncKuuzukiDirectory() {
    // Restart kuuzuki in the new directory
    if (this.kuuzukiPty) {
      await this.startKuuzukiTerminal();
    }
  }

  toggleSplitMode() {
    if (this.currentMode === 'single') {
      this.currentMode = 'split';
      this.isKuuzukiVisible = true;
      
      // Start kuuzuki if not already running
      if (!this.kuuzukiPty) {
        this.startKuuzukiTerminal();
      }
    } else {
      this.currentMode = 'single';
      this.isKuuzukiVisible = false;
      
      // Don't kill kuuzuki, just hide it
    }
    
    this.emit('mode-changed', this.currentMode);
    return this.currentMode;
  }

  writeToBash(data: string) {
    if (this.bashPty) {
      this.bashPty.write(data);
    }
  }

  writeToKuuzuki(data: string) {
    if (this.kuuzukiPty) {
      this.kuuzukiPty.write(data);
    }
  }

  resizeBash(cols: number, rows: number) {
    if (this.bashPty) {
      this.bashPty.resize(cols, rows);
    }
  }

  resizeKuuzuki(cols: number, rows: number) {
    if (this.kuuzukiPty) {
      this.kuuzukiPty.resize(cols, rows);
    }
  }

  getCurrentMode() {
    return this.currentMode;
  }

  getCurrentDirectory() {
    return this.currentDirectory;
  }

  async restartBash() {
    await this.startBashTerminal();
  }

  async restartKuuzuki() {
    if (this.isKuuzukiVisible) {
      await this.startKuuzukiTerminal();
    }
  }

  destroy() {
    if (this.bashPty) {
      try {
        this.bashPty.kill();
      } catch (e) {
        console.error('Error killing bash PTY:', e);
      }
      this.bashPty = null;
    }

    if (this.kuuzukiPty) {
      try {
        this.kuuzukiPty.kill();
      } catch (e) {
        console.error('Error killing kuuzuki PTY:', e);
      }
      this.kuuzukiPty = null;
    }

    this.removeAllListeners();
  }
}

export const unifiedTerminal = new UnifiedTerminalManager();