# Kuuzuki Logging System

A comprehensive, structured logging system for kuuzuki with multiple transports, performance metrics, and context preservation.

## Features

- **Structured Logging**: JSON-based log entries with consistent schema
- **Multiple Log Levels**: debug, info, warn, error, fatal
- **Multiple Transports**: Console, file, and remote logging
- **Performance Metrics**: Built-in performance tracking and timing
- **Context Preservation**: Maintain context across log entries
- **Log Rotation**: Automatic file rotation and cleanup
- **Request Correlation**: Trace and session ID support
- **Memory Management**: Configurable context size limits

## Quick Start

```typescript
import { Logger } from "./log"

// Initialize the logging system
await Logger.init({
  level: "info",
  service: "my-service",
  transports: ["console", "file"],
})

// Get a logger instance
const logger = Logger.get("my-service")

// Basic logging
logger.info("Application started")
logger.error("Something went wrong", error)

// Logging with context
logger.info("User action", { userId: "123", action: "login" })

// Performance timing
const timer = logger.time("Database query")
// ... do work
timer.stop()
```

## Architecture

### Core Components

1. **Logger** (`logger.ts`): Main logging interface and entry management
2. **Transport** (`transport.ts`): Multiple output destinations (console, file, remote)
3. **Metrics** (`metrics.ts`): Performance tracking and system metrics
4. **Index** (`index.ts`): Convenience exports and default logger

### Log Entry Structure

```typescript
interface LogEntry {
  timestamp: string // ISO timestamp
  level: "debug" | "info" | "warn" | "error" | "fatal"
  message: string // Log message
  service: string // Service/component name
  context?: Record<string, any> // Additional context data
  error?: {
    // Error details (if applicable)
    name: string
    message: string
    stack?: string
    code?: string
  }
  performance?: {
    // Performance metrics (if applicable)
    duration: number // Duration in milliseconds
    memory?: number // Memory usage in bytes
    cpu?: number // CPU usage percentage
  }
  traceId?: string // Request trace ID
  sessionId?: string // User session ID
}
```

## Configuration

### Logger Configuration

```typescript
interface LoggerConfig {
  level: "debug" | "info" | "warn" | "error" | "fatal"
  service: string
  context?: Record<string, any>
  enablePerformanceTracking: boolean
  enableStackTrace: boolean
  maxContextSize: number
  transports: string[]
}
```

### Transport Configuration

#### Console Transport

```typescript
{
  type: "console",
  level: "info",
  colorize: true,
  timestamp: true,
  format: "pretty" | "json" | "simple"
}
```

#### File Transport

```typescript
{
  type: "file",
  level: "debug",
  filename: "/path/to/logfile.log",
  maxSize: 10 * 1024 * 1024,  // 10MB
  maxFiles: 5,
  compress: true,
  format: "json" | "text"
}
```

#### Remote Transport

```typescript
{
  type: "remote",
  level: "warn",
  url: "https://logs.example.com/api/logs",
  headers: { "Authorization": "Bearer token" },
  batchSize: 100,
  flushInterval: 5000,
  timeout: 10000,
  retries: 3,
  format: "json"
}
```

## Usage Examples

### Basic Logging

```typescript
import { Logger } from "./log"

const logger = Logger.create({ service: "api-server" })

logger.debug("Debug information", { userId: "123" })
logger.info("Request processed successfully")
logger.warn("Rate limit approaching", { current: 95, limit: 100 })
logger.error("Database connection failed", error)
logger.fatal("Critical system failure", error)
```

### Context Management

```typescript
// Create child logger with additional context
const requestLogger = logger.child({
  requestId: "req-123",
  userId: "user-456",
})

requestLogger.info("Processing request") // Includes requestId and userId
requestLogger.error("Request failed", error) // Context preserved
```

### Performance Tracking

```typescript
// Manual timing
const timer = logger.time("Database query", { table: "users" })
const users = await db.users.findMany()
timer.stop() // Logs completion with duration

// Function wrapping
const timedFunction = Metrics.Performance.trackFunction(myFunction, "my-function-execution", "my-service")
```

### Request Logging Middleware

```typescript
import { ServerLogging } from "./integration-example"

// Initialize server logging
await ServerLogging.initializeServerLogging()

// Use middleware
app.use(ServerLogging.createRequestLoggingMiddleware())

// In route handlers
app.get("/api/users", async (c) => {
  const logger = c.get("logger") // Request-specific logger
  logger.info("Fetching users")

  try {
    const users = await getUsers()
    logger.info("Users fetched successfully", { count: users.length })
    return c.json(users)
  } catch (error) {
    logger.error("Failed to fetch users", error)
    throw error
  }
})
```

### Metrics Collection

```typescript
import { Metrics } from "./log"

// Get metrics collector
const metrics = Metrics.getCollector("my-service")

// Record custom metrics
metrics.recordCounter("requests_total", 1, { method: "GET", status: "200" })
metrics.recordGauge("memory_usage", process.memoryUsage().heapUsed, undefined, "bytes")
metrics.recordHistogram("response_time", 150, { endpoint: "/api/users" }, "ms")

// Get metrics snapshot
const snapshot = metrics.getSnapshot()
console.log(snapshot)
```

## Transport Management

### Adding Transports at Runtime

```typescript
import { Transport } from "./log"

// Add remote logging
await Transport.addTransport("remote-errors", {
  type: "remote",
  level: "error",
  url: "https://errors.example.com/api/logs",
  batchSize: 50,
  flushInterval: 2000,
})

// Add custom file transport
await Transport.addTransport("audit-log", {
  type: "file",
  level: "info",
  filename: "/var/log/kuuzuki-audit.log",
  maxSize: 100 * 1024 * 1024, // 100MB
  maxFiles: 20,
  format: "json",
})
```

### Log Rotation

```typescript
import { Transport } from "./log"

// Manual log rotation
await Transport.Rotation.cleanupOldLogs("/var/log/kuuzuki", 7 * 24 * 60 * 60 * 1000) // 7 days

// Get log file information
const logFiles = await Transport.Rotation.getLogFiles("/var/log/kuuzuki")
console.log(logFiles)
```

## Integration with Kuuzuki Components

### Server Integration

```typescript
import { ServerLogging } from "./integration-example"

// Initialize logging for server
await ServerLogging.initializeServerLogging()

// Use request middleware
const app = new Hono()
app.use("*", ServerLogging.createRequestLoggingMiddleware())
```

### Session Integration

```typescript
import { SessionLogging } from "./integration-example"

// Log session events
SessionLogging.logSessionEvent("session-123", "started", { userId: "user-456" })
SessionLogging.logSessionEvent("session-123", "message_sent", { messageId: "msg-789" })
SessionLogging.logSessionError("session-123", error, { context: "message_processing" })
```

### Tool Integration

```typescript
import { ToolLogging } from "./integration-example"

// Wrap tool execution with logging
const result = await ToolLogging.logToolExecution("bash", { command: "ls -la" }, async () => {
  return await executeBashCommand("ls -la")
})
```

### Provider Integration

```typescript
import { ProviderLogging } from "./integration-example"

// Log provider interactions
ProviderLogging.logProviderRequest("anthropic", "claude-3-sonnet", request)
const response = await provider.complete(request)
ProviderLogging.logProviderResponse("anthropic", "claude-3-sonnet", response, duration)
```

## Configuration Integration

### Environment Variables

```bash
# Log level
LOG_LEVEL=debug

# Remote logging
LOG_REMOTE_URL=https://logs.example.com/api/logs

# File logging
LOG_FILE_PATH=/var/log/kuuzuki.log
LOG_FILE_MAX_SIZE=50000000  # 50MB
LOG_FILE_MAX_FILES=10
```

### Configuration File

```json
{
  "logging": {
    "level": "info",
    "transports": {
      "console": {
        "type": "console",
        "level": "info",
        "colorize": true,
        "format": "pretty"
      },
      "file": {
        "type": "file",
        "level": "debug",
        "filename": "/var/log/kuuzuki.log",
        "maxSize": 52428800,
        "maxFiles": 10,
        "compress": true
      }
    }
  }
}
```

## Metrics and Monitoring

### System Metrics

```typescript
import { MetricsDashboard } from "./integration-example"

// Get system metrics
const metrics = MetricsDashboard.getSystemMetrics()

// Export metrics in different formats
const jsonMetrics = await MetricsDashboard.exportMetrics("json")
const prometheusMetrics = await MetricsDashboard.exportMetrics("prometheus")
```

### Performance Monitoring

```typescript
// Track memory usage
Metrics.Performance.trackMemory("my-service", "heap_usage")

// Track event loop lag
Metrics.Performance.trackEventLoopLag("my-service")

// Create performance timer
const timer = Metrics.Performance.createTimer("operation", "my-service", { type: "database" })
// ... do work
timer.stop()
```

## Best Practices

### 1. Use Appropriate Log Levels

- **debug**: Detailed information for debugging
- **info**: General information about application flow
- **warn**: Warning conditions that should be noted
- **error**: Error conditions that don't stop the application
- **fatal**: Critical errors that may cause the application to stop

### 2. Include Relevant Context

```typescript
// Good: Includes relevant context
logger.info("User login successful", {
  userId: user.id,
  email: user.email,
  loginMethod: "password",
  ip: request.ip,
})

// Bad: Missing context
logger.info("User login successful")
```

### 3. Use Child Loggers for Context

```typescript
// Create request-specific logger
const requestLogger = logger.child({
  requestId: generateRequestId(),
  userId: request.user?.id,
})

// All logs from this logger will include the context
requestLogger.info("Processing request")
requestLogger.error("Request failed", error)
```

### 4. Handle Sensitive Data

```typescript
// Use the sanitization utility
const sanitizedContext = Logger.Utils.sanitizeContext({
  userId: "123",
  password: "secret123", // Will be redacted
  apiKey: "key-456", // Will be redacted
})

logger.info("User data", sanitizedContext)
```

### 5. Performance Considerations

```typescript
// Use performance tracking for critical operations
const timer = logger.time("Database query")
const result = await database.query(sql)
timer.stop()

// Track function performance
const trackedFunction = Metrics.Performance.trackFunction(expensiveOperation, "expensive-operation", "my-service")
```

## Troubleshooting

### Common Issues

1. **Logs not appearing**: Check log level configuration
2. **File transport not working**: Verify file permissions and directory existence
3. **Remote transport failing**: Check network connectivity and authentication
4. **Memory usage high**: Reduce `maxContextSize` or implement log sampling

### Debug Mode

```typescript
// Enable debug logging
Logger.updateConfig({ level: "debug" })

// Enable stack traces
Logger.updateConfig({ enableStackTrace: true })
```

### Log Analysis

```bash
# View recent logs
tail -f /var/log/kuuzuki.log

# Search for errors
grep '"level":"error"' /var/log/kuuzuki.log | jq .

# Analyze performance
grep '"performance"' /var/log/kuuzuki.log | jq '.performance.duration' | sort -n
```

## Cleanup and Maintenance

### Graceful Shutdown

```typescript
import { LoggingCleanup } from "./integration-example"

// On application shutdown
process.on("SIGTERM", async () => {
  await LoggingCleanup.gracefulShutdown()
  process.exit(0)
})
```

### Log Rotation

```typescript
// Set up periodic log rotation
setInterval(
  async () => {
    await LoggingCleanup.rotateLogs()
  },
  24 * 60 * 60 * 1000,
) // Daily
```

This comprehensive logging system provides structured, performant, and maintainable logging for the kuuzuki application with full integration support for all components.
