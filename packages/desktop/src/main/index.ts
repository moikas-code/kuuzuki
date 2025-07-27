import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import { findKuuzukiServer } from './server-detector';
import { unifiedTerminal } from './unified-terminal';
import { pluginLoader } from './plugin-loader';

let mainWindow: BrowserWindow | null = null;
let kuuzukiProcess: ChildProcess | null = null;
let isQuitting = false;
let terminalListenersSetup = false;

const isDevelopment = process.env.NODE_ENV !== 'production';

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js')
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1e1e1e'
  });

  if (isDevelopment) {
    mainWindow.loadURL('http://localhost:5174');
    // mainWindow.webContents.openDevTools(); // Uncomment to show dev tools
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      cleanupAndQuit();
    }
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

async function startKuuzukiServer() {
  // Check if server is already running
  const existingServer = await findKuuzukiServer();
  if (existingServer) {
    return existingServer.url;
  }

  // Find kuuzuki binary
  const possiblePaths = [
    path.join(__dirname, '../../assets/bin/kuuzuki'),
    path.join(__dirname, '../../../opencode/kuuzuki-cli'),
    path.join((process as any).resourcesPath, 'bin/kuuzuki'),
    '/usr/local/bin/kuuzuki',
    '/usr/bin/kuuzuki'
  ];

  let kuuzukiBinary = '';
  for (const binPath of possiblePaths) {
    console.log("Checking binary:", binPath);
    try {
      await fs.access(binPath, fs.constants.X_OK);
      kuuzukiBinary = binPath;
      break;
    } catch {
      // Continue searching
    }
  }

  console.log("Found kuuzuki binary:", kuuzukiBinary);
  if (!kuuzukiBinary) {
    throw new Error('Kuuzuki binary not found');
  }

  // Start kuuzuki in headless mode with dynamic port
  return new Promise<string>((resolve, reject) => {
    kuuzukiProcess = spawn(kuuzukiBinary, ['serve', '--port', '0'], {
      env: {
        ...process.env,
        KUUZUKI_HEADLESS: '1'
      }
    });

    let serverUrl = '';
    const timeout = setTimeout(() => {
      if (kuuzukiProcess) {
        kuuzukiProcess.kill();
      }
      reject(new Error('Server startup timeout'));
    }, 30000);

    kuuzukiProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log('Kuuzuki:', output);
      
      // Look for server URL in output
      const urlMatch = output.match(/Server running at (http:\/\/\S+)/);
      if (urlMatch) {
        serverUrl = urlMatch[1];
        clearTimeout(timeout);
        resolve(serverUrl);
      }
    });

    kuuzukiProcess.stderr?.on('data', (data) => {
      console.error('Kuuzuki error:', data.toString());
    });

    kuuzukiProcess.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    kuuzukiProcess.on('exit', (code) => {
      clearTimeout(timeout);
      if (!serverUrl) {
        reject(new Error(`Kuuzuki exited with code ${code}`));
      }
    });
  });
}

// Find kuuzuki binary helper
async function findKuuzukiBinary(): Promise<string> {
    const possiblePaths = [
        path.join(__dirname, '../../assets/bin/kuuzuki'),
        path.join(__dirname, '../../../opencode/kuuzuki-cli'),
        path.join((process as any).resourcesPath, 'bin/kuuzuki'),
        '/usr/local/bin/kuuzuki',
        '/usr/bin/kuuzuki'
    ];
    
    for (const binPath of possiblePaths) {
        console.log("Checking binary:", binPath);
        try {
            await fs.access(binPath, fs.constants.X_OK);
            return binPath;
        } catch {
            // Continue searching
        }
    }
    
    throw new Error('Kuuzuki binary not found');
}

// Server-related IPC Handlers
ipcMain.handle('start-server', async () => {
  try {
    const url = await startKuuzukiServer();
    return { success: true, url };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('find-server', async () => {
  const server = await findKuuzukiServer();
  return server;
});

ipcMain.handle('check-server-health', async (_event, url) => {
  try {
    const response = await fetch(`${url}/health`);
    return response.ok;
  } catch {
    return false;
  }
});

// Unified terminal IPC handlers
ipcMain.handle('unified-terminal-init', async () => {
    try {
        const kuuzukiBinary = await findKuuzukiBinary();
        await unifiedTerminal.initialize(kuuzukiBinary);
        
        // Set up event forwarding to renderer only once
        if (!terminalListenersSetup) {
            terminalListenersSetup = true;
            
            unifiedTerminal.on('bash-data', (data) => {
                mainWindow?.webContents.send('bash-data', data);
            });
            
            unifiedTerminal.on('kuuzuki-data', (data) => {
                mainWindow?.webContents.send('kuuzuki-data', data);
            });
            
            unifiedTerminal.on('bash-exit', () => {
                mainWindow?.webContents.send('bash-exit');
            });
            
            unifiedTerminal.on('kuuzuki-exit', () => {
                mainWindow?.webContents.send('kuuzuki-exit');
            });
            
            unifiedTerminal.on('mode-changed', (mode) => {
                mainWindow?.webContents.send('mode-changed', mode);
            });
            
            unifiedTerminal.on('directory-changed', (dir) => {
                mainWindow?.webContents.send('directory-changed', dir);
            });
        }
        
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
});

ipcMain.handle('unified-terminal-toggle-split', async () => {
    const mode = unifiedTerminal.toggleSplitMode();
    return { success: true, mode };
});

ipcMain.on('unified-terminal-write-bash', (_event, data: string) => {
    unifiedTerminal.writeToBash(data);
});

ipcMain.on('unified-terminal-write-kuuzuki', (_event, data: string) => {
    unifiedTerminal.writeToKuuzuki(data);
});

ipcMain.handle('unified-terminal-resize-bash', async (_event, cols: number, rows: number) => {
    unifiedTerminal.resizeBash(cols, rows);
    return { success: true };
});

ipcMain.handle('unified-terminal-resize-kuuzuki', async (_event, cols: number, rows: number) => {
    unifiedTerminal.resizeKuuzuki(cols, rows);
    return { success: true };
});

ipcMain.handle('unified-terminal-restart-bash', async () => {
    try {
        await unifiedTerminal.restartBash();
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
});

ipcMain.handle('unified-terminal-restart-kuuzuki', async () => {
    try {
        await unifiedTerminal.restartKuuzuki();
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
});

ipcMain.handle('unified-terminal-destroy', async () => {
    unifiedTerminal.destroy();
    return { success: true };
});

// Initialize plugin system
async function initializePlugins() {
    // Load plugins
    await pluginLoader.loadPlugins();
    
    // Set up plugin event handlers
    pluginLoader.on('terminal-write', (data: string) => {
        unifiedTerminal.writeToBash(data);
    });
    
    pluginLoader.on('terminal-execute', async (command: string, callback: (result: string) => void) => {
        // Execute command and return result
        unifiedTerminal.writeToBash(command + '\r');
        // In real implementation, would capture output
        callback('Command executed');
    });
    
    pluginLoader.on('terminal-get-directory', async (callback: (dir: string) => void) => {
        const dir = unifiedTerminal.getCurrentDirectory();
        callback(dir);
    });
    
    pluginLoader.on('ui-show-message', (message: string, type: string) => {
        mainWindow?.webContents.send('plugin-message', { message, type });
    });
    
    pluginLoader.on('ui-show-input', (options: any, callback: (result?: string) => void) => {
        mainWindow?.webContents.send('plugin-input-request', options, callback);
    });
    
    // Activate startup plugins
    const plugins = pluginLoader.getLoadedPlugins();
    for (const plugin of plugins) {
        if (plugin.manifest.activationEvents?.includes('onStartup')) {
            await pluginLoader.activatePlugin(plugin.manifest.id);
        }
    }
}

// Plugin IPC handlers
ipcMain.handle('plugin-list', async () => {
    const plugins = pluginLoader.getLoadedPlugins();
    return plugins.map(p => ({
        id: p.manifest.id,
        name: p.manifest.name,
        version: p.manifest.version,
        description: p.manifest.description,
        isActive: p.isActive
    }));
});

ipcMain.handle('plugin-activate', async (_event, pluginId: string) => {
    try {
        await pluginLoader.activatePlugin(pluginId);
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
});

ipcMain.handle('plugin-deactivate', async (_event, pluginId: string) => {
    try {
        await pluginLoader.deactivatePlugin(pluginId);
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
});

// App event handlers
app.whenReady().then(async () => {
    await createWindow();
    await initializePlugins();
});

// Cleanup function to ensure all resources are properly released
async function cleanupAndQuit() {
  if (isQuitting) return;
  isQuitting = true;
  
  console.log('Cleaning up before quit...');
  
  // Close all windows
  BrowserWindow.getAllWindows().forEach(window => {
    window.removeAllListeners();
    window.close();
  });
  
  // Kill kuuzuki process
  if (kuuzukiProcess) {
    try {
      kuuzukiProcess.kill('SIGTERM');
      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 500));
      if (kuuzukiProcess.exitCode === null) {
        kuuzukiProcess.kill('SIGKILL');
      }
    } catch (error) {
      console.error('Error killing kuuzuki process:', error);
    }
    kuuzukiProcess = null;
  }
  
  // Destroy unified terminal
  unifiedTerminal.destroy();
  terminalListenersSetup = false;
  
  // Remove all IPC handlers
  ipcMain.removeAllListeners();
  
  // Quit the app
  app.quit();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cleanupAndQuit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', (event) => {
  if (!isQuitting) {
    event.preventDefault();
    cleanupAndQuit();
  }
});

process.on('SIGINT', () => {
  cleanupAndQuit();
});

process.on('SIGTERM', () => {
  cleanupAndQuit();
});