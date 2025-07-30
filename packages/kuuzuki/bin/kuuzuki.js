#!/usr/bin/env node

const { spawn } = require('child_process');
const { platform, arch } = require('os');
const { join } = require('path');
const { createServer } = require('http');
const net = require('net');

function getBinaryName() {
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
  
  return `kuuzuki-tui-${platformName}`;
}

// Find an available port
function findAvailablePort(startPort = 12275) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      // Port is in use, try next one
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

// Create a minimal server that responds to /config
function createMinimalServer(port) {
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    
    if (req.url === '/config') {
      res.writeHead(200);
      res.end(JSON.stringify({
        providers: {
          'demo': {
            id: 'demo',
            name: 'Demo Provider',
            models: [{
              id: 'demo',
              name: 'Demo Model (No API Key Required)',
              contextLength: 4096
            }]
          }
        },
        defaultProvider: 'demo',
        defaultModel: 'demo'
      }));
    } else if (req.url === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', mode: 'standalone' }));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });
  
  server.listen(port, '127.0.0.1');
  return server;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // For v0.1.x, only TUI mode is supported via npm
  if (!command || command === 'tui') {
    console.log('Starting Kuuzuki in standalone mode...');
    
    // Find available port and start minimal server
    const port = await findAvailablePort();
    const server = createMinimalServer(port);
    console.log(`Local server started on port ${port}`);
    
    const binaryPath = join(__dirname, '..', 'binaries', getBinaryName());
    
    const child = spawn(binaryPath, args.slice(command === 'tui' ? 1 : 0), {
      stdio: 'inherit',
      env: {
        ...process.env,
        KUUZUKI_NPM_INSTALL: 'true',
        KUUZUKI_SERVER: `http://127.0.0.1:${port}`,
        KUUZUKI_APP_INFO: JSON.stringify({
          name: 'kuuzuki',
          version: require('../package.json').version,
          npmMode: true,
          standalone: true
        }),
        KUUZUKI_MODES: JSON.stringify([{
          id: 'default',
          name: 'Default',
          description: 'Standalone mode - Limited functionality without API keys'
        }])
      }
    });
    
    child.on('error', (err) => {
      server.close();
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
      server.close();
      process.exit(code || 0);
    });
    
    // Handle cleanup
    process.on('SIGINT', () => {
      server.close();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      server.close();
      process.exit(0);
    });
    
  } else {
    console.log(`Kuuzuki v0.1.x currently supports TUI mode only when installed via npm.`);
    console.log(`\nUsage: kuuzuki tui [options]`);
    console.log(`\nOther commands (${command}) will be available in v0.2.0.`);
    console.log(`\nFor full functionality now, clone the repository and run with Bun.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});