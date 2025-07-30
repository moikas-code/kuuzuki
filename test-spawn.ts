#!/usr/bin/env bun

// Simple test to check if TUI can spawn properly

import { $ } from "bun"

console.log("Testing TUI spawn...")

try {
  // First, try to run go version
  const goVersion = await $`go version`.text()
  console.log("Go version:", goVersion.trim())
  
  // Check if TUI binary exists
  const tuiBinary = "./packages/tui/kuuzuki-tui"
  const binaryExists = await Bun.file(tuiBinary).exists()
  console.log("TUI binary exists:", binaryExists)
  
  if (!binaryExists) {
    console.log("Building TUI...")
    await $`cd packages/tui && go build -o kuuzuki-tui ./cmd/kuuzuki`.quiet()
    console.log("TUI built successfully")
  }
  
  // Start a minimal server
  console.log("Starting test server...")
  const server = Bun.serve({
    port: 0, // Random port
    fetch(req) {
      return new Response(JSON.stringify({ status: "ok" }))
    }
  })
  
  console.log(`Server running on port ${server.port}`)
  
  // Try to spawn TUI
  console.log("Spawning TUI...")
  const proc = Bun.spawn({
    cmd: [tuiBinary, "--help"],
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      KUUZUKI_SERVER: `http://localhost:${server.port}`
    }
  })
  
  const [stdout, stderr] = await Promise.all([
    Bun.readableStreamToText(proc.stdout),
    Bun.readableStreamToText(proc.stderr)
  ])
  
  console.log("Exit code:", await proc.exited)
  console.log("Stdout:", stdout)
  console.log("Stderr:", stderr)
  
  server.stop()
  
} catch (e) {
  console.error("Error:", e)
}