import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  startServer: () => ipcRenderer.invoke('start-server'),
  findServer: () => ipcRenderer.invoke('find-server'),
  checkServerHealth: (url: string) => ipcRenderer.invoke('check-server-health', url),
  
  // Terminal-related APIs (to be implemented)
  createTerminal: (id: string) => ipcRenderer.invoke('create-terminal', id),
  writeToTerminal: (id: string, data: string) => ipcRenderer.invoke('write-terminal', id, data),
  resizeTerminal: (id: string, cols: number, rows: number) => ipcRenderer.invoke('resize-terminal', id, cols, rows),
  closeTerminal: (id: string) => ipcRenderer.invoke('close-terminal', id),
  
  // Listen to terminal output
  onTerminalData: (id: string, callback: (data: string) => void) => {
    const channel = `terminal-data-${id}`;
    const subscription = (_event: any, data: string) => callback(data);
    ipcRenderer.on(channel, subscription);
    
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
  
  // Listen to server events
  onServerStarted: (callback: (url: string) => void) => {
    const subscription = (_event: any, url: string) => callback(url);
    ipcRenderer.on('server-started', subscription);
    
    return () => {
      ipcRenderer.removeListener('server-started', subscription);
    };
  }
});

// TypeScript declarations for the renderer
export interface ElectronAPI {
  startServer: () => Promise<{ success: boolean; url?: string; error?: string }>;
  findServer: () => Promise<{ port: number; hostname: string; url: string; pid: number; startTime: string } | null>;
  checkServerHealth: (url: string) => Promise<boolean>;
  createTerminal: (id: string) => Promise<void>;
  writeToTerminal: (id: string, data: string) => Promise<void>;
  resizeTerminal: (id: string, cols: number, rows: number) => Promise<void>;
  closeTerminal: (id: string) => Promise<void>;
  onTerminalData: (id: string, callback: (data: string) => void) => () => void;
  onServerStarted: (callback: (url: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}