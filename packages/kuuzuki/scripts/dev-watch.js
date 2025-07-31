#!/usr/bin/env node

/**
 * Development script with hot reload that handles the Bun namespace bug
 */

const { spawn, fork } = require('child_process');
const { watch } = require('fs');
const { join } = require('path');
const { existsSync } = require('fs');

const projectRoot = join(__dirname, '..');
const srcDir = join(projectRoot, 'src');
const compiledPath = join(projectRoot, 'dist-tsc', 'index.js');

let serverProcess = null;
let isRebuilding = false;
let restartQueued = false;

console.log('🚀 Starting kuuzuki with hot reload...');
console.log('👀 Watching for changes in:', srcDir);

function buildProject() {
  return new Promise((resolve, reject) => {
    console.log('📦 Rebuilding...');
    isRebuilding = true;
    
    const buildProcess = spawn('npm', ['run', 'build:tsc'], {
      stdio: 'pipe',
      cwd: projectRoot
    });
    
    let output = '';
    buildProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    buildProcess.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    buildProcess.on('close', (code) => {
      isRebuilding = false;
      if (code === 0) {
        console.log('✅ Build complete');
        resolve();
      } else {
        console.error('❌ Build failed:');
        console.error(output);
        reject(new Error('Build failed'));
      }
    });
  });
}

function startServer() {
  if (serverProcess) {
    console.log('🔄 Restarting server...');
    serverProcess.kill();
  }
  
  console.log('▶️  Starting server...');
  serverProcess = fork(compiledPath, process.argv.slice(2), {
    cwd: projectRoot,
    env: process.env
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