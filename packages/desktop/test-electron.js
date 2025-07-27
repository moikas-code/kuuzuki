const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  console.log('Electron is ready!');
  
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  });
  
  win.loadURL('data:text/html,<h1>Electron is working!</h1>');
  
  win.on('ready-to-show', () => {
    console.log('Window is ready to show');
  });
});

app.on('window-all-closed', () => {
  app.quit();
});