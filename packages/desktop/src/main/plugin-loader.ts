import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import { VM } from 'vm2';
import { 
  Plugin, 
  PluginManifest, 
  PluginContext, 
  PluginPermission,
  Disposable,
  PluginStorage
} from '../plugins/plugin-types';

export interface LoadedPlugin {
  manifest: PluginManifest;
  plugin: Plugin;
  context: PluginContext;
  sandbox: VM;
  isActive: boolean;
}

export class PluginLoader extends EventEmitter {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private pluginsPath: string;
  
  constructor(pluginsPath: string) {
    super();
    this.pluginsPath = pluginsPath;
  }
  
  async loadPlugins(): Promise<void> {
    try {
      // Ensure plugins directory exists
      await fs.mkdir(this.pluginsPath, { recursive: true });
      
      // Read all plugin directories
      const entries = await fs.readdir(this.pluginsPath, { withFileTypes: true });
      const pluginDirs = entries.filter(entry => entry.isDirectory());
      
      // Load each plugin
      for (const dir of pluginDirs) {
        try {
          await this.loadPlugin(path.join(this.pluginsPath, dir.name));
        } catch (error) {
          console.error(`Failed to load plugin ${dir.name}:`, error);
          this.emit('plugin-error', { plugin: dir.name, error });
        }
      }
    } catch (error) {
      console.error('Failed to load plugins:', error);
    }
  }
  
  async loadPlugin(pluginPath: string): Promise<void> {
    // Read manifest
    const manifestPath = path.join(pluginPath, 'package.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const manifest: PluginManifest = JSON.parse(manifestContent);
    
    // Validate manifest
    if (!this.validateManifest(manifest)) {
      throw new Error('Invalid plugin manifest');
    }
    
    // Check permissions
    if (!this.checkPermissions(manifest.permissions)) {
      throw new Error('Plugin requires unauthorized permissions');
    }
    
    // Create plugin context
    const context = this.createPluginContext(manifest, pluginPath);
    
    // Create sandbox
    const sandbox = new VM({
      timeout: 5000,
      sandbox: {
        require: this.createSafeRequire(manifest.permissions),
        console,
        setTimeout,
        setInterval,
        clearTimeout,
        clearInterval,
        process: {
          env: {},
          platform: process.platform,
          version: process.version
        }
      }
    });
    
    // Load plugin code
    const mainPath = path.join(pluginPath, manifest.main);
    const pluginCode = await fs.readFile(mainPath, 'utf-8');
    
    // Execute plugin in sandbox
    const pluginExports = sandbox.run(pluginCode);
    const plugin: Plugin = pluginExports.default || pluginExports;
    
    // Store loaded plugin
    this.plugins.set(manifest.id, {
      manifest,
      plugin,
      context,
      sandbox,
      isActive: false
    });
    
    this.emit('plugin-loaded', manifest);
  }
  
  async activatePlugin(pluginId: string): Promise<void> {
    const loadedPlugin = this.plugins.get(pluginId);
    if (!loadedPlugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }
    
    if (loadedPlugin.isActive) {
      return;
    }
    
    try {
      // Call activate function
      await loadedPlugin.plugin.activate(loadedPlugin.context);
      loadedPlugin.isActive = true;
      
      this.emit('plugin-activated', loadedPlugin.manifest);
    } catch (error) {
      console.error(`Failed to activate plugin ${pluginId}:`, error);
      this.emit('plugin-error', { plugin: pluginId, error });
      throw error;
    }
  }
  
  async deactivatePlugin(pluginId: string): Promise<void> {
    const loadedPlugin = this.plugins.get(pluginId);
    if (!loadedPlugin || !loadedPlugin.isActive) {
      return;
    }
    
    try {
      // Call deactivate function if exists
      if (loadedPlugin.plugin.deactivate) {
        await loadedPlugin.plugin.deactivate();
      }
      
      // Dispose all subscriptions
      for (const subscription of loadedPlugin.context.subscriptions) {
        subscription.dispose();
      }
      
      loadedPlugin.isActive = false;
      this.emit('plugin-deactivated', loadedPlugin.manifest);
    } catch (error) {
      console.error(`Failed to deactivate plugin ${pluginId}:`, error);
      this.emit('plugin-error', { plugin: pluginId, error });
    }
  }
  
  private validateManifest(manifest: PluginManifest): boolean {
    return !!(
      manifest.id &&
      manifest.name &&
      manifest.version &&
      manifest.main &&
      manifest.permissions
    );
  }
  
  private checkPermissions(permissions: PluginPermission[]): boolean {
    // Define allowed permissions
    const allowedPermissions: PluginPermission[] = [
      'terminal.read',
      'terminal.write',
      'filesystem.read',
      'ui.sidebar',
      'ui.panel',
      'ui.statusbar',
      'ai.query',
      'ai.context'
    ];
    
    return permissions.every(perm => allowedPermissions.includes(perm));
  }
  
  private createPluginContext(manifest: PluginManifest, extensionPath: string): PluginContext {
    const subscriptions: Disposable[] = [];
    
    const context: PluginContext = {
      extensionPath,
      globalState: this.createStorage(`global-${manifest.id}`),
      workspaceState: this.createStorage(`workspace-${manifest.id}`),
      subscriptions,
      
      terminal: {
        write: (data: string) => {
          if (!manifest.permissions.includes('terminal.write')) {
            throw new Error('Permission denied: terminal.write');
          }
          this.emit('terminal-write', data);
        },
        
        writeLine: (line: string) => {
          if (!manifest.permissions.includes('terminal.write')) {
            throw new Error('Permission denied: terminal.write');
          }
          this.emit('terminal-write', line + '\n');
        },
        
        onData: (callback: (data: string) => void) => {
          if (!manifest.permissions.includes('terminal.read')) {
            throw new Error('Permission denied: terminal.read');
          }
          const listener = (data: string) => callback(data);
          this.on('terminal-data', listener);
          return {
            dispose: () => this.off('terminal-data', listener)
          };
        },
        
        executeCommand: async (command: string) => {
          if (!manifest.permissions.includes('terminal.execute')) {
            throw new Error('Permission denied: terminal.execute');
          }
          return new Promise((resolve) => {
            this.emit('terminal-execute', command, resolve);
          });
        },
        
        getCurrentDirectory: async () => {
          return new Promise((resolve) => {
            this.emit('terminal-get-directory', resolve);
          });
        }
      },
      
      ai: {
        query: async (prompt: string, options?) => {
          if (!manifest.permissions.includes('ai.query')) {
            throw new Error('Permission denied: ai.query');
          }
          return new Promise((resolve) => {
            this.emit('ai-query', prompt, options, resolve);
          });
        },
        
        getContext: async () => {
          if (!manifest.permissions.includes('ai.context')) {
            throw new Error('Permission denied: ai.context');
          }
          return new Promise((resolve) => {
            this.emit('ai-get-context', resolve);
          });
        },
        
        streamQuery: async (prompt: string, callback: (chunk: string) => void) => {
          if (!manifest.permissions.includes('ai.query')) {
            throw new Error('Permission denied: ai.query');
          }
          return new Promise((resolve) => {
            this.emit('ai-stream-query', prompt, callback, resolve);
          });
        }
      },
      
      ui: {
        showMessage: (message: string, type = 'info') => {
          this.emit('ui-show-message', message, type);
        },
        
        showInputBox: async (options) => {
          return new Promise((resolve) => {
            this.emit('ui-show-input', options, resolve);
          });
        },
        
        createWebviewPanel: (_id: string, _title: string, _options?: any) => {
          if (!manifest.permissions.includes('ui.panel')) {
            throw new Error('Permission denied: ui.panel');
          }
          // Implementation would create actual webview
          return {} as any;
        },
        
        createStatusBarItem: (_alignment: any, _priority?: number) => {
          if (!manifest.permissions.includes('ui.statusbar')) {
            throw new Error('Permission denied: ui.statusbar');
          }
          // Implementation would create actual status bar item
          return {} as any;
        }
      },
      
      workspace: {
        onDidChangeWorkspaceFolders: (callback) => {
          const listener = () => callback();
          this.on('workspace-changed', listener);
          return {
            dispose: () => this.off('workspace-changed', listener)
          };
        },
        
        getWorkspaceFolder: () => {
          // Would return actual workspace folder
          return process.cwd();
        },
        
        findFiles: async (pattern) => {
          if (!manifest.permissions.includes('filesystem.read')) {
            throw new Error('Permission denied: filesystem.read');
          }
          return new Promise((resolve) => {
            this.emit('workspace-find-files', pattern, resolve);
          });
        }
      }
    };
    
    return context;
  }
  
  private createStorage(_key: string): PluginStorage {
    const data = new Map<string, any>();
    
    return {
      get: <T>(key: string, defaultValue?: T): T | undefined => {
        return data.has(key) ? data.get(key) : defaultValue;
      },
      
      update: async (key: string, value: any) => {
        data.set(key, value);
        this.emit('storage-update', key, value);
      },
      
      keys: () => Array.from(data.keys())
    };
  }
  
  private createSafeRequire(permissions: PluginPermission[]) {
    return (module: string) => {
      // Allow only specific modules based on permissions
      const allowedModules = ['path', 'url'];
      
      if (permissions.includes('filesystem.read')) {
        allowedModules.push('fs');
      }
      
      if (!allowedModules.includes(module)) {
        throw new Error(`Module '${module}' is not allowed`);
      }
      
      return require(module);
    };
  }
  
  getLoadedPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }
  
  getPlugin(pluginId: string): LoadedPlugin | undefined {
    return this.plugins.get(pluginId);
  }
}

export const pluginLoader = new PluginLoader(
  path.join(process.env.HOME || process.env.USERPROFILE || '', '.kuuzuki', 'plugins')
);