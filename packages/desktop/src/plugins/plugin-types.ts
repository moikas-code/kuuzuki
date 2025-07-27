// Plugin System Type Definitions

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string; // Entry point file
  permissions: PluginPermission[];
  activationEvents?: string[];
  contributes?: PluginContributions;
  engines?: {
    kuuzuki: string; // Minimum kuuzuki version
  };
}

export type PluginPermission = 
  | 'terminal.read'
  | 'terminal.write'
  | 'terminal.execute'
  | 'filesystem.read'
  | 'filesystem.write'
  | 'network.request'
  | 'ui.sidebar'
  | 'ui.panel'
  | 'ui.statusbar'
  | 'ai.query'
  | 'ai.context';

export interface PluginContributions {
  commands?: PluginCommand[];
  keybindings?: PluginKeybinding[];
  panels?: PluginPanel[];
  statusBarItems?: PluginStatusBarItem[];
  themes?: PluginTheme[];
}

export interface PluginCommand {
  command: string;
  title: string;
  category?: string;
  icon?: string;
  enablement?: string; // When clause
}

export interface PluginKeybinding {
  command: string;
  key: string;
  when?: string;
}

export interface PluginPanel {
  id: string;
  title: string;
  icon?: string;
  position: 'left' | 'right' | 'bottom';
  priority?: number;
}

export interface PluginStatusBarItem {
  id: string;
  text: string;
  tooltip?: string;
  command?: string;
  alignment: 'left' | 'right';
  priority?: number;
}

export interface PluginTheme {
  id: string;
  label: string;
  uiTheme: 'dark' | 'light';
  path: string;
}

// Plugin API exposed to plugins
export interface PluginContext {
  extensionPath: string;
  globalState: PluginStorage;
  workspaceState: PluginStorage;
  subscriptions: Disposable[];
  
  // Terminal API
  terminal: {
    write(data: string): void;
    writeLine(line: string): void;
    onData(callback: (data: string) => void): Disposable;
    executeCommand(command: string): Promise<string>;
    getCurrentDirectory(): Promise<string>;
  };
  
  // AI API
  ai: {
    query(prompt: string, options?: AIQueryOptions): Promise<string>;
    getContext(): Promise<AIContext>;
    streamQuery(prompt: string, callback: (chunk: string) => void): Promise<void>;
  };
  
  // UI API
  ui: {
    showMessage(message: string, type?: 'info' | 'warning' | 'error'): void;
    showInputBox(options: InputBoxOptions): Promise<string | undefined>;
    createWebviewPanel(id: string, title: string, options?: WebviewOptions): WebviewPanel;
    createStatusBarItem(alignment: 'left' | 'right', priority?: number): StatusBarItem;
  };
  
  // Workspace API
  workspace: {
    onDidChangeWorkspaceFolders(callback: () => void): Disposable;
    getWorkspaceFolder(): string | undefined;
    findFiles(pattern: string): Promise<string[]>;
  };
}

export interface PluginStorage {
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: any): Promise<void>;
  keys(): readonly string[];
}

export interface Disposable {
  dispose(): void;
}

export interface AIQueryOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface AIContext {
  currentDirectory: string;
  recentCommands: string[];
  environment: Record<string, string>;
  activeFile?: string;
}

export interface InputBoxOptions {
  prompt?: string;
  placeHolder?: string;
  value?: string;
  validateInput?(value: string): string | undefined;
}

export interface WebviewPanel {
  webview: Webview;
  title: string;
  visible: boolean;
  onDidDispose(callback: () => void): Disposable;
  reveal(): void;
  dispose(): void;
}

export interface Webview {
  html: string;
  onDidReceiveMessage(callback: (message: any) => void): Disposable;
  postMessage(message: any): Promise<boolean>;
}

export interface WebviewOptions {
  enableScripts?: boolean;
  retainContextWhenHidden?: boolean;
  localResourceRoots?: string[];
}

export interface StatusBarItem {
  text: string;
  tooltip?: string;
  command?: string;
  show(): void;
  hide(): void;
  dispose(): void;
}

// Plugin lifecycle
export interface Plugin {
  activate(context: PluginContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}