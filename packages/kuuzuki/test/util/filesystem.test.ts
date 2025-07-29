import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Filesystem } from "../../src/util/filesystem"
import { mkdir, writeFile, rm } from "fs/promises"
import { join } from "path"
import os from "os"

describe("Filesystem", () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = join(os.tmpdir(), `kuuzuki-fs-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  describe("overlaps", () => {
    test("should detect overlapping paths", () => {
      expect(Filesystem.overlaps("/home/user", "/home/user/project")).toBe(true)
      expect(Filesystem.overlaps("/home/user/project", "/home/user")).toBe(true)
      expect(Filesystem.overlaps("/home/user", "/home/user")).toBe(true)
    })

    test("should detect non-overlapping paths", () => {
      expect(Filesystem.overlaps("/home/user1", "/home/user2")).toBe(false)
      expect(Filesystem.overlaps("/var/log", "/home/user")).toBe(false)
    })

    test("should handle relative paths", () => {
      expect(Filesystem.overlaps("./src", "./src/components")).toBe(true)
      expect(Filesystem.overlaps("../parent", "./child")).toBe(false)
    })
  })

  describe("contains", () => {
    test("should detect when parent contains child", () => {
      expect(Filesystem.contains("/home/user", "/home/user/project/file.txt")).toBe(false)
      expect(Filesystem.contains("/home/user/project", "/home/user")).toBe(true)
    })

    test("should handle same paths", () => {
      expect(Filesystem.contains("/home/user", "/home/user")).toBe(false)
    })

    test("should handle relative paths", () => {
      expect(Filesystem.contains("./src", "./src/components/Button.tsx")).toBe(false)
      expect(Filesystem.contains("./src/components", "./src")).toBe(true)
    })
  })

  describe("findUp", () => {
    test("should find files going up the directory tree", async () => {
      // Create test structure
      const subDir = join(tempDir, "project", "src", "components")
      await mkdir(subDir, { recursive: true })

      // Create files at different levels
      await writeFile(join(tempDir, "package.json"), "{}")
      await writeFile(join(tempDir, "project", "package.json"), "{}")

      const results = await Filesystem.findUp("package.json", subDir)

      expect(results).toHaveLength(2)
      expect(results[0]).toBe(join(tempDir, "project", "package.json"))
      expect(results[1]).toBe(join(tempDir, "package.json"))
    })

    test("should respect stop parameter", async () => {
      const subDir = join(tempDir, "project", "src")
      await mkdir(subDir, { recursive: true })

      await writeFile(join(tempDir, "config.json"), "{}")
      await writeFile(join(tempDir, "project", "config.json"), "{}")

      const stopDir = join(tempDir, "project")
      const results = await Filesystem.findUp("config.json", subDir, stopDir)

      expect(results).toHaveLength(1)
      expect(results[0]).toBe(join(tempDir, "project", "config.json"))
    })

    test("should return empty array when file not found", async () => {
      const subDir = join(tempDir, "empty")
      await mkdir(subDir, { recursive: true })

      const results = await Filesystem.findUp("nonexistent.txt", subDir)
      expect(results).toHaveLength(0)
    })
  })

  describe("up generator", () => {
    test("should yield files found going up the tree", async () => {
      const subDir = join(tempDir, "deep", "nested", "path")
      await mkdir(subDir, { recursive: true })

      // Create target files
      await writeFile(join(tempDir, ".env"), "")
      await writeFile(join(tempDir, "deep", ".env"), "")
      await writeFile(join(tempDir, "deep", "nested", ".gitignore"), "")

      const found: string[] = []
      for await (const file of Filesystem.up({
        targets: [".env", ".gitignore"],
        start: subDir,
      })) {
        found.push(file)
      }

      expect(found.length).toBeGreaterThanOrEqual(3)
      expect(found).toContain(join(tempDir, "deep", "nested", ".gitignore"))
      expect(found).toContain(join(tempDir, "deep", ".env"))
      expect(found).toContain(join(tempDir, ".env"))
    })

    test("should respect stop parameter", async () => {
      const subDir = join(tempDir, "project", "src")
      await mkdir(subDir, { recursive: true })

      await writeFile(join(tempDir, "config.yml"), "")
      await writeFile(join(tempDir, "project", "config.yml"), "")

      const found: string[] = []
      const stopDir = join(tempDir, "project")

      for await (const file of Filesystem.up({
        targets: ["config.yml"],
        start: subDir,
        stop: stopDir,
      })) {
        found.push(file)
      }

      expect(found).toHaveLength(1)
      expect(found[0]).toBe(join(tempDir, "project", "config.yml"))
    })
  })

  describe("globUp", () => {
    test("should find files matching glob pattern", async () => {
      const subDir = join(tempDir, "src", "components")
      await mkdir(subDir, { recursive: true })

      // Create test files
      await writeFile(join(tempDir, "test.js"), "")
      await writeFile(join(tempDir, "app.ts"), "")
      await writeFile(join(tempDir, "src", "index.js"), "")
      await writeFile(join(tempDir, "src", "utils.ts"), "")

      const results = await Filesystem.globUp("*.js", subDir)

      expect(results.length).toBeGreaterThanOrEqual(2)
      expect(results.some((f) => f.endsWith("test.js"))).toBe(true)
      expect(results.some((f) => f.endsWith("index.js"))).toBe(true)
    })

    test("should handle invalid glob patterns gracefully", async () => {
      const subDir = join(tempDir, "test")
      await mkdir(subDir, { recursive: true })

      const results = await Filesystem.globUp("[invalid", subDir)
      expect(results).toHaveLength(0)
    })

    test("should respect stop parameter", async () => {
      const subDir = join(tempDir, "project", "src")
      await mkdir(subDir, { recursive: true })

      await writeFile(join(tempDir, "global.json"), "{}")
      await writeFile(join(tempDir, "project", "local.json"), "{}")

      const stopDir = join(tempDir, "project")
      const results = await Filesystem.globUp("*.json", subDir, stopDir)

      expect(results).toHaveLength(1)
      expect(results[0]).toBe(join(tempDir, "project", "local.json"))
    })
  })
})
