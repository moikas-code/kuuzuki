#!/usr/bin/env node

/**
 * Smart development script that handles the Bun namespace bug
 */

const { spawn, execSync } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');

const projectRoot = join(__dirname, '..');
const compiledPath = join(projectRoot, 'dist-tsc', 'index.js');
const srcPath = join(projectRoot, 'src', 'index.ts');

console.log('🚀 Starting kuuzuki in development mode...');

// Check if compiled version exists and is newer than source
let needsBuild = true;
if (existsSync(compiledPath)) {
  try {
    const compiledStat = require('fs').statSync(compiledPath);
    const srcStat = require('fs').statSync(srcPath);
    
    if (compiledStat.mtime > srcStat.mtime) {
      needsBuild = false;
      console.log('✅ Using existing compiled version (newer than source)');
    } else {
      console.log('🔄 Source is newer, rebuilding...');
    }
  } catch (error) {
    console.log('🔄 Building compiled version...');
  }
} else {
  console.log('🔄 No compiled version found, building...');
}

// Build if needed
if (needsBuild) {
  try {
    console.log('📦 Compiling TypeScript...');
    execSync('npm run build:tsc', { 
      stdio: 'inherit',
      cwd: projectRoot 
    });
    console.log('✅ Compilation complete');
  } catch (error) {
    console.error('❌ Build failed');
    process.exit(1);
  }
}

// Run the compiled version
console.log('▶️  Starting server...');
const child = spawn('node', [compiledPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
  cwd: projectRoot
});

child.on('error', (err) => {
  console.error('❌ Failed to start server:', err.message);
  process.exit(1);
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Server exited with code ${code}`);
  }
  process.exit(code);
});