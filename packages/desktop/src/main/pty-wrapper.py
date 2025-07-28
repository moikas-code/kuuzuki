#!/usr/bin/env python3
"""
PTY wrapper for better terminal emulation when node-pty is not available.
This provides proper pseudo-terminal allocation and signal handling.
"""

import os
import sys
import pty
import select
import termios
import tty
import signal
import json

def handle_sigint(signum, frame):
    """Forward SIGINT to the child process"""
    if child_pid:
        os.kill(child_pid, signal.SIGINT)

def handle_sigterm(signum, frame):
    """Clean up and exit on SIGTERM"""
    if child_pid:
        os.kill(child_pid, signal.SIGTERM)
    sys.exit(0)

# Global to store child PID
child_pid = None

def main():
    # Set up signal handlers
    signal.signal(signal.SIGINT, handle_sigint)
    signal.signal(signal.SIGTERM, handle_sigterm)
    
    # Get shell from environment or use default
    shell = os.environ.get('SHELL', '/bin/bash')
    
    # Fork and create a pseudo-terminal
    global child_pid
    child_pid, master_fd = pty.fork()
    
    if child_pid == 0:
        # Child process - exec the shell
        os.execvp(shell, [shell, '--login'])
    else:
        # Parent process - relay data between stdin/stdout and the PTY
        try:
            # Save terminal settings
            old_tty = termios.tcgetattr(sys.stdin)
            tty.setraw(sys.stdin.fileno())
            
            # Set up non-blocking I/O
            os.set_blocking(master_fd, False)
            os.set_blocking(sys.stdin.fileno(), False)
            
            while True:
                # Use select to wait for data
                r, w, e = select.select([sys.stdin, master_fd], [], [], 0.1)
                
                # Read from stdin and write to PTY
                if sys.stdin in r:
                    try:
                        data = os.read(sys.stdin.fileno(), 1024)
                        if data:
                            os.write(master_fd, data)
                    except (OSError, IOError):
                        pass
                
                # Read from PTY and write to stdout
                if master_fd in r:
                    try:
                        data = os.read(master_fd, 1024)
                        if data:
                            os.write(sys.stdout.fileno(), data)
                            sys.stdout.flush()
                    except (OSError, IOError):
                        break
                
                # Check if child process has exited
                try:
                    pid, status = os.waitpid(child_pid, os.WNOHANG)
                    if pid != 0:
                        break
                except:
                    break
                    
        finally:
            # Restore terminal settings
            try:
                termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old_tty)
            except:
                pass

if __name__ == '__main__':
    main()