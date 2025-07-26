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

  await fs.writeFile(
    path.join(Global.Path.state, "server.json"),
    JSON.stringify(serverInfo, null, 2)
  )
}

export async function clearServerInfo(): Promise<void> {
  try {
    await fs.unlink(path.join(Global.Path.state, "server.json"))
  } catch {
    // File doesn't exist, ignore
  }
}