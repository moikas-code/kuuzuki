#!/usr/bin/env node

import { chmod, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { platform, arch } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function makeBinariesExecutable() {
  const binariesDir = join(__dirname, '..', 'binaries');
  
  if (!binariesDir) {
    console.log('No binaries directory found, skipping...');
    return;
  }
  
  const p = platform();
  const a = arch();
  
  let platformName;
  switch (p) {
    case 'darwin':
      platformName = 'macos';
      break;
    case 'win32':
      platformName = 'windows';
      break;
    default:
      platformName = 'linux';
  }
  
  // Handle ARM64 vs x64
  const archSuffix = a === 'arm64' ? '-arm64' : '';
  const binaryName = `kuuzuki-tui-${platformName}${archSuffix}`;
  const binaryPath = join(binariesDir, binaryName);
  
  try {
    // Check if binary exists
    await access(binaryPath);
    
    // Make executable (755 permissions)
    await chmod(binaryPath, 0o755);
    console.log(`✅ Made ${binaryName} executable`);
  } catch (error) {
    console.log(`⚠️  Binary ${binaryName} not found, this is normal for cross-platform packages`);
  }
}

// Run the postinstall script
makeBinariesExecutable().catch(console.error); 