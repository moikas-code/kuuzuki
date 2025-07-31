#!/usr/bin/env node

import { chmod } from 'fs/promises'
import { join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

async function fixPermissions() {
  try {
    // Fix permissions for TUI binary
    const tuiBinary = join(__dirname, 'bin', 'kuuzuki-tui')
    await chmod(tuiBinary, 0o755)
    
    // Also fix the main binary just in case
    const mainBinary = join(__dirname, 'bin', 'kuuzuki')
    await chmod(mainBinary, 0o755)
    
    // Handle Windows .exe files
    if (process.platform === 'win32') {
      try {
        await chmod(tuiBinary + '.exe', 0o755)
        await chmod(mainBinary + '.exe', 0o755)
      } catch {
        // Ignore if .exe files don't exist
      }
    }
    
    console.log('✓ Fixed binary permissions')
  } catch (error) {
    // Don't fail installation if permissions can't be fixed
    // This might happen in some restricted environments
    console.warn('⚠️  Could not fix binary permissions:', error.message)
    console.warn('   You may need to run: chmod +x', join(__dirname, 'bin', '*'))
  }
}

// Only run if this is a direct installation (not a dependency)
if (process.env.npm_lifecycle_event === 'postinstall') {
  fixPermissions()
}