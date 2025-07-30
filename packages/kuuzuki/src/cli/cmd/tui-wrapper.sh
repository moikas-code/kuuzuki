#!/bin/bash
# Terminal wrapper for TUI to ensure proper cleanup

# Save terminal settings
STTY_SAVE=$(stty -g)

# Function to restore terminal on exit
cleanup() {
    # Restore terminal settings
    stty $STTY_SAVE
    # Clear any terminal modes
    printf '\033[?1049l' # Exit alternate screen
    printf '\033[?25h'   # Show cursor
    # Kill any child processes
    pkill -P $$
}

# Set up trap for cleanup
trap cleanup EXIT INT TERM

# Run the actual command
"$@"

# Exit with the same code
exit $?