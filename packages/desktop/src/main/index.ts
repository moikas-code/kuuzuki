import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import { findKuuzukiServer } from './server-detector';

let mainWindow: BrowserWindow | null = null;
let kuuzukiProcess: ChildProcess | null = null;

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
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

async function startKuuzukiServer(): Promise<string> {
  // Check if server is already running
  const existingServer = await findKuuzukiServer();
  if (existingServer) {
    return existingServer.url;
  }

  // Find kuuzuki binary
  const possiblePaths = [
    path.join(__dirname, '../../bin/kuuzuki'),
    path.join(__dirname, '../../../opencode/kuuzuki-cli'),
    path.join(process.resourcesPath, 'bin/kuuzuki'),
    '/usr/local/bin/kuuzuki',
    '/usr/bin/kuuzuki'
  ];

  let kuuzukiBinary = '';
  for (const binPath of possiblePaths) {
    try {
      await fs.access(binPath, fs.constants.X_OK);
      kuuzukiBinary = binPath;
      break;
    } catch {
      // Continue searching
    }
  }

  if (!kuuzukiBinary) {
    throw new Error('Kuuzuki binary not found');
  }

  // Start kuuzuki in headless mode with dynamic port
  return new Promise((resolve, reject) => {
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

// IPC Handlers
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

ipcMain.handle('check-server-health', async (_, url: string) => {
  try {
    const response = await fetch(`${url}/health`);
    return response.ok;
  } catch {
    return false;
  }
});

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (kuuzukiProcess) {
    kuuzukiProcess.kill();
  }
});

process.on('SIGINT', () => {
  if (kuuzukiProcess) {
    kuuzukiProcess.kill();
  }
  app.quit();
});