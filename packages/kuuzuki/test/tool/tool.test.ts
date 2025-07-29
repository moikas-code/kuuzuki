import { describe, expect, test } from "bun:test"
import { App } from "../../src/app/app"
import { GlobTool } from "../../src/tool/glob"
import { ListTool } from "../../src/tool/ls"
import * as path from "path"

const ctx = {
  sessionID: "test",
  messageID: "",
  abort: AbortSignal.any([]),
  metadata: () => {},
}
const glob = await GlobTool.init()
const list = await ListTool.init()

// Find the project root by looking for package.json with "kuuzuki" in name
function findProjectRoot(): string {
  let currentDir = process.cwd()
  while (currentDir !== '/') {
    try {
      const packageJsonPath = path.join(currentDir, 'package.json')
      const packageJson = JSON.parse(require('fs').readFileSync(packageJsonPath, 'utf8'))
      if (packageJson.name && (packageJson.name.includes('kuucode') || packageJson.workspaces)) {
        return currentDir
      }
    } catch (e) {
      // Continue searching up the directory tree
    }
    currentDir = path.dirname(currentDir)
  }
  return process.cwd() // fallback to current directory
}

const projectRoot = findProjectRoot()

describe("tool.glob", () => {
  test("truncate", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      const srcPath = path.join(projectRoot, 'packages/kuuzuki/src')
      let result = await glob.execute(
        {
          pattern: "**/*.ts",
          path: srcPath,
        },
        ctx,
      )
      // The src directory should have many TypeScript files, triggering truncation
      expect(result.metadata.count).toBeGreaterThan(0)
      // If there are more than 100 files, it should be truncated
      if (result.metadata.count >= 100) {
        expect(result.metadata.truncated).toBe(true)
      }
    })
  })
  test("basic", async () => {
    await App.provide({ cwd: process.cwd() }, async () => {
      const docsPath = path.join(projectRoot, 'docs')
      let result = await glob.execute(
        {
          pattern: "*.md",
          path: docsPath,
        },
        ctx,
      )
      expect(result.metadata.truncated).toBe(false)
      expect(result.metadata.count).toBeGreaterThan(0)
    })
  })
})

describe("tool.ls", () => {
  test("basic", async () => {
    const result = await App.provide({ cwd: process.cwd() }, async () => {
      const srcPath = path.join(projectRoot, 'packages/kuuzuki/src')
      return await list.execute({ path: srcPath, ignore: [".git"] }, ctx)
    })
    expect(result.output).toContain("tool")
  })
})
