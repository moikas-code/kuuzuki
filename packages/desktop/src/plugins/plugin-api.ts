// Plugin API for renderer process

export class PluginAPI {
  private static instance: PluginAPI;
  private plugins: Map<string, any> = new Map();
  
  private constructor() {}
  
  static getInstance(): PluginAPI {
    if (!PluginAPI.instance) {
      PluginAPI.instance = new PluginAPI();
    }
    return PluginAPI.instance;
  }
  
  // Register a plugin panel
  registerPanel(pluginId: string, panelId: string, component: React.ComponentType) {
    const key = `${pluginId}:${panelId}`;
    this.plugins.set(key, { type: 'panel', component });
  }
  
  // Get plugin panel component
  getPanel(pluginId: string, panelId: string): React.ComponentType | undefined {
    const key = `${pluginId}:${panelId}`;
    const plugin = this.plugins.get(key);
    return plugin?.type === 'panel' ? plugin.component : undefined;
  }
  
  // Register a status bar item
  registerStatusBarItem(pluginId: string, itemId: string, config: any) {
    const key = `${pluginId}:statusbar:${itemId}`;
    this.plugins.set(key, { type: 'statusbar', config });
  }
  
  // Get all status bar items
  getStatusBarItems(): Array<{ pluginId: string; itemId: string; config: any }> {
    const items: Array<{ pluginId: string; itemId: string; config: any }> = [];
    
    this.plugins.forEach((value, key) => {
      if (value.type === 'statusbar') {
        const [pluginId, , itemId] = key.split(':');
        items.push({ pluginId, itemId, config: value.config });
      }
    });
    
    return items;
  }
  
  // Register a command
  registerCommand(pluginId: string, commandId: string, handler: () => void) {
    const key = `${pluginId}:command:${commandId}`;
    this.plugins.set(key, { type: 'command', handler });
  }
  
  // Execute a command
  executeCommand(pluginId: string, commandId: string) {
    const key = `${pluginId}:command:${commandId}`;
    const plugin = this.plugins.get(key);
    if (plugin?.type === 'command') {
      plugin.handler();
    }
  }
  
  // Get all registered commands
  getCommands(): Array<{ pluginId: string; commandId: string }> {
    const commands: Array<{ pluginId: string; commandId: string }> = [];
    
    this.plugins.forEach((value, key) => {
      if (value.type === 'command') {
        const [pluginId, , commandId] = key.split(':');
        commands.push({ pluginId, commandId });
      }
    });
    
    return commands;
  }
}

export const pluginAPI = PluginAPI.getInstance();