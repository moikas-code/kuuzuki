#!/usr/bin/env node

/**
 * Build script using Bun --compile to create standalone executable
 */

const { spawn } = require('child_process');
const { existsSync, mkdirSync } = require('fs');
const { join } = require('path');

const projectRoot = join(__dirname, '..');
const srcDir = join(projectRoot, 'src');
const binDir = join(projectRoot, 'bin');

console.log('🔨 Building standalone executable with Bun...');

// Ensure bin directory exists
if (!existsSync(binDir)) {
  mkdirSync(binDir, { recursive: true });
}

const entryPoint = join(srcDir, 'index.ts');
const outputFile = join(binDir, 'kuuzuki-compiled');

console.log(`Compiling: ${entryPoint} -> ${outputFile}`);

// Use Bun CLI to compile standalone executable
const bunCmd = process.platform === 'win32' ? 'bun.exe' : 'bun';
const args = [
  'build',
  '--compile',
  entryPoint,
  '--outfile',
  outputFile,
  '--target',
  'bun'
];

const child = spawn(bunCmd, args, {
  stdio: 'inherit',
  env: process.env,
  cwd: projectRoot
});

child.on('error', (err) => {
  console.error('❌ Failed to run bun build --compile:', err.message);
  process.exit(1);
});

child.on('exit', (code) => {
  if (code === 0) {
    console.log('✅ Standalone executable build completed successfully');
    console.log(`📦 Output: ${outputFile}`);
    
    // Make executable
    const { chmodSync } = require('fs');
    try {
      chmodSync(outputFile, 0o755);
      console.log('✅ Made executable');
    } catch (err) {
      console.warn('⚠️ Could not make file executable:', err.message);
    }
  } else {
    console.error(`❌ Standalone executable build failed with exit code ${code}`);
    process.exit(code);
  }
});