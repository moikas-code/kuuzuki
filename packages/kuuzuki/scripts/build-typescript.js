#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Building TypeScript files...');

// Run TypeScript compiler
try {
  execSync('npx tsc', { stdio: 'inherit' });
  console.log('✅ TypeScript compilation successful');
} catch (error) {
  console.error('❌ TypeScript compilation failed');
  process.exit(1);
}

// Copy .txt files from src to dist
console.log('📋 Copying .txt files...');

function copyTxtFiles(srcDir, distDir) {
  const files = fs.readdirSync(srcDir, { withFileTypes: true });
  
  for (const file of files) {
    const srcPath = path.join(srcDir, file.name);
    const distPath = path.join(distDir, file.name);
    
    if (file.isDirectory()) {
      // Create directory if it doesn't exist
      if (!fs.existsSync(distPath)) {
        fs.mkdirSync(distPath, { recursive: true });
      }
      // Recursively copy txt files
      copyTxtFiles(srcPath, distPath);
    } else if (file.name.endsWith('.txt')) {
      // Copy txt file
      fs.copyFileSync(srcPath, distPath);
      console.log(`  Copied: ${file.name}`);
    }
  }
}

const srcDir = path.join(__dirname, '..', 'src');
const distDir = path.join(__dirname, '..', 'dist');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

copyTxtFiles(srcDir, distDir);

console.log('✅ Build complete!');