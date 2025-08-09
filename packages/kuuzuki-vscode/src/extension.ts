import * as vscode from 'vscode'
import * as path from 'path'

export function activate(context: vscode.ExtensionContext) {
  console.log('Kuuzuki VS Code extension is now active!')

  // Register command to open kuuzuki in terminal
  const openInTerminalCommand = vscode.commands.registerCommand('kuuzuki.openInTerminal', () => {
    const terminal = vscode.window.createTerminal({
      name: 'Kuuzuki',
      cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    })
    
    terminal.sendText('kuuzuki')
    terminal.show()
  })

  // Register command to run kuuzuki with current file
  const runWithFileCommand = vscode.commands.registerCommand('kuuzuki.runWithFile', () => {
    const activeEditor = vscode.window.activeTextEditor
    if (!activeEditor) {
      vscode.window.showWarningMessage('No active file to run with Kuuzuki')
      return
    }

    const filePath = activeEditor.document.uri.fsPath
    const terminal = vscode.window.createTerminal({
      name: 'Kuuzuki',
      cwd: path.dirname(filePath)
    })
    
    terminal.sendText(`kuuzuki run "${filePath}"`)
    terminal.show()
  })

  // Register command to start kuuzuki server
  const startServerCommand = vscode.commands.registerCommand('kuuzuki.startServer', () => {
    const terminal = vscode.window.createTerminal({
      name: 'Kuuzuki Server',
      cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    })
    
    terminal.sendText('kuuzuki serve')
    terminal.show()
  })

  // Register command to open kuuzuki TUI
  const openTUICommand = vscode.commands.registerCommand('kuuzuki.openTUI', () => {
    const terminal = vscode.window.createTerminal({
      name: 'Kuuzuki TUI',
      cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    })
    
    terminal.sendText('kuuzuki tui')
    terminal.show()
  })

  // Add status bar item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  statusBarItem.text = '$(robot) Kuuzuki'
  statusBarItem.tooltip = 'Click to open Kuuzuki'
  statusBarItem.command = 'kuuzuki.openInTerminal'
  statusBarItem.show()

  context.subscriptions.push(
    openInTerminalCommand,
    runWithFileCommand,
    startServerCommand,
    openTUICommand,
    statusBarItem
  )
}

export function deactivate() {
  console.log('Kuuzuki VS Code extension is now deactivated')
}