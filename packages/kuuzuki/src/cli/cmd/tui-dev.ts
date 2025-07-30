#!/usr/bin/env bun
// Development helper for TUI debugging

import path from "path"

async function runTUI() {
  console.log("Starting TUI in debug mode...")
  
  // Start a minimal server
  const server = Bun.serve({
    port: 12275,
    hostname: "127.0.0.1",
    fetch(req) {
      const url = new URL(req.url)
      
      if (url.pathname === "/health") {
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { "Content-Type": "application/json" }
        })
      }
      
      if (url.pathname === "/config") {
        return new Response(JSON.stringify({
          providers: {
            'demo': {
              id: 'demo',
              name: 'Demo Provider',
              models: [{
                id: 'demo',
                name: 'Demo Model',
                contextLength: 4096
              }]
            }
          },
          defaultProvider: 'demo',
          defaultModel: 'demo'
        }), {
          headers: { "Content-Type": "application/json" }
        })
      }
      
      return new Response("Not found", { status: 404 })
    }
  })
  
  console.log(`Debug server running on http://${server.hostname}:${server.port}`)
  
  // Run TUI with Go
  const tuiPath = path.join(import.meta.dir, "../../../tui/cmd/kuuzuki")
  console.log(`Running TUI from: ${tuiPath}`)
  
  const proc = Bun.spawn({
    cmd: ["go", "run", "./main.go"],
    cwd: tuiPath,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
    env: {
      ...process.env,
      CGO_ENABLED: "0",
      KUUZUKI_SERVER: `http://${server.hostname}:${server.port}`,
      KUUZUKI_APP_INFO: JSON.stringify({
        name: 'kuuzuki',
        version: 'dev',
        path: { cwd: process.cwd() }
      }),
      KUUZUKI_MODES: JSON.stringify([{
        id: 'default',
        name: 'Default',
        description: 'Default mode'
      }])
    }
  })
  
  // Handle exit
  const cleanup = () => {
    console.log("\nShutting down...")
    proc.kill()
    server.stop()
    process.exit(0)
  }
  
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
  
  await proc.exited
  server.stop()
}

runTUI().catch(console.error)