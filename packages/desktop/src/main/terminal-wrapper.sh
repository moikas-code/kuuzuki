#!/bin/bash
# Terminal wrapper script to ensure proper TTY allocation and signal handling

# Enable job control
set -m

# Trap signals and forward them to child processes
trap 'kill -INT $!' INT
trap 'kill -TERM $!' TERM

# Start bash with proper terminal settings
exec /usr/bin/env bash --login "$@"