#!/usr/bin/env node

/**
 * Development-specific TypeScript compilation with relaxed error checking
 */

const { execSync } = require('child_process');
const { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } = require('fs');
const { join, relative, dirname } = require('path');

const projectRoot = join(__dirname, '..');
const srcDir = join(projectRoot, 'src');
const distDir = join(projectRoot, 'dist-dev');

console.log('🔨 Building TypeScript files for development (relaxed errors)...');

// Ensure dist directory exists
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

try {
  // Compile TypeScript with relaxed config, ignoring errors
  console.log('⚠️  Compiling with errors ignored for development...');
  try {
    execSync('npx tsc --project tsconfig.dev.json', {
      stdio: 'pipe',
      cwd: projectRoot
    });
  } catch (error) {
    // Ignore TypeScript errors in development mode
    console.log('⚠️  TypeScript errors present but continuing build...');
  }

  // Copy .txt files from src to dist-dev
  function copyTxtFiles(srcPath, distPath) {
    const items = readdirSync(srcPath);
    
    for (const item of items) {
      const srcItemPath = join(srcPath, item);
      const distItemPath = join(distPath, item);
      const stat = statSync(srcItemPath);
      
      if (stat.isDirectory()) {
        if (!existsSync(distItemPath)) {
          mkdirSync(distItemPath, { recursive: true });
        }
        copyTxtFiles(srcItemPath, distItemPath);
      } else if (item.endsWith('.txt')) {
        const distDirPath = dirname(distItemPath);
        if (!existsSync(distDirPath)) {
          mkdirSync(distDirPath, { recursive: true });
        }
        copyFileSync(srcItemPath, distItemPath);
        console.log(`📄 Copied: ${relative(projectRoot, srcItemPath)} → ${relative(projectRoot, distItemPath)}`);
      }
    }
  }

  copyTxtFiles(srcDir, distDir);
  
  // Fix CommonJS top-level await issue
  const indexPath = join(distDir, 'index.js');
  if (existsSync(indexPath)) {
    const fs = require('fs');
    let content = fs.readFileSync(indexPath, 'utf8');
    
    // Find the top-level await calls and wrap the entire module in an async IIFE
    if (content.includes('await ') && !content.includes('(async () => {')) {
      // Find the first await outside a function
      const lines = content.split('\n');
      let firstAwaitLine = -1;
      let inFunction = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('function') || line.includes('=>')) inFunction++;
        if (line.includes('}') && inFunction > 0) inFunction--;
        if (line.includes('await ') && inFunction === 0) {
          firstAwaitLine = i;
          break;
        }
      }
      
      if (firstAwaitLine !== -1) {
        // Wrap everything from first await onwards in an async IIFE
        const beforeAwait = lines.slice(0, firstAwaitLine).join('\n');
        const afterAwait = lines.slice(firstAwaitLine).join('\n');
        
        content = beforeAwait + '\n\n(async () => {\n' + afterAwait + '\n})().catch(console.error);\n';
        fs.writeFileSync(indexPath, content);
        console.log('🔧 Fixed CommonJS top-level await compatibility');
      }
    }
  }
  
  console.log('✅ Development build complete');
  console.log(`📦 Output: ${relative(process.cwd(), distDir)}`);
  
} catch (error) {
  console.error('❌ Development build failed:', error.message);
  process.exit(1);
}