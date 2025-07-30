#!/usr/bin/env node

const { spawn } = require('child_process');
const { platform, arch } = require('os');
const { join } = require('path');

function getBinaryName() {
  const p = platform();
  const a = arch();
  
  let platformName;
  switch (p) {
    case 'darwin':
      platformName = a === 'arm64' ? 'macos-arm64' : 'macos';
      break;
    case 'win32':
      platformName = a === 'arm64' ? 'windows-arm64' : 'windows';
      break;
    default:
      platformName = a === 'arm64' ? 'linux-arm64' : 'linux';
  }
  
  return `kuuzuki-tui-${platformName}`;
}

const args = process.argv.slice(2);
const command = args[0];

// For v0.1.x, only TUI mode is supported via npm
if (!command || command === 'tui') {
  const binaryPath = join(__dirname, '..', 'binaries', getBinaryName());
  
  const child = spawn(binaryPath, args.slice(command === 'tui' ? 1 : 0), {
    stdio: 'inherit',
    env: {
      ...process.env,
      KUUZUKI_NPM_INSTALL: 'true'
    }
  });
  
  child.on('error', (err) => {
    if (err.code === 'ENOENT') {
      console.error(`Error: Could not find the kuuzuki binary for your platform.`);
      console.error(`Expected binary at: ${binaryPath}`);
      console.error(`\nPlease report this issue at: https://github.com/moikas-code/kuuzuki/issues`);
    } else {
      console.error('Failed to start kuuzuki:', err.message);
    }
    process.exit(1);
  });
  
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
} else {
  console.log(`Kuuzuki v0.1.x currently supports TUI mode only when installed via npm.`);
  console.log(`\nUsage: kuuzuki tui [options]`);
  console.log(`\nOther commands (${command}) will be available in v0.2.0.`);
  console.log(`\nFor full functionality now, clone the repository and run with Bun.`);
  process.exit(1);
}