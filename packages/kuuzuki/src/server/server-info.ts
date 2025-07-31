import fs from "fs/promises"
import path from "path"
import { Global } from "../global"

export interface ServerInfo {
  port: number
  hostname: string
  url: string
  pid: number
  startTime: string
}

export async function writeServerInfo(server: { port: number; hostname: string }): Promise<void> {
  const serverInfo: ServerInfo = {
    port: server.port,
    hostname: server.hostname,
    url: `http://${server.hostname}:${server.port}`,
    pid: process.pid,
    startTime: new Date().toISOString()
  }

  // Use PID-based filename to support multiple instances
  const filename = `server-${process.pid}.json`
  
  await fs.writeFile(
    path.join(Global.Path.state, filename),
    JSON.stringify(serverInfo, null, 2)
  )
  
  // Also write to the default server.json for backward compatibility
  await fs.writeFile(
    path.join(Global.Path.state, "server.json"),
    JSON.stringify(serverInfo, null, 2)
  )
}

export async function clearServerInfo(): Promise<void> {
  try {
    // Clear PID-specific file
    const pidFilename = `server-${process.pid}.json`
    await fs.unlink(path.join(Global.Path.state, pidFilename))
  } catch {
    // File doesn't exist, ignore
  }
  
  try {
    // Clear default file only if it belongs to this process
    const defaultPath = path.join(Global.Path.state, "server.json")
    const content = await fs.readFile(defaultPath, "utf-8")
    const info = JSON.parse(content) as ServerInfo
    if (info.pid === process.pid) {
      await fs.unlink(defaultPath)
    }
  } catch {
    // File doesn't exist or can't be read, ignore
  }
}