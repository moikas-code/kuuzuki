#!/usr/bin/env bun

import { $ } from "bun"
import { argv } from "process"

const pkg = await Bun.file("./package.json").json()
const version = pkg.version

console.log(`Publishing kuuzuki v${version} to npm...`)

// Clean dist directory
await $`rm -rf dist`
await $`mkdir -p dist`

// Build the CLI with version
console.log("Building CLI...")
await $`bun build src/index.ts --compile --target=bun --outfile=dist/kuuzuki-cli --define KUUZUKI_VERSION="'${version}'"`

// Build the TUI
console.log("Building TUI...")
await $`cd ../tui && go build -ldflags="-s -w" -o ../kuuzuki/dist/kuuzuki-tui ./cmd/kuuzuki/main.go`

// Prepare package for npm
console.log("Preparing npm package...")
await $`mkdir -p dist/kuuzuki`
await $`cp -r bin dist/kuuzuki/`
await $`cp dist/kuuzuki-cli dist/kuuzuki/bin/kuuzuki`
await $`cp dist/kuuzuki-tui dist/kuuzuki/bin/kuuzuki-tui`

// Copy necessary files
await $`cp README.md dist/kuuzuki/`
await $`cp script/postinstall.mjs dist/kuuzuki/`

// Create package.json for npm
const npmPackage = {
  name: "kuuzuki",
  version: version,
  description: "AI-powered terminal assistant",
  keywords: ["ai", "terminal", "cli", "assistant", "claude"],
  homepage: "https://github.com/kuuzuki/kuuzuki",
  repository: {
    type: "git",
    url: "https://github.com/kuuzuki/kuuzuki.git"
  },
  license: "MIT",
  bin: {
    kuuzuki: "./bin/kuuzuki"
  },
  scripts: {
    postinstall: "node postinstall.mjs"
  },
  engines: {
    node: ">=18.0.0"
  },
  publishConfig: {
    access: "public",
    registry: "https://registry.npmjs.org/"
  }
}

await Bun.file("dist/kuuzuki/package.json").write(JSON.stringify(npmPackage, null, 2))

// Publish to npm
if (!argv.includes("--dry-run")) {
  console.log("Publishing to npm...")
  await $`cd dist/kuuzuki && npm publish`
  console.log(`✅ Published kuuzuki v${version} to npm`)
} else {
  console.log("Dry run - skipping npm publish")
  console.log("Package contents:")
  await $`ls -la dist/kuuzuki/`
}