#!/usr/bin/env bun

/**
 * Build script using Bun.build() to bundle TypeScript and handle namespace issues
 */

import { txtPlugin } from './txt-plugin.js';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

console.log('🔨 Building with Bun.build()...');

const scriptDir = dirname(import.meta.url.replace('file://', ''));
const projectRoot = join(scriptDir, '..');
const srcDir = join(projectRoot, 'src');
const distDir = join(projectRoot, 'dist');

// Ensure dist directory exists
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

try {
  console.log(`Bundling entry point: ${join(srcDir, 'index.ts')}`);
  console.log(`Output directory: ${distDir}`);
  
  const result = await Bun.build({
    entrypoints: [join(srcDir, 'index.ts')],
    outdir: distDir,
    target: 'bun', // Target Bun runtime specifically
    format: 'esm',
    splitting: false, // Create single bundle to avoid module resolution issues
    minify: false, // Keep readable for debugging
    sourcemap: 'external',
    // Skip plugins for now to test basic bundling
    // plugins: [txtPlugin],
    define: {
      // Define any build-time constants if needed
      'process.env.NODE_ENV': '"production"'
    }
  });

  if (result.success) {
    console.log('✅ Bun.build() completed successfully');
    console.log(`📦 Output: ${result.outputs.length} file(s) generated`);
    
    result.outputs.forEach((output, i) => {
      console.log(`  ${i + 1}. ${output.path} (${(output.size / 1024).toFixed(1)}KB)`);
    });

    if (result.logs.length > 0) {
      console.log('📋 Build logs:');
      result.logs.forEach(log => {
        console.log(`  ${log.level}: ${log.message}`);
      });
    }
  } else {
    console.error('❌ Bun.build() failed');
    console.error('Result:', JSON.stringify(result, null, 2));
    
    if (result.logs && result.logs.length > 0) {
      result.logs.forEach(log => {
        console.error(`  ${log.level}: ${log.message}`);
      });
    }
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Build failed with error:', error.message);
  if (error.stack) {
    console.error('Stack trace:', error.stack);
  }
  if (error.cause) {
    console.error('Cause:', error.cause);
  }
  console.error('Full error object:', JSON.stringify(error, null, 2));
  process.exit(1);
}