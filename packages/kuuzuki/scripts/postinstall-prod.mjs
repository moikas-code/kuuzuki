#!/usr/bin/env node

import fs from "fs"
import path from "path"
import os from "os"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

function detectPlatformAndArch() {
  // Map platform names
  let platform
  switch (os.platform()) {
    case "darwin":
      platform = "darwin"
      break
    case "linux":
      platform = "linux"
      break
    case "win32":
      platform = "windows"
      break
    default:
      platform = os.platform()
      break
  }

  // Map architecture names
  let arch
  switch (os.arch()) {
    case "x64":
      arch = "x64"
      break
    case "arm64":
      arch = "arm64"
      break
    case "arm":
      arch = "arm"
      break
    default:
      arch = os.arch()
      break
  }

  return { platform, arch }
}

function findBinary() {
  const { platform, arch } = detectPlatformAndArch()
  const packageName = `kuuzuki-${platform}-${arch}`
  const binary = platform === "windows" ? "kuuzuki.exe" : "kuuzuki"

  try {
    // Use require.resolve to find the package
    const packageJsonPath = require.resolve(`${packageName}/package.json`)
    const packageDir = path.dirname(packageJsonPath)
    const binaryPath = path.join(packageDir, "bin", binary)

    if (!fs.existsSync(binaryPath)) {
      throw new Error(`Binary not found at ${binaryPath}`)
    }

    return binaryPath
  } catch (error) {
    // This is expected in production where platform packages are optionalDependencies
    console.log(`Platform package ${packageName} not found - this is normal for cross-platform installations`)
    return null
  }
}

function main() {
  try {
    const binaryPath = findBinary()
    
    if (binaryPath) {
      // For development/testing - create symlink to actual binary
      const binScript = path.join(__dirname, "..", "bin", "kuuzuki")
      
      // Remove existing script if it exists
      if (fs.existsSync(binScript)) {
        fs.unlinkSync(binScript)
      }
      
      // Create symlink to the actual binary
      fs.symlinkSync(binaryPath, binScript)
      console.log(`kuuzuki binary symlinked: ${binScript} -> ${binaryPath}`)
    } else {
      // In production, the launcher script will handle finding the binary
      console.log("No platform binary found - launcher script will be used")
    }
  } catch (error) {
    console.error("Failed during postinstall:", error.message)
    // Don't exit with error - allow installation to continue
  }
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}