#!/usr/bin/env node

const { chmod, access } = require('fs').promises;
const { join } = require('path');
const { platform, arch } = require('os');

async function makeBinariesExecutable() {
  const binariesDir = join(__dirname, '..', 'binaries');
  
  const p = platform();
  const a = arch();
  
  let platformName;
  switch (p) {
    case 'darwin':
      platformName = a === 'arm64' ? 'macos-arm64' : 'macos';
      break;
    case 'win32':
      platformName = a === 'arm64' ? 'windows-arm64.exe' : 'windows.exe';
      break;
    default:
      platformName = a === 'arm64' ? 'linux-arm64' : 'linux';
  }
  
  const binaryName = `kuuzuki-tui-${platformName}`;
  const binaryPath = join(binariesDir, binaryName);
  
  try {
    // Check if binary exists
    await access(binaryPath);
    
    // Make executable (755 permissions) - skip on Windows as it doesn't use chmod
    if (process.platform !== 'win32') {
      await chmod(binaryPath, 0o755);
    }
    console.log(`✓ Kuuzuki binary ready for ${platform()}`);
  } catch (error) {
    console.warn(`⚠ Binary not found: ${binaryPath}`);
  }
}

// Run the postinstall script
makeBinariesExecutable().catch(console.error);