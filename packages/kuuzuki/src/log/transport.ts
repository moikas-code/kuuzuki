import { z } from "zod"
import { extendZodWithOpenApi } from "zod-openapi"
import path from "path"
import fs from "fs/promises"
import { Global } from "../global"
import type { Logger } from "./logger"

extendZodWithOpenApi(z)

export namespace Transport {
  // Transport configuration schemas
  export const ConsoleTransportConfig = z
    .object({
      type: z.literal("console"),
      level: z.enum(["debug", "info", "warn", "error", "fatal"]).default("info"),
      colorize: z.boolean().default(true),
      timestamp: z.boolean().default(true),
      format: z.enum(["json", "pretty", "simple"]).default("pretty"),
    })
    .strict()
    .openapi({ ref: "ConsoleTransportConfig" })
  export type ConsoleTransportConfig = z.infer<typeof ConsoleTransportConfig>

  export const FileTransportConfig = z
    .object({
      type: z.literal("file"),
      level: z.enum(["debug", "info", "warn", "error", "fatal"]).default("info"),
      filename: z.string().describe("Log file path"),
      maxSize: z
        .number()
        .default(10 * 1024 * 1024)
        .describe("Maximum file size in bytes"),
      maxFiles: z.number().default(5).describe("Maximum number of rotated files"),
      compress: z.boolean().default(true).describe("Compress rotated files"),
      format: z.enum(["json", "text"]).default("json"),
    })
    .strict()
    .openapi({ ref: "FileTransportConfig" })
  export type FileTransportConfig = z.infer<typeof FileTransportConfig>

  export const RemoteTransportConfig = z
    .object({
      type: z.literal("remote"),
      level: z.enum(["debug", "info", "warn", "error", "fatal"]).default("info"),
      url: z.string().url().describe("Remote logging endpoint URL"),
      headers: z.record(z.string(), z.string()).optional().describe("HTTP headers"),
      batchSize: z.number().default(100).describe("Number of logs to batch before sending"),
      flushInterval: z.number().default(5000).describe("Flush interval in milliseconds"),
      timeout: z.number().default(10000).describe("Request timeout in milliseconds"),
      retries: z.number().default(3).describe("Number of retries on failure"),
      format: z.enum(["json"]).default("json"),
    })
    .strict()
    .openapi({ ref: "RemoteTransportConfig" })
  export type RemoteTransportConfig = z.infer<typeof RemoteTransportConfig>

  export const TransportConfig = z.discriminatedUnion("type", [
    ConsoleTransportConfig,
    FileTransportConfig,
    RemoteTransportConfig,
  ])
  export type TransportConfig = z.infer<typeof TransportConfig>

  // Transport interface
  export interface TransportInstance {
    name: string
    config: TransportConfig
    write(entry: Logger.LogEntry): Promise<void>
    flush?(): Promise<void>
    close?(): Promise<void>
  }

  // Global transport registry
  const transports = new Map<string, TransportInstance>()
  const defaultTransports: Record<string, TransportConfig> = {
    console: {
      type: "console",
      level: "info",
      colorize: true,
      timestamp: true,
      format: "pretty",
    },
    file: {
      type: "file",
      level: "debug",
      filename: path.join(Global.Path.data, "logs", "kuuzuki.log"),
      maxSize: 10 * 1024 * 1024,
      maxFiles: 5,
      compress: true,
      format: "json",
    },
  }

  // Initialize transport system
  export async function init(configs?: Record<string, TransportConfig>): Promise<void> {
    const transportConfigs = configs || defaultTransports

    // Ensure log directory exists
    const logDir = path.join(Global.Path.data, "logs")
    await fs.mkdir(logDir, { recursive: true })

    // Initialize each transport
    for (const [name, config] of Object.entries(transportConfigs)) {
      try {
        const transport = await createTransport(name, config)
        transports.set(name, transport)
      } catch (error) {
        console.error(`Failed to initialize transport ${name}:`, error)
      }
    }
  }

  // Create transport instance
  async function createTransport(name: string, config: TransportConfig): Promise<TransportInstance> {
    switch (config.type) {
      case "console":
        return createConsoleTransport(name, config)
      case "file":
        return createFileTransport(name, config)
      case "remote":
        return createRemoteTransport(name, config)
      default:
        throw new Error(`Unknown transport type: ${(config as any).type}`)
    }
  }

  // Console transport implementation
  function createConsoleTransport(name: string, config: ConsoleTransportConfig): TransportInstance {
    const colors: Record<string, string> = {
      debug: "\x1b[36m", // cyan
      info: "\x1b[32m", // green
      warn: "\x1b[33m", // yellow
      error: "\x1b[31m", // red
      fatal: "\x1b[35m", // magenta
      reset: "\x1b[0m",
    }

    function formatEntry(entry: Logger.LogEntry): string {
      switch (config.format) {
        case "json":
          return JSON.stringify(entry)
        case "simple":
          return `${entry.level.toUpperCase()} ${entry.message}`
        case "pretty":
        default:
          const timestamp = config.timestamp ? `${entry.timestamp} ` : ""
          const level = config.colorize
            ? `${colors[entry.level]}${entry.level.toUpperCase()}${colors["reset"]}`
            : entry.level.toUpperCase()
          const service = `[${entry.service}]`
          const context = entry.context ? ` ${JSON.stringify(entry.context)}` : ""
          const error = entry.error ? ` ERROR: ${entry.error.message}` : ""
          const performance = entry.performance ? ` (${entry.performance.duration}ms)` : ""

          return `${timestamp}${level} ${service} ${entry.message}${context}${error}${performance}`
      }
    }

    return {
      name,
      config,
      async write(entry: Logger.LogEntry): Promise<void> {
        const levelPriority: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 }
        if (levelPriority[entry.level] < levelPriority[config.level]) {
          return
        }

        const formatted = formatEntry(entry)
        const output = entry.level === "error" || entry.level === "fatal" ? process.stderr : process.stdout
        output.write(formatted + "\n")
      },
    }
  }

  // File transport implementation
  function createFileTransport(name: string, config: FileTransportConfig): TransportInstance {
    let currentSize = 0
    let writeQueue: Promise<void> = Promise.resolve()

    async function ensureDirectory(): Promise<void> {
      const dir = path.dirname(config.filename)
      await fs.mkdir(dir, { recursive: true })
    }

    async function getCurrentSize(): Promise<number> {
      try {
        const stats = await fs.stat(config.filename)
        return stats.size
      } catch {
        return 0
      }
    }

    async function rotateFile(): Promise<void> {
      if (currentSize < config.maxSize) return

      // Rotate existing files
      for (let i = config.maxFiles - 1; i > 0; i--) {
        const oldFile = `${config.filename}.${i}`
        const newFile = `${config.filename}.${i + 1}`

        try {
          await fs.rename(oldFile, newFile)
        } catch {
          // File doesn't exist, continue
        }
      }

      // Move current file to .1
      try {
        await fs.rename(config.filename, `${config.filename}.1`)

        // Compress if enabled
        if (config.compress) {
          // Note: In a real implementation, you'd use a compression library
          // For now, we'll just rename to indicate it should be compressed
          await fs.rename(`${config.filename}.1`, `${config.filename}.1.gz`)
        }
      } catch (error) {
        console.error("Failed to rotate log file:", error)
      }

      currentSize = 0
    }

    function formatEntry(entry: Logger.LogEntry): string {
      switch (config.format) {
        case "text":
          const timestamp = entry.timestamp
          const level = entry.level.toUpperCase()
          const service = `[${entry.service}]`
          const context = entry.context ? ` ${JSON.stringify(entry.context)}` : ""
          const error = entry.error ? ` ERROR: ${entry.error.message}` : ""
          const performance = entry.performance ? ` (${entry.performance.duration}ms)` : ""

          return `${timestamp} ${level} ${service} ${entry.message}${context}${error}${performance}`
        case "json":
        default:
          return JSON.stringify(entry)
      }
    }

    return {
      name,
      config,
      async write(entry: Logger.LogEntry): Promise<void> {
        const levelPriority: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 }
        if (levelPriority[entry.level] < levelPriority[config.level]) {
          return
        }

        // Queue writes to prevent race conditions
        writeQueue = writeQueue.then(async () => {
          await ensureDirectory()

          if (currentSize === 0) {
            currentSize = await getCurrentSize()
          }

          await rotateFile()

          const formatted = formatEntry(entry) + "\n"
          const data = Buffer.from(formatted, "utf8")

          await fs.appendFile(config.filename, data)
          currentSize += data.length
        })

        return writeQueue
      },

      async flush(): Promise<void> {
        return writeQueue
      },

      async close(): Promise<void> {
        return writeQueue
      },
    }
  }

  // Remote transport implementation
  function createRemoteTransport(name: string, config: RemoteTransportConfig): TransportInstance {
    let batch: Logger.LogEntry[] = []
    let flushTimer: Timer | null = null

    async function sendBatch(entries: Logger.LogEntry[]): Promise<void> {
      if (entries.length === 0) return

      const payload = {
        logs: entries,
        timestamp: new Date().toISOString(),
        source: "kuuzuki",
      }

      let attempt = 0
      while (attempt <= config.retries) {
        try {
          const response = await fetch(config.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...config.headers,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(config.timeout),
          })

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }

          return // Success
        } catch (error) {
          attempt++
          if (attempt > config.retries) {
            console.error(`Failed to send logs to ${config.url} after ${config.retries} retries:`, error)
            return
          }

          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000))
        }
      }
    }

    function scheduleFlush(): void {
      if (flushTimer) return

      flushTimer = setTimeout(async () => {
        flushTimer = null
        const currentBatch = batch
        batch = []
        await sendBatch(currentBatch)
      }, config.flushInterval)
    }

    return {
      name,
      config,
      async write(entry: Logger.LogEntry): Promise<void> {
        const levelPriority: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 }
        if (levelPriority[entry.level] < levelPriority[config.level]) {
          return
        }

        batch.push(entry)

        if (batch.length >= config.batchSize) {
          const currentBatch = batch
          batch = []
          if (flushTimer) {
            clearTimeout(flushTimer)
            flushTimer = null
          }
          await sendBatch(currentBatch)
        } else {
          scheduleFlush()
        }
      },

      async flush(): Promise<void> {
        if (flushTimer) {
          clearTimeout(flushTimer)
          flushTimer = null
        }

        const currentBatch = batch
        batch = []
        await sendBatch(currentBatch)
      },

      async close(): Promise<void> {
        await this.flush?.()
      },
    }
  }

  // Get transport instances
  export function getTransports(names?: string[]): TransportInstance[] {
    if (!names || names.length === 0) {
      return Array.from(transports.values())
    }

    return names
      .map((name) => transports.get(name))
      .filter((transport): transport is TransportInstance => transport !== undefined)
  }

  // Get specific transport
  export function getTransport(name: string): TransportInstance | undefined {
    return transports.get(name)
  }

  // Add transport at runtime
  export async function addTransport(name: string, config: TransportConfig): Promise<void> {
    const transport = await createTransport(name, config)
    transports.set(name, transport)
  }

  // Remove transport
  export async function removeTransport(name: string): Promise<void> {
    const transport = transports.get(name)
    if (transport) {
      await transport.close?.()
      transports.delete(name)
    }
  }

  // List available transports
  export function listTransports(): string[] {
    return Array.from(transports.keys())
  }

  // Flush all transports
  export async function flushAll(): Promise<void> {
    await Promise.all(Array.from(transports.values()).map((transport) => transport.flush?.()))
  }

  // Shutdown transport system
  export async function shutdown(): Promise<void> {
    await Promise.all(Array.from(transports.values()).map((transport) => transport.close?.()))
    transports.clear()
  }

  // Log rotation utilities
  export namespace Rotation {
    export async function cleanupOldLogs(logDir: string, maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
      try {
        const files = await fs.readdir(logDir)
        const now = Date.now()

        for (const file of files) {
          if (!file.endsWith(".log") && !file.endsWith(".log.gz")) continue

          const filePath = path.join(logDir, file)
          const stats = await fs.stat(filePath)

          if (now - stats.mtime.getTime() > maxAge) {
            await fs.unlink(filePath)
          }
        }
      } catch (error) {
        console.error("Failed to cleanup old logs:", error)
      }
    }

    export async function getLogFiles(logDir: string): Promise<Array<{ name: string; size: number; modified: Date }>> {
      try {
        const files = await fs.readdir(logDir)
        const logFiles = []

        for (const file of files) {
          if (!file.endsWith(".log") && !file.endsWith(".log.gz")) continue

          const filePath = path.join(logDir, file)
          const stats = await fs.stat(filePath)

          logFiles.push({
            name: file,
            size: stats.size,
            modified: stats.mtime,
          })
        }

        return logFiles.sort((a, b) => b.modified.getTime() - a.modified.getTime())
      } catch (error) {
        console.error("Failed to get log files:", error)
        return []
      }
    }
  }
}
