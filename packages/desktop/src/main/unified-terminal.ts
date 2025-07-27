import { EventEmitter } from 'events';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

// Try to load node-pty, but fallback to child_process if it fails
let pty: any;
let usePty = false;

try {
  pty = require('node-pty-prebuilt-multiarch');
  console.log('Using node-pty for terminal emulation');
  usePty = true;
} catch (error) {
  console.warn('node-pty not available, falling back to child_process');
  usePty = false;
}

export type TerminalMode = 'single' | 'split';

export class UnifiedTerminalManager extends EventEmitter {
  private bashPty: any = null;
  private kuuzukiPty: any = null;
  private currentMode: TerminalMode = 'single';
  private currentDirectory: string = process.cwd();
  private kuuzukiBinary: string = '';
  private isKuuzukiVisible: boolean = false;

  async initialize(kuuzukiBinary: string) {
    this.kuuzukiBinary = kuuzukiBinary;
    console.log('Initializing unified terminal with binary:', kuuzukiBinary);
    console.log('Using PTY:', usePty);
    
    // Initialize bash terminal
    await this.startBashTerminal();
    
    // Don't start kuuzuki until split mode is activated
    this.emit('initialized');
  }

  private async startBashTerminal() {
    if (this.bashPty) {
      try {
        this.bashPty.kill();
      } catch (e) {
        console.error('Error killing existing bash process:', e);
      }
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

    if (usePty) {
      try {
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
      } catch (error) {
        console.error('Failed to spawn PTY, falling back to child_process:', error);
        usePty = false;
        await this.startBashTerminal(); // Retry with child_process
      }
    } else {
      // Fallback to child_process
      this.bashPty = spawn(shell, ['-i', '-l'], {
        cwd: this.currentDirectory,
        env: env,
        stdio: 'pipe'
      });

      this.bashPty.stdout?.on('data', (data: Buffer) => {
        this.emit('bash-data', data.toString());
        this.checkDirectoryChange(data.toString());
      });

      this.bashPty.stderr?.on('data', (data: Buffer) => {
        this.emit('bash-data', data.toString());
      });

      this.bashPty.on('exit', () => {
        this.emit('bash-exit');
      });

      // Send initial clear command
      this.bashPty.stdin?.write('clear\r');
    }
  }

  private async startKuuzukiTerminal() {
    if (this.kuuzukiPty) {
      try {
        this.kuuzukiPty.kill();
      } catch (e) {
        console.error('Error killing existing kuuzuki process:', e);
      }
    }

    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      NO_PROXY_SERVER: 'true',
      KUUZUKI_NO_PROXY: 'true',
      FORCE_COLOR: '1'
    };

    if (usePty) {
      try {
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
      } catch (error) {
        console.error('Failed to spawn kuuzuki PTY, using child_process:', error);
        // Fallback to child_process for kuuzuki
        this.kuuzukiPty = spawn(this.kuuzukiBinary, ['tui'], {
          cwd: this.currentDirectory,
          env: env,
          stdio: 'pipe'
        });

        this.kuuzukiPty.stdout?.on('data', (data: Buffer) => {
          this.emit('kuuzuki-data', data.toString());
        });

        this.kuuzukiPty.stderr?.on('data', (data: Buffer) => {
          this.emit('kuuzuki-data', data.toString());
        });

        this.kuuzukiPty.on('exit', () => {
          this.emit('kuuzuki-exit');
        });
      }
    } else {
      // Use child_process
      this.kuuzukiPty = spawn(this.kuuzukiBinary, ['tui'], {
        cwd: this.currentDirectory,
        env: env,
        stdio: 'pipe'
      });

      this.kuuzukiPty.stdout?.on('data', (data: Buffer) => {
        this.emit('kuuzuki-data', data.toString());
      });

      this.kuuzukiPty.stderr?.on('data', (data: Buffer) => {
        this.emit('kuuzuki-data', data.toString());
      });

      this.kuuzukiPty.on('exit', () => {
        this.emit('kuuzuki-exit');
      });
    }
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
      if (usePty) {
        this.bashPty.write(data);
      } else {
        this.bashPty.stdin?.write(data);
      }
    }
  }

  writeToKuuzuki(data: string) {
    if (this.kuuzukiPty) {
      if (usePty) {
        this.kuuzukiPty.write(data);
      } else {
        this.kuuzukiPty.stdin?.write(data);
      }
    }
  }

  resizeBash(cols: number, rows: number) {
    if (this.bashPty && usePty) {
      try {
        this.bashPty.resize(cols, rows);
      } catch (e) {
        console.error('Error resizing bash terminal:', e);
      }
    }
  }

  resizeKuuzuki(cols: number, rows: number) {
    if (this.kuuzukiPty && usePty) {
      try {
        this.kuuzukiPty.resize(cols, rows);
      } catch (e) {
        console.error('Error resizing kuuzuki terminal:', e);
      }
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