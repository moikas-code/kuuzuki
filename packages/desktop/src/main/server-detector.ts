import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface ServerInfo {
  port: number;
  hostname: string;
  url: string;
  pid: number;
  startTime: string;
}

async function getStateDir(): Promise<string> {
  const xdgStateHome = process.env.XDG_STATE_HOME;
  if (xdgStateHome) {
    return path.join(xdgStateHome, 'kuuzuki');
  }
  return path.join(os.homedir(), '.local', 'state', 'kuuzuki');
}

export async function readServerInfo(): Promise<ServerInfo | null> {
  try {
    const stateDir = await getStateDir();
    const serverInfoPath = path.join(stateDir, 'server.json');
    
    const content = await fs.readFile(serverInfoPath, 'utf-8');
    const info: ServerInfo = JSON.parse(content);
    
    // Check if process is still running
    try {
      process.kill(info.pid, 0);
      return info;
    } catch {
      // Process not running
      return null;
    }
  } catch {
    return null;
  }
}

async function checkServerHealth(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(`${url}/health`, {
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

export async function findKuuzukiServer(): Promise<ServerInfo | null> {
  // First try to read from server info file
  const savedInfo = await readServerInfo();
  if (savedInfo) {
    // Verify the server is actually accessible
    const isHealthy = await checkServerHealth(savedInfo.url);
    if (isHealthy) {
      return savedInfo;
    }
  }
  
  // Try common ports
  const commonPorts = [3456, 3457, 3458, 3459, 3460];
  for (const port of commonPorts) {
    const url = `http://localhost:${port}`;
    const isHealthy = await checkServerHealth(url);
    if (isHealthy) {
      return {
        port,
        hostname: 'localhost',
        url,
        pid: 0,
        startTime: new Date().toISOString()
      };
    }
  }
  
  return null;
}