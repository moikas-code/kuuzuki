#!/usr/bin/env node
const { spawn, spawnSync } = require('child_process');
const { join, dirname, resolve } = require('path');
const { existsSync, realpathSync } = require('fs');
const os = require('os');

// Resolve the real path of this script
const scriptPath = realpathSync(__filename);
const scriptDir = dirname(scriptPath);

// Check if bun is available
const hasBun = (() => {
  try {
    const result = spawnSync(process.platform === 'win32' ? 'bun.exe' : 'bun', ['--version'], { 
      stdio: 'pipe',
      shell: false
    });
    return result.status === 0;
  } catch {
    return false;
  }
})();

if (!hasBun) {
  console.error('Bun runtime is required to run kuuzuki');
  console.error('Install it from: https://bun.sh');
  process.exit(1);
}

// ALWAYS run through TypeScript entry point
// This ensures proper initialization and environment setup
const indexPath = join(scriptDir, '..', 'src', 'index.ts');

if (!existsSync(indexPath)) {
  console.error('Could not find kuuzuki source files at:', indexPath);
  console.error('This appears to be a broken installation.');
  process.exit(1);
}

const bunCmd = process.platform === 'win32' ? 'bun.exe' : 'bun';
const child = spawn(bunCmd, ['run', indexPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
  cwd: process.cwd(),
  shell: false
});

child.on('error', (err) => {
  if (err.code === 'ENOENT') {
    console.error('Could not find bun. Please install it from https://bun.sh');
  } else {
    console.error('Failed to start kuuzuki:', err.message);
  }
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1);
  } else {
    process.exit(code || 0);
  }
});

// Handle signals properly
if (process.platform !== 'win32') {
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
} else {
  process.on('SIGINT', () => child.kill());
  process.on('SIGTERM', () => child.kill());
}