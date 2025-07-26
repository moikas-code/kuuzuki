import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  startServer: () => ipcRenderer.invoke('start-server'),
  findServer: () => ipcRenderer.invoke('find-server'),
  checkServerHealth: (url: string) => ipcRenderer.invoke('check-server-health', url),
  
  // Terminal PTY APIs
  spawnTerminal: () => ipcRenderer.invoke('terminal-spawn'),
  writeTerminal: (data: string) => ipcRenderer.send('terminal-write', data),
  resizeTerminal: (cols: number, rows: number) => ipcRenderer.invoke('terminal-resize', cols, rows),
  killTerminal: () => ipcRenderer.invoke('terminal-kill'),
  
  // Listen to terminal output
  onTerminalData: (callback: (data: string) => void) => {
    const listener = (_: IpcRendererEvent, data: string) => callback(data);
    ipcRenderer.on('terminal-data', listener);
    return () => ipcRenderer.removeListener('terminal-data', listener);
  },
  
  // Listen to terminal exit
  onTerminalExit: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('terminal-exit', listener);
    return () => ipcRenderer.removeListener('terminal-exit', listener);
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
  spawnTerminal: () => Promise<{ success: boolean; error?: string }>;
  writeTerminal: (data: string) => void;
  resizeTerminal: (cols: number, rows: number) => Promise<{ success: boolean }>;
  killTerminal: () => Promise<{ success: boolean }>;
  onTerminalData: (callback: (data: string) => void) => () => void;
  onTerminalExit: (callback: () => void) => () => void;
  onServerStarted: (callback: (url: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}