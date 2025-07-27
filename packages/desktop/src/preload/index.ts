import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Server management
  startServer: () => ipcRenderer.invoke('start-server'),
  findServer: () => ipcRenderer.invoke('find-server'),
  checkServerHealth: (url: string) => ipcRenderer.invoke('check-server-health', url),
  
  // Unified Terminal
  initUnifiedTerminal: () => ipcRenderer.invoke('unified-terminal-init'),
  toggleSplitMode: () => ipcRenderer.invoke('unified-terminal-toggle-split'),
  writeToBash: (data: string) => ipcRenderer.send('unified-terminal-write-bash', data),
  writeToKuuzuki: (data: string) => ipcRenderer.send('unified-terminal-write-kuuzuki', data),
  resizeBash: (cols: number, rows: number) => ipcRenderer.invoke('unified-terminal-resize-bash', cols, rows),
  resizeKuuzuki: (cols: number, rows: number) => ipcRenderer.invoke('unified-terminal-resize-kuuzuki', cols, rows),
  restartBash: () => ipcRenderer.invoke('unified-terminal-restart-bash'),
  restartKuuzuki: () => ipcRenderer.invoke('unified-terminal-restart-kuuzuki'),
  destroyUnifiedTerminal: () => ipcRenderer.invoke('unified-terminal-destroy'),
  
  // Terminal manager (legacy - kept for compatibility)
  initTerminal: () => ipcRenderer.invoke('terminal-init'),
  setTerminalMode: (mode: 'terminal' | 'kuuzuki' | 'split') => ipcRenderer.invoke('terminal-set-mode', mode),
  setTerminalFocus: (pane: 'terminal' | 'kuuzuki') => ipcRenderer.invoke('terminal-set-focus', pane),
  writeTerminal: (data: string) => ipcRenderer.send('terminal-write', data),
  writeToTerminal: (target: 'terminal' | 'kuuzuki', data: string) => ipcRenderer.send('terminal-write-to', target, data),
  resizeTerminal: (target: 'terminal' | 'kuuzuki' | 'both', cols: number, rows: number) => ipcRenderer.invoke('terminal-resize', target, cols, rows),
  syncDirectory: () => ipcRenderer.invoke('terminal-sync-directory'),
  shareContext: () => ipcRenderer.invoke('terminal-share-context'),
  getHistory: () => ipcRenderer.invoke('terminal-get-history'),
  enableAutoSync: (interval?: number) => ipcRenderer.invoke('terminal-enable-autosync', interval),
  destroyTerminal: () => ipcRenderer.invoke('terminal-destroy'),
  restartTerminal: (target: 'terminal' | 'kuuzuki') => ipcRenderer.invoke('terminal-restart', target),
  
  // Legacy terminal PTY (for backward compatibility)
  spawnTerminal: () => ipcRenderer.invoke('terminal-spawn'),
  killTerminal: () => ipcRenderer.invoke('terminal-kill'),
  
  // Unified Terminal events
  onBashData: (callback: (data: string) => void) => {
    const listener = (_: IpcRendererEvent, data: string) => callback(data);
    ipcRenderer.on('bash-data', listener);
    return () => ipcRenderer.removeListener('bash-data', listener);
  },
  
  onBashExit: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('bash-exit', listener);
    return () => ipcRenderer.removeListener('bash-exit', listener);
  },
  
  onDirectoryChanged: (callback: (dir: string) => void) => {
    const listener = (_: IpcRendererEvent, dir: string) => callback(dir);
    ipcRenderer.on('directory-changed', listener);
    return () => ipcRenderer.removeListener('directory-changed', listener);
  },
  
  // Terminal events (legacy)
  onTerminalData: (callback: (data: string) => void) => {
    const listener = (_: IpcRendererEvent, data: string) => callback(data);
    ipcRenderer.on('terminal-data', listener);
    return () => ipcRenderer.removeListener('terminal-data', listener);
  },
  
  onKuuzukiData: (callback: (data: string) => void) => {
    const listener = (_: IpcRendererEvent, data: string) => callback(data);
    ipcRenderer.on('kuuzuki-data', listener);
    return () => ipcRenderer.removeListener('kuuzuki-data', listener);
  },
  
  onTerminalExit: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('terminal-exit', listener);
    return () => ipcRenderer.removeListener('terminal-exit', listener);
  },
  
  onKuuzukiExit: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('kuuzuki-exit', listener);
    return () => ipcRenderer.removeListener('kuuzuki-exit', listener);
  },
  
  onModeChanged: (callback: (mode: string) => void) => {
    const listener = (_: IpcRendererEvent, mode: string) => callback(mode);
    ipcRenderer.on('mode-changed', listener);
    return () => ipcRenderer.removeListener('mode-changed', listener);
  },
  
  onFocusChanged: (callback: (pane: string) => void) => {
    const listener = (_: IpcRendererEvent, pane: string) => callback(pane);
    ipcRenderer.on('focus-changed', listener);
    return () => ipcRenderer.removeListener('focus-changed', listener);
  },
  
  onDirectorySynced: (callback: (dir: string) => void) => {
    const listener = (_: IpcRendererEvent, dir: string) => callback(dir);
    ipcRenderer.on('directory-synced', listener);
    return () => ipcRenderer.removeListener('directory-synced', listener);
  },
  
  onHistoryUpdated: (callback: (history: string[]) => void) => {
    const listener = (_: IpcRendererEvent, history: string[]) => callback(history);
    ipcRenderer.on('history-updated', listener);
    return () => ipcRenderer.removeListener('history-updated', listener);
  },
  
  onContextShared: (callback: (context: any) => void) => {
    const listener = (_: IpcRendererEvent, context: any) => callback(context);
    ipcRenderer.on('context-shared', listener);
    return () => ipcRenderer.removeListener('context-shared', listener);
  },
  
  // Listen to server events
  onServerStarted: (callback: (url: string) => void) => {
    const subscription = (_event: any, url: string) => callback(url);
    ipcRenderer.on('server-started', subscription);
    
    return () => {
      ipcRenderer.removeListener('server-started', subscription);
    };
  },
  
  // Plugin APIs
  listPlugins: () => ipcRenderer.invoke('plugin-list'),
  activatePlugin: (pluginId: string) => ipcRenderer.invoke('plugin-activate', pluginId),
  deactivatePlugin: (pluginId: string) => ipcRenderer.invoke('plugin-deactivate', pluginId),
  
  // Plugin events
  onPluginMessage: (callback: (data: { message: string; type: string }) => void) => {
    const listener = (_: IpcRendererEvent, data: { message: string; type: string }) => callback(data);
    ipcRenderer.on('plugin-message', listener);
    return () => ipcRenderer.removeListener('plugin-message', listener);
  },
  
  onPluginInputRequest: (callback: (options: any, respond: (result?: string) => void) => void) => {
    const listener = (_: IpcRendererEvent, options: any, respond: (result?: string) => void) => callback(options, respond);
    ipcRenderer.on('plugin-input-request', listener);
    return () => ipcRenderer.removeListener('plugin-input-request', listener);
  }
});

// TypeScript declarations for the renderer
export interface ElectronAPI {
  // Server
  startServer: () => Promise<{ success: boolean; url?: string; error?: string }>;
  findServer: () => Promise<{ port: number; hostname: string; url: string; pid: number; startTime: string } | null>;
  checkServerHealth: (url: string) => Promise<boolean>;
  
  // Unified Terminal
  initUnifiedTerminal: () => Promise<{ success: boolean; error?: string }>;
  toggleSplitMode: () => Promise<{ success: boolean; mode: string }>;
  writeToBash: (data: string) => void;
  writeToKuuzuki: (data: string) => void;
  resizeBash: (cols: number, rows: number) => Promise<{ success: boolean }>;
  resizeKuuzuki: (cols: number, rows: number) => Promise<{ success: boolean }>;
  restartBash: () => Promise<{ success: boolean; error?: string }>;
  restartKuuzuki: () => Promise<{ success: boolean; error?: string }>;
  destroyUnifiedTerminal: () => Promise<{ success: boolean }>;
  
  // Terminal Manager (legacy)
  initTerminal: () => Promise<{ success: boolean; error?: string }>;
  setTerminalMode: (mode: 'terminal' | 'kuuzuki' | 'split') => Promise<{ success: boolean; mode: string }>;
  setTerminalFocus: (pane: 'terminal' | 'kuuzuki') => Promise<{ success: boolean; focusedPane: string }>;
  writeTerminal: (data: string) => void;
  writeToTerminal: (target: 'terminal' | 'kuuzuki', data: string) => void;
  resizeTerminal: (target: 'terminal' | 'kuuzuki' | 'both', cols: number, rows: number) => Promise<{ success: boolean }>;
  syncDirectory: () => Promise<{ success: boolean }>;
  shareContext: () => Promise<{ success: boolean; context: any }>;
  getHistory: () => Promise<{ success: boolean; history: string[] }>;
  enableAutoSync: (interval?: number) => Promise<{ success: boolean }>;
  destroyTerminal: () => Promise<{ success: boolean }>;
  restartTerminal: (target: 'terminal' | 'kuuzuki') => Promise<{ success: boolean }>;
  
  // Legacy
  spawnTerminal: () => Promise<{ success: boolean; error?: string }>;
  killTerminal: () => Promise<{ success: boolean }>;
  
  // Unified Terminal Events
  onBashData: (callback: (data: string) => void) => () => void;
  onBashExit: (callback: () => void) => () => void;
  onDirectoryChanged: (callback: (dir: string) => void) => () => void;
  
  // Terminal Events (legacy)
  onTerminalData: (callback: (data: string) => void) => () => void;
  onKuuzukiData: (callback: (data: string) => void) => () => void;
  onTerminalExit: (callback: () => void) => () => void;
  onKuuzukiExit: (callback: () => void) => () => void;
  onModeChanged: (callback: (mode: string) => void) => () => void;
  onFocusChanged: (callback: (pane: string) => void) => () => void;
  onDirectorySynced: (callback: (dir: string) => void) => () => void;
  onHistoryUpdated: (callback: (history: string[]) => void) => () => void;
  onContextShared: (callback: (context: any) => void) => () => void;
  onServerStarted: (callback: (url: string) => void) => () => void;
  
  // Plugins
  listPlugins: () => Promise<Array<{
    id: string;
    name: string;
    version: string;
    description: string;
    isActive: boolean;
  }>>;
  activatePlugin: (pluginId: string) => Promise<{ success: boolean; error?: string }>;
  deactivatePlugin: (pluginId: string) => Promise<{ success: boolean; error?: string }>;
  onPluginMessage: (callback: (data: { message: string; type: string }) => void) => () => void;
  onPluginInputRequest: (callback: (options: any, respond: (result?: string) => void) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}