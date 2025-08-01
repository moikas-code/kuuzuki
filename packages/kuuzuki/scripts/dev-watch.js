#!/usr/bin/env node

/**
 * Development script with hot reload that handles the Bun namespace bug
 */

const { spawn } = require('child_process');
const { watch } = require('fs');
const { join } = require('path');


const projectRoot = join(__dirname, '..');
const srcDir = join(projectRoot, 'src');
const sourcePath = join(projectRoot, 'src', 'index.ts');

let serverProcess = null;
let isRebuilding = false;
let restartQueued = false;

console.log('🚀 Starting kuuzuki with hot reload...');
console.log('👀 Watching for changes in:', srcDir);

function buildProject() {
  return new Promise((resolve) => {
    console.log('📦 No build needed for Bun...');
    isRebuilding = true;
    setTimeout(() => {
      isRebuilding = false;
      console.log('✅ Ready');
      resolve();
    }, 100);
  });
}

function startServer() {
  if (serverProcess) {
    console.log('🔄 Restarting server...');
    serverProcess.kill();
  }
  
  console.log('▶️  Starting server...');
  serverProcess = spawn('bun', [sourcePath, ...process.argv.slice(2)], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit'
  });
  
  serverProcess.on('error', (err) => {
    console.error('❌ Server error:', err.message);
  });
  
  serverProcess.on('exit', (code, signal) => {
    if (signal !== 'SIGTERM' && code !== 0) {
      console.error(`❌ Server exited with code ${code}`);
    }
    serverProcess = null;
  });
}

async function rebuild() {
  if (isRebuilding) {
    restartQueued = true;
    return;
  }
  
  try {
    await buildProject();
    startServer();
    
    if (restartQueued) {
      restartQueued = false;
      setTimeout(rebuild, 100); // Debounce rapid changes
    }
  } catch (error) {
    console.error('Build failed, keeping previous version running');
  }
}

// Initial build and start
rebuild().catch((error) => {
  console.error('Initial build failed:', error.message);
  process.exit(1);
});

// Watch for file changes
const watcher = watch(srcDir, { recursive: true }, (eventType, filename) => {
  if (filename && (filename.endsWith('.ts') || filename.endsWith('.tsx') || filename.endsWith('.txt'))) {
    console.log(`📝 File changed: ${filename}`);
    rebuild();
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  watcher.close();
  if (serverProcess) {
    serverProcess.kill();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  watcher.close();
  if (serverProcess) {
    serverProcess.kill();
  }
  process.exit(0);
});