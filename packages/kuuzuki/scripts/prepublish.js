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

// Build binaries for all platforms
const platforms = [
  { os: 'darwin', arch: 'amd64', suffix: 'macos' },
  { os: 'darwin', arch: 'arm64', suffix: 'macos-arm64' },
  { os: 'linux', arch: 'amd64', suffix: 'linux' },
  { os: 'linux', arch: 'arm64', suffix: 'linux-arm64' },
  { os: 'windows', arch: 'amd64', suffix: 'windows' },
  { os: 'windows', arch: 'arm64', suffix: 'windows-arm64' }
];

try {
  console.log('🔨 Building TUI binaries for all platforms...');
  
  for (const platform of platforms) {
    console.log(`Building for ${platform.os}/${platform.arch}...`);
    
    // Set environment variables for cross-compilation
    const env = {
      ...process.env,
      GOOS: platform.os,
      GOARCH: platform.arch,
      CGO_ENABLED: '0'
    };
    
    // Build binary
    execSync('go build -o kuuzuki-tui ./cmd/kuuzuki', { 
      cwd: tuiDir,
      stdio: 'inherit',
      env
    });

    // Copy to binaries with platform suffix
    const binaryName = `kuuzuki-tui-${platform.suffix}`;
    const sourcePath = join(tuiDir, 'kuuzuki-tui');
    const destPath = join(binariesDir, binaryName);
    
    execSync(`cp "${sourcePath}" "${destPath}"`, { stdio: 'inherit' });
    
    // Clean up source binary
    execSync(`rm "${sourcePath}"`, { stdio: 'inherit' });
    
    console.log(`✅ Built ${binaryName}`);
  }
  
  console.log('✅ All platform binaries built successfully');
  
} catch (error) {
  console.error('❌ Failed to build TUI binaries:', error.message);
  process.exit(1);
}