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

// Check if compiled version exists
const distIndexPath = join(scriptDir, '..', 'dist', 'index.js');
const srcIndexPath = join(scriptDir, '..', 'src', 'index.ts');

let command, args, entryPoint;

if (existsSync(distIndexPath)) {
  // Use compiled JavaScript with Node.js
  console.log('Using compiled JavaScript version...');
  command = process.execPath; // Node.js executable
  args = [distIndexPath, ...process.argv.slice(2)];
  entryPoint = distIndexPath;
} else if (existsSync(srcIndexPath)) {
  // Fall back to Bun with TypeScript
  console.log('Using TypeScript source with Bun...');
  command = process.platform === 'win32' ? 'bun.exe' : 'bun';
  args = ['run', srcIndexPath, ...process.argv.slice(2)];
  entryPoint = srcIndexPath;
} else {
  console.error('Could not find kuuzuki files.');
  console.error('Expected either:', distIndexPath, 'or', srcIndexPath);
  console.error('This appears to be a broken installation.');
  process.exit(1);
}

const child = spawn(command, args, {
  stdio: 'inherit',
  env: process.env,
  cwd: process.cwd(),
  shell: false
});

child.on('error', (err) => {
  if (err.code === 'ENOENT') {
    if (command === process.execPath) {
      console.error('Could not find Node.js. This should not happen.');
    } else {
      console.error('Could not find bun. Please install it from https://bun.sh');
    }
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