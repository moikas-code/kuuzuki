#!/usr/bin/env node
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { platform } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Fix catalog dependencies first
console.log('📦 Fixing catalog dependencies...');
try {
  execSync('node scripts/fix-catalog-deps.js', { 
    cwd: join(__dirname, '..'),
    stdio: 'inherit' 
  });
} catch (error) {
  console.error('❌ Failed to fix catalog dependencies:', error.message);
  process.exit(1);
}
const rootDir = join(__dirname, '..');
const tuiDir = join(rootDir, '..', 'tui');
const binariesDir = join(rootDir, 'binaries');

// Ensure binaries directory exists
if (!existsSync(binariesDir)) {
  mkdirSync(binariesDir, { recursive: true });
}

// Determine platform suffix
const getPlatformSuffix = () => {
  const p = platform();
  switch (p) {
    case 'darwin': return 'macos';
    case 'win32': return 'windows';
    default: return 'linux';
  }
};

try {
  // Build TUI for current platform
  console.log('🔨 Building TUI binary...');
  execSync('go build -o kuuzuki-tui ./cmd/kuuzuki', { 
    cwd: tuiDir,
    stdio: 'inherit' 
  });

  // Copy to binaries with platform suffix
  const binaryName = `kuuzuki-tui-${getPlatformSuffix()}`;
  const sourcePath = join(tuiDir, 'kuuzuki-tui');
  const destPath = join(binariesDir, binaryName);
  
  execSync(`cp "${sourcePath}" "${destPath}"`, { stdio: 'inherit' });

  console.log(`✅ Built and copied TUI binary as ${binaryName}`);
  
  // Clean up source binary
  execSync(`rm "${sourcePath}"`, { stdio: 'inherit' });
  
} catch (error) {
  console.error('❌ Failed to build TUI:', error.message);
  process.exit(1);
}