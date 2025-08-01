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

// Check for different versions in order of preference
const bundledPath = join(scriptDir, '..', 'dist', 'index.js'); // Bun.build output
const compiledPath = join(scriptDir, '..', 'dist-tsc', 'index.js'); // TypeScript compilation
const srcIndexPath = join(scriptDir, '..', 'src', 'index.ts'); // Source TypeScript

let command, args, entryPoint;

if (existsSync(bundledPath)) {
  // Use Bun-bundled version (preferred - resolves namespace issues)
  console.log('Using Bun-bundled version...');
  command = process.platform === 'win32' ? 'bun.exe' : 'bun';
  args = ['run', bundledPath, ...process.argv.slice(2)];
  entryPoint = bundledPath;
} else if (existsSync(compiledPath)) {
  // Use TypeScript-compiled JavaScript with Node.js
  console.log('Using TypeScript-compiled version...');
  command = process.execPath; // Node.js executable
  args = [compiledPath, ...process.argv.slice(2)];
  entryPoint = compiledPath;
} else if (existsSync(srcIndexPath)) {
  // Fall back to Bun with TypeScript source (may have namespace issues)
  console.log('Using TypeScript source with Bun (may have namespace issues)...');
  command = process.platform === 'win32' ? 'bun.exe' : 'bun';
  args = ['run', srcIndexPath, ...process.argv.slice(2)];
  entryPoint = srcIndexPath;
} else {
  console.error('Could not find kuuzuki files.');
  console.error('Expected one of:');
  console.error('  1. Bundled:', bundledPath);
  console.error('  2. Compiled:', compiledPath);
  console.error('  3. Source:', srcIndexPath);
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