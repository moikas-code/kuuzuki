// Browser Preview Plugin

class BrowserPreviewPlugin {
  constructor() {
    this.currentUrl = 'https://google.com';
    this.webviewPanel = null;
    this.localhostPorts = [];
  }

  async activate(context) {
    console.log('Browser Preview plugin activated');
    
    // Register commands
    context.subscriptions.push(
      this.registerCommand(context, 'browser.open', () => this.openBrowser(context))
    );
    
    context.subscriptions.push(
      this.registerCommand(context, 'browser.openLocalhost', () => this.openLocalhost(context))
    );
    
    // Monitor terminal for localhost servers
    context.subscriptions.push(
      context.terminal.onData((data) => {
        this.detectLocalhostServers(data, context);
      })
    );
  }
  
  async deactivate() {
    if (this.webviewPanel) {
      this.webviewPanel.dispose();
    }
  }
  
  registerCommand(context, command, handler) {
    // Command registration
    return {
      dispose: () => {}
    };
  }
  
  async openBrowser(context) {
    const url = await context.ui.showInputBox({
      prompt: 'Enter URL to open',
      placeHolder: 'https://example.com',
      value: this.currentUrl,
      validateInput: (value) => {
        try {
          new URL(value);
          return undefined;
        } catch {
          return 'Please enter a valid URL';
        }
      }
    });
    
    if (url) {
      this.currentUrl = url;
      this.showWebview(context, url);
    }
  }
  
  async openLocalhost(context) {
    if (this.localhostPorts.length === 0) {
      context.ui.showMessage('No localhost servers detected', 'warning');
      return;
    }
    
    const port = await context.ui.showInputBox({
      prompt: 'Enter localhost port',
      placeHolder: '3000',
      value: this.localhostPorts[0] || '3000'
    });
    
    if (port) {
      const url = `http://localhost:${port}`;
      this.showWebview(context, url);
    }
  }
  
  showWebview(context, url) {
    if (!this.webviewPanel) {
      this.webviewPanel = context.ui.createWebviewPanel(
        'browserPreview',
        'Browser Preview',
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );
      
      this.webviewPanel.onDidDispose(() => {
        this.webviewPanel = null;
      });
    }
    
    // Set webview content
    this.webviewPanel.webview.html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 0; overflow: hidden; }
            iframe { width: 100vw; height: 100vh; border: none; }
            .controls {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              background: #2d2d30;
              padding: 8px;
              display: flex;
              gap: 8px;
              z-index: 1000;
            }
            input { flex: 1; padding: 4px 8px; }
            button { padding: 4px 12px; }
          </style>
        </head>
        <body>
          <div class="controls">
            <button onclick="goBack()">←</button>
            <button onclick="goForward()">→</button>
            <button onclick="refresh()">↻</button>
            <input type="text" id="urlBar" value="${url}" />
            <button onclick="navigate()">Go</button>
          </div>
          <iframe id="frame" src="${url}" style="margin-top: 40px;"></iframe>
          <script>
            const frame = document.getElementById('frame');
            const urlBar = document.getElementById('urlBar');
            
            function goBack() { frame.contentWindow.history.back(); }
            function goForward() { frame.contentWindow.history.forward(); }
            function refresh() { frame.contentWindow.location.reload(); }
            function navigate() {
              frame.src = urlBar.value;
            }
            
            urlBar.addEventListener('keypress', (e) => {
              if (e.key === 'Enter') navigate();
            });
          </script>
        </body>
      </html>
    `;
    
    this.webviewPanel.reveal();
    context.ui.showMessage(`Opened ${url} in browser preview`);
  }
  
  detectLocalhostServers(data, context) {
    // Detect common server startup messages
    const portPatterns = [
      /listening on port (\d+)/i,
      /server running at.*:(\d+)/i,
      /localhost:(\d+)/i,
      /127\.0\.0\.1:(\d+)/i,
      /0\.0\.0\.0:(\d+)/i
    ];
    
    for (const pattern of portPatterns) {
      const match = data.match(pattern);
      if (match && match[1]) {
        const port = match[1];
        if (!this.localhostPorts.includes(port)) {
          this.localhostPorts.push(port);
          context.ui.showMessage(
            `Detected server on port ${port}. Press Ctrl+Shift+B to open in browser.`,
            'info'
          );
        }
      }
    }
  }
}

module.exports = new BrowserPreviewPlugin();