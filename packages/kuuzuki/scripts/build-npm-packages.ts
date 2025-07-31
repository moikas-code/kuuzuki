#!/usr/bin/env bun
import { $ } from "bun"
import { join } from "path"
import { mkdir, rm, writeFile, copyFile } from "fs/promises"

const platforms = [
  { os: "linux", arch: "x64" },
  { os: "linux", arch: "arm64" },
  { os: "darwin", arch: "x64" },
  { os: "darwin", arch: "arm64" },
  { os: "windows", arch: "x64" },
]

async function buildMainPackage() {
  console.log("📦 Building main kuuzuki package...")
  
  const distDir = join("dist", "npm", "kuuzuki")
  await mkdir(distDir, { recursive: true })
  await mkdir(join(distDir, "bin"), { recursive: true })
  
  // Copy launcher scripts
  await copyFile("bin/kuuzuki-launcher.sh", join(distDir, "bin", "kuuzuki"))
  await copyFile("bin/kuuzuki-launcher.cmd", join(distDir, "bin", "kuuzuki.cmd"))
  
  // Copy postinstall script
  await copyFile("scripts/postinstall-prod.mjs", join(distDir, "postinstall.mjs"))
  
  // Copy README
  await copyFile("../../README.md", join(distDir, "README.md"))
  
  // Create package.json
  const mainPkg = await Bun.file("package.json").json()
  const version = process.env.VERSION || mainPkg.version
  const npmPkg = {
    name: "kuuzuki",
    version: version,
    description: mainPkg.description,
    license: mainPkg.license,
    repository: mainPkg.repository,
    bugs: mainPkg.bugs,
    homepage: mainPkg.homepage,
    bin: {
      kuuzuki: "./bin/kuuzuki"
    },
    scripts: {
      postinstall: "node ./postinstall.mjs"
    },
    engines: {
      node: ">=18.0.0"
    },
    optionalDependencies: platforms.reduce((deps, p) => {
      deps[`kuuzuki-${p.os}-${p.arch}`] = version
      return deps
    }, {} as Record<string, string>)
  }
  
  await writeFile(
    join(distDir, "package.json"),
    JSON.stringify(npmPkg, null, 2)
  )
  
  console.log("✓ Main package built")
}

async function buildPlatformPackage(platform: typeof platforms[0]) {
  const pkgName = `kuuzuki-${platform.os}-${platform.arch}`
  console.log(`📦 Building ${pkgName}...`)
  
  const distDir = join("dist", "npm", pkgName)
  const binDir = join(distDir, "bin")
  await mkdir(binDir, { recursive: true })
  
  // Copy the binary
  const binaryName = platform.os === "windows" ? "kuuzuki.exe" : "kuuzuki"
  const sourceBinary = join("dist", "binaries", `${platform.os}-${platform.arch}`, binaryName)
  const targetBinary = join(binDir, binaryName)
  
  try {
    await copyFile(sourceBinary, targetBinary)
  } catch (error) {
    console.warn(`⚠️  Binary not found for ${pkgName}, skipping...`)
    await rm(distDir, { recursive: true, force: true })
    return false
  }
  
  // Copy TUI binary if it exists
  const tuiBinaryName = platform.os === "windows" ? "kuuzuki-tui.exe" : "kuuzuki-tui"
  
  // Try different naming conventions for TUI binaries
  const tuiBinaryPaths = [
    join("binaries", `kuuzuki-tui-${platform.os}-${platform.arch}`),
    join("binaries", `kuuzuki-tui-${platform.os}`),
    join("../../tui", `kuuzuki-tui-${platform.os}-${platform.arch}`),
  ]
  
  let tuiCopied = false
  for (const sourceTuiBinary of tuiBinaryPaths) {
    try {
      await copyFile(sourceTuiBinary, join(binDir, tuiBinaryName))
      tuiCopied = true
      break
    } catch {
      // Continue trying other paths
    }
  }
  
  if (!tuiCopied) {
    console.log(`  ℹ️  No TUI binary found for ${platform.os}-${platform.arch}`)
  }
  
  // Create package.json
  const mainPkg = await Bun.file("package.json").json()
  const version = process.env.VERSION || mainPkg.version
  const platformPkg = {
    name: pkgName,
    version: version,
    description: `Kuuzuki CLI binary for ${platform.os} ${platform.arch}`,
    license: mainPkg.license,
    repository: mainPkg.repository,
    bugs: mainPkg.bugs,
    homepage: mainPkg.homepage,
    os: [platform.os === "darwin" ? "darwin" : platform.os === "windows" ? "win32" : platform.os],
    cpu: [platform.arch],
    bin: {
      kuuzuki: `./bin/${binaryName}`
    }
  }
  
  await writeFile(
    join(distDir, "package.json"),
    JSON.stringify(platformPkg, null, 2)
  )
  
  // Copy README
  await copyFile("../../README.md", join(distDir, "README.md"))
  
  console.log(`✓ ${pkgName} built`)
  return true
}

async function main() {
  const version = process.env.VERSION
  console.log("🔨 Building npm packages...")
  if (version) {
    console.log(`📌 Using version from environment: ${version}`)
  }
  
  // Clean dist directory
  await rm("dist/npm", { recursive: true, force: true })
  
  // Build binaries first
  console.log("\n📦 Building binaries...")
  if (process.argv.includes("--current-platform")) {
    await $`bun scripts/build-binary.ts --current-platform`
  } else {
    await $`bun scripts/build-binary.ts`
  }
  
  // Build main package
  await buildMainPackage()
  
  // Build platform packages
  console.log("\n📦 Building platform packages...")
  
  let platformsToBuild = platforms
  if (process.argv.includes("--current-platform")) {
    const currentPlatform = process.platform === "darwin" ? "darwin" : 
                           process.platform === "win32" ? "windows" : "linux"
    const currentArch = process.arch === "arm64" ? "arm64" : "x64"
    platformsToBuild = platforms.filter(p => p.os === currentPlatform && p.arch === currentArch)
  }
  
  const results = await Promise.all(platformsToBuild.map(buildPlatformPackage))
  
  const succeeded = results.filter(r => r).length
  console.log(`\n✅ Built ${succeeded + 1} packages (1 main + ${succeeded} platform packages)`)
  
  // Create tarballs for testing
  if (process.argv.includes("--pack")) {
    console.log("\n📦 Creating tarballs...")
    
    const packages = ["kuuzuki", ...platforms.map(p => `kuuzuki-${p.os}-${p.arch}`)]
    for (const pkg of packages) {
      const pkgDir = join("dist", "npm", pkg)
      try {
        await $`cd ${pkgDir} && npm pack`
        console.log(`✓ Created ${pkg}.tgz`)
      } catch {
        // Skip if package doesn't exist
      }
    }
  }
}

main().catch(console.error)