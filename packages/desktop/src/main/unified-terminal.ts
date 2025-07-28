import { EventEmitter } from 'events';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
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

    // Check if wrapper scripts exist
    const wrapperPath = path.join(__dirname, 'terminal-wrapper.sh');
    const pythonPtyPath = path.join(__dirname, 'pty-wrapper.py');
    const useWrapper = fs.existsSync(wrapperPath) && process.platform !== 'win32';
    const usePythonPty = fs.existsSync(pythonPtyPath) && process.platform !== 'win32' && !useWrapper;

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
        this.bashPty.write('clear\n');
      } catch (error) {
        console.error('Failed to spawn PTY, falling back to child_process:', error);
        usePty = false;
        await this.startBashTerminal(); // Retry with child_process
      }
    } else {
      // Fallback to child_process
      // Use wrapper script if available for better terminal handling
      let shellCommand: string;
      let shellArgs: string[];
      
      if (useWrapper) {
        shellCommand = wrapperPath;
        shellArgs = [];
        console.log('Using bash wrapper script for better signal handling');
      } else if (usePythonPty) {
        shellCommand = 'python3';
        shellArgs = [pythonPtyPath];
        console.log('Using Python PTY wrapper for proper terminal emulation');
      } else {
        shellCommand = shell;
        shellArgs = ['-i'];
        console.log('Using direct bash with interactive mode');
      }
      
      console.log('Starting bash with:', shellCommand, shellArgs);
      
      this.bashPty = spawn(shellCommand, shellArgs, {
        cwd: this.currentDirectory,
        env: {
          ...env,
          // Force unbuffered output
          PYTHONUNBUFFERED: '1',
          // Ensure we're in an interactive terminal
          TERM: 'xterm-256color',
          // Force color output
          FORCE_COLOR: '1',
          // Set PS1 to ensure prompt appears
          PS1: '\\$ '
        },
        stdio: 'pipe',
        // Don't use shell option as we're already spawning a shell
        shell: false,
        // Create new session and process group for proper signal handling
        detached: process.platform !== 'win32'
      });

      // Set encoding for streams
      if (this.bashPty.stdin) {
        this.bashPty.stdin.setDefaultEncoding('utf8');
      }
      if (this.bashPty.stdout) {
        this.bashPty.stdout.setEncoding('utf8');
      }
      if (this.bashPty.stderr) {
        this.bashPty.stderr.setEncoding('utf8');
      }

      this.bashPty.stdout?.on('data', (data: string) => {
        console.log('Bash stdout:', JSON.stringify(data));
        console.log('Bash stdout (readable):', data.replace(/\r/g, '\\r').replace(/\n/g, '\\n'));
        // Log if this looks like command output
        if (data.trim() && !data.includes('\u001b[')) {
          console.log('📋 Command output detected:', data.trim().substring(0, 100));
        }
        this.emit('bash-data', data);
        this.checkDirectoryChange(data);
      });

      this.bashPty.stderr?.on('data', (data: string) => {
        console.log('Bash stderr:', JSON.stringify(data));
        console.log('Bash stderr (readable):', data.replace(/\r/g, '\\r').replace(/\n/g, '\\n'));
        this.emit('bash-data', data);
      });

      this.bashPty.on('exit', () => {
        this.emit('bash-exit');
      });

      // Send initial commands to set up the shell properly
      // Skip most setup if using Python PTY wrapper as it handles terminal setup
      setTimeout(() => {
        if (this.bashPty.stdin && !this.bashPty.stdin.destroyed && !usePythonPty) {
          // Enable job control for proper signal handling
          this.bashPty.stdin.write('set -m\n', 'utf8');
          // Set up the shell to be more interactive-friendly
          this.bashPty.stdin.write('stty sane\n', 'utf8');
          // Enable interrupt key (Ctrl+C) and ensure it's properly configured
          this.bashPty.stdin.write('stty intr ^C\n', 'utf8');
          // Ensure signals are properly propagated
          this.bashPty.stdin.write('stty isig\n', 'utf8');
          // Enable echo and other terminal features
          this.bashPty.stdin.write('stty echo echoe echok echoctl echoke\n', 'utf8');
          
          setTimeout(() => {
            // Disable bracketed paste mode which can interfere
            this.bashPty.stdin?.write('printf "\\e[?2004l"\n', 'utf8');
            
            // Set up proper signal handling for child processes
            this.bashPty.stdin?.write('trap "" SIGTTOU\n', 'utf8');
            
            setTimeout(() => {
              // Clear the screen
              this.bashPty.stdin?.write('clear\n', 'utf8');
              
              // Set a simple prompt to ensure we see output
              this.bashPty.stdin?.write('export PS1="$ "\n', 'utf8');
            }, 100);
          }, 100);
        } else if (usePythonPty) {
          // For Python PTY wrapper, just clear the screen after a short delay
          setTimeout(() => {
            if (this.bashPty.stdin && !this.bashPty.stdin.destroyed) {
              this.bashPty.stdin.write('clear\n', 'utf8');
            }
          }, 500);
        }
      }, 200);
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
    console.log('UnifiedTerminalManager.toggleSplitMode called, current mode:', this.currentMode);
    
    if (this.currentMode === 'single') {
      this.currentMode = 'split';
      this.isKuuzukiVisible = true;
      
      console.log('Switching to split mode, isKuuzukiVisible:', this.isKuuzukiVisible);
      
      // Start kuuzuki if not already running
      if (!this.kuuzukiPty) {
        console.log('Starting kuuzuki terminal');
        this.startKuuzukiTerminal();
      }
    } else {
      this.currentMode = 'single';
      this.isKuuzukiVisible = false;
      
      console.log('Switching to single mode, isKuuzukiVisible:', this.isKuuzukiVisible);
      
      // Don't kill kuuzuki, just hide it
    }
    
    console.log('Emitting mode-changed event:', this.currentMode);
    this.emit('mode-changed', this.currentMode);
    return this.currentMode;
  }

  private lastCommand: string = '';
  private commandBuffer: string = '';
  
  writeToBash(data: string) {
    console.log('UnifiedTerminalManager.writeToBash:', JSON.stringify(data));
    
    // Handle Ctrl+C (SIGINT) for child_process
    if (data === '\x03' && !usePty && this.bashPty) {
      console.log('Ctrl+C detected - sending interrupt signal');
      
      // Try multiple approaches to ensure the signal is handled
      try {
        // First, write Ctrl+C to stdin (this works for some programs)
        if (this.bashPty.stdin && !this.bashPty.stdin.destroyed) {
          this.bashPty.stdin.write('\x03');
          console.log('Sent \\x03 (Ctrl+C) to bash stdin');
        }
        
        // Also send SIGINT to the process group if on Unix-like systems
        if (process.platform !== 'win32' && this.bashPty.pid) {
          // Send signal to the entire process group (negative PID)
          process.kill(-this.bashPty.pid, 'SIGINT');
          console.log('Sent SIGINT to process group:', -this.bashPty.pid);
        }
      } catch (error) {
        console.error('Error sending interrupt signal:', error);
        // Fallback: just write Ctrl+C character
        if (this.bashPty.stdin && !this.bashPty.stdin.destroyed) {
          this.bashPty.stdin.write('\x03');
        }
      }
      return;
    }
    
    // Track commands being typed
    if (data !== '\n' && data !== '\r' && data !== '\x03') {
      this.commandBuffer += data;
    } else if (data === '\n' || data === '\r') {
      if (this.commandBuffer.trim()) {
        this.lastCommand = this.commandBuffer.trim();
        console.log('🚀 COMMAND EXECUTED:', this.lastCommand);
      }
      this.commandBuffer = '';
    }
    
    if (this.bashPty) {
      if (usePty) {
        console.log('Writing to PTY');
        this.bashPty.write(data);
      } else {
        console.log('Writing to stdin');
        if (this.bashPty.stdin && !this.bashPty.stdin.destroyed) {
          try {
            // For child_process, handle different line endings
            let processedData = data;
            
            // If we receive a carriage return, convert it to newline for execution
            if (data === '\r') {
              processedData = '\n';
              console.log('Converting \\r to \\n for command execution');
            }
            
            // Log hex values for debugging
            console.log('Writing data hex:', Array.from(processedData).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' '));
            
            // Write the data and ensure it's flushed
            const written = this.bashPty.stdin.write(processedData);
            console.log('stdin.write returned:', written);
            
            // If this looks like a command (ends with newline), ensure it's processed
            if (processedData.includes('\n')) {
              console.log('Command detected, ensuring flush');
              // Force a flush by ending the write
              this.bashPty.stdin.write('');
            }
            
            // Force flush the stream if needed
            if (processedData.includes('\n') || processedData === '\n') {
              console.log('Command includes newline, should execute');
            }
          } catch (error) {
            console.error('Exception writing to stdin:', error);
          }
        } else {
          console.error('bashPty.stdin is null or destroyed');
        }
      }
    } else {
      console.error('bashPty is null, cannot write data');
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
        if (usePty) {
          this.bashPty.kill();
        } else {
          // For child_process, kill the entire process group
          if (process.platform !== 'win32' && this.bashPty.pid) {
            try {
              // Kill the process group (negative PID)
              process.kill(-this.bashPty.pid, 'SIGTERM');
            } catch (e) {
              // Fallback to killing just the process
              this.bashPty.kill('SIGTERM');
            }
          } else {
            this.bashPty.kill('SIGTERM');
          }
        }
      } catch (e) {
        console.error('Error killing bash PTY:', e);
      }
      this.bashPty = null;
    }

    if (this.kuuzukiPty) {
      try {
        if (usePty) {
          this.kuuzukiPty.kill();
        } else {
          this.kuuzukiPty.kill('SIGTERM');
        }
      } catch (e) {
        console.error('Error killing kuuzuki PTY:', e);
      }
      this.kuuzukiPty = null;
    }

    this.removeAllListeners();
  }
}

export const unifiedTerminal = new UnifiedTerminalManager();