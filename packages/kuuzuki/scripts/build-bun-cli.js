#!/usr/bin/env node

/**
 * Build script using Bun CLI to bundle TypeScript and handle namespace issues
 */

const { spawn } = require('child_process');
const { existsSync, mkdirSync } = require('fs');
const { join } = require('path');

const projectRoot = join(__dirname, '..');
const srcDir = join(projectRoot, 'src');
const distDir = join(projectRoot, 'dist');

console.log('🔨 Building with Bun CLI...');

// Ensure dist directory exists
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

const entryPoint = join(srcDir, 'index.ts');
const outputFile = join(distDir, 'index.js');

console.log(`Bundling: ${entryPoint} -> ${outputFile}`);

// Use Bun CLI to build
const bunCmd = process.platform === 'win32' ? 'bun.exe' : 'bun';
const args = [
  'build',
  entryPoint,
  '--outdir',
  distDir,
  '--target',
  'bun',
  '--format',
  'esm'
];

const child = spawn(bunCmd, args, {
  stdio: 'inherit',
  env: process.env,
  cwd: projectRoot
});

child.on('error', (err) => {
  console.error('❌ Failed to run bun build:', err.message);
  process.exit(1);
});

child.on('exit', (code) => {
  if (code === 0) {
    console.log('✅ Bun CLI build completed successfully');
    console.log(`📦 Output: ${outputFile}`);
  } else {
    console.error(`❌ Bun CLI build failed with exit code ${code}`);
    process.exit(code);
  }
});