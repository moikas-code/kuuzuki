// File Explorer Plugin

const path = require('path');

class FileExplorerPlugin {
  constructor() {
    this.currentPath = null;
    this.fileTree = [];
  }

  async activate(context) {
    console.log('File Explorer plugin activated');
    
    // Get initial directory
    this.currentPath = await context.terminal.getCurrentDirectory();
    
    // Register commands
    context.subscriptions.push(
      this.registerCommand(context, 'fileExplorer.openFile', () => this.openFile(context))
    );
    
    context.subscriptions.push(
      this.registerCommand(context, 'fileExplorer.refresh', () => this.refresh(context))
    );
    
    // Listen for terminal data to detect cd commands
    context.subscriptions.push(
      context.terminal.onData((data) => {
        // Simple cd detection
        if (data.includes('cd ')) {
          setTimeout(() => this.updateCurrentPath(context), 500);
        }
      })
    );
    
    // Initial file list
    await this.refresh(context);
  }
  
  async deactivate() {
    console.log('File Explorer plugin deactivated');
  }
  
  registerCommand(context, command, handler) {
    // In a real implementation, this would register with the command palette
    return {
      dispose: () => {
        // Cleanup
      }
    };
  }
  
  async refresh(context) {
    try {
      const files = await context.workspace.findFiles('*');
      this.fileTree = files;
      
      // Update UI (in real implementation, would update the panel)
      context.ui.showMessage(`Found ${files.length} files in ${this.currentPath}`);
    } catch (error) {
      context.ui.showMessage('Failed to refresh file list', 'error');
    }
  }
  
  async openFile(context) {
    const filename = await context.ui.showInputBox({
      prompt: 'Enter filename to open',
      placeHolder: 'example.txt'
    });
    
    if (filename) {
      // Open file in terminal using appropriate editor
      context.terminal.writeLine(`${process.env.EDITOR || 'nano'} ${filename}`);
    }
  }
  
  async updateCurrentPath(context) {
    const newPath = await context.terminal.getCurrentDirectory();
    if (newPath !== this.currentPath) {
      this.currentPath = newPath;
      await this.refresh(context);
    }
  }
}

module.exports = new FileExplorerPlugin();