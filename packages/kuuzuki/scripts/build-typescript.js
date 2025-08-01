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

// Fix ESM imports by adding .js extensions
console.log('🔧 Fixing ESM imports...');

function fixImports(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const filePath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      fixImports(filePath);
    } else if (file.name.endsWith('.js')) {
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Fix relative imports that don't have .js extension
      content = content.replace(
        /from\s+["'](\.[^"']*?)["']/g,
        (match, importPath) => {
          if (!importPath.endsWith('.js') && !importPath.includes('?')) {
            // Check if it's a directory import (ends with directory name, not file)
            const fullPath = path.resolve(path.dirname(filePath), importPath);
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
              return match.replace(importPath, importPath + '/index.js');
            } else {
              return match.replace(importPath, importPath + '.js');
            }
          }
          return match;
        }
      );
      
      // Fix import statements
      content = content.replace(
        /import\s+.*?\s+from\s+["'](\.[^"']*?)["']/g,
        (match, importPath) => {
          if (!importPath.endsWith('.js') && !importPath.includes('?')) {
            // Check if it's a directory import (ends with directory name, not file)
            const fullPath = path.resolve(path.dirname(filePath), importPath);
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
              return match.replace(importPath, importPath + '/index.js');
            } else {
              return match.replace(importPath, importPath + '.js');
            }
          }
          return match;
        }
      );
      
      fs.writeFileSync(filePath, content);
    }
  }
}

fixImports(distDir);

console.log('✅ Build complete!');