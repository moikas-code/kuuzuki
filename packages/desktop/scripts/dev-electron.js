#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Wait for Vite to be ready
const checkVite = () => {
  return new Promise((resolve) => {
    const http = require('http');
    const check = () => {
      http.get('http://localhost:5174', (res) => {
        if (res.statusCode === 200) {
          console.log('✅ Vite server is ready');
          resolve();
        } else {
          setTimeout(check, 500);
        }
      }).on('error', () => {
        console.log('⏳ Waiting for Vite...');
        setTimeout(check, 500);
      });
    };
    check();
  });
};

const startElectron = async () => {
  await checkVite();
  
  console.log('🚀 Starting Electron...');
  
  // Find electron binary
  const electronPaths = [
    path.join(__dirname, '../../../node_modules/.bin/electron'),
    path.join(__dirname, '../node_modules/.bin/electron'),
    '/usr/bin/electron'
  ];
  
  let electronBin = null;
  const fs = require('fs');
  
  for (const ePath of electronPaths) {
    if (fs.existsSync(ePath)) {
      electronBin = ePath;
      break;
    }
  }
  
  if (!electronBin) {
    console.error('❌ Electron binary not found');
    process.exit(1);
  }
  
  console.log(`📦 Using electron: ${electronBin}`);
  
  const electron = spawn(electronBin, ['.', '--enable-logging'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      ELECTRON_DISABLE_SANDBOX: '1'
    },
    stdio: 'inherit'
  });
  
  electron.on('close', (code) => {
    console.log(`Electron exited with code ${code}`);
    process.exit(code);
  });
};

startElectron().catch(console.error);