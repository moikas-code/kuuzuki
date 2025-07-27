#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Kuuzuki Desktop in development mode...\n');

// Start Vite
console.log('📦 Starting Vite dev server...');
const vite = spawn('npm', ['run', 'dev:vite'], {
  cwd: path.join(__dirname, '..'),
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true
});

vite.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('➜')) {
    console.log('Vite:', output.trim());
  }
  
  // When Vite is ready, start Electron
  if (output.includes('ready in') || output.includes('Local:')) {
    startElectron();
  }
});

vite.stderr.on('data', (data) => {
  console.error('Vite error:', data.toString());
});

let electronStarted = false;

function startElectron() {
  if (electronStarted) return;
  electronStarted = true;
  
  console.log('\n⚡ Starting Electron...');
  
  // Use the dev-electron script we created
  const electron = spawn('node', ['scripts/dev-electron.js'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });
  
  electron.on('close', (code) => {
    console.log(`\nElectron exited with code ${code}`);
    // Kill Vite when Electron closes
    vite.kill();
    process.exit(code);
  });
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  vite.kill();
  process.exit(0);
});

// Give Vite a moment to start if it doesn't output anything
setTimeout(() => {
  if (!electronStarted) {
    console.log('⏰ Starting Electron after timeout...');
    startElectron();
  }
}, 5000);