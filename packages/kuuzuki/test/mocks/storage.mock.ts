/**
 * Mock Storage implementation for testing
 * Provides in-memory storage that mimics the real Storage module
 */
export class MockStorage {
  private static instance: MockStorage
  private data: Map<string, any> = new Map()
  private directories: Set<string> = new Set()

  static getInstance(): MockStorage {
    if (!MockStorage.instance) {
      MockStorage.instance = new MockStorage()
    }
    return MockStorage.instance
  }

  static reset(): void {
    if (MockStorage.instance) {
      MockStorage.instance.data.clear()
      MockStorage.instance.directories.clear()
    }
  }

  async readJSON<T>(key: string): Promise<T | null> {
    const value = this.data.get(key)
    if (value === undefined) {
      throw new Error(`ENOENT: no such file or directory, open '${key}'`)
    }
    return value as T
  }

  async writeJSON(key: string, value: any): Promise<void> {
    // Extract directory path
    const parts = key.split("/")
    if (parts.length > 1) {
      const dir = parts.slice(0, -1).join("/")
      this.directories.add(dir)

      // Add all parent directories
      for (let i = 1; i < parts.length - 1; i++) {
        this.directories.add(parts.slice(0, i).join("/"))
      }
    }

    this.data.set(key, JSON.parse(JSON.stringify(value))) // Deep clone
  }

  async list(prefix: string): Promise<string[]> {
    const results: string[] = []

    // Remove trailing slash
    const normalizedPrefix = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix

    // Find all keys that start with the prefix
    for (const key of this.data.keys()) {
      if (key.startsWith(normalizedPrefix + "/")) {
        // Get the relative path from the prefix
        const relativePath = key.slice(normalizedPrefix.length + 1)

        // Only include direct children (no nested paths)
        if (!relativePath.includes("/")) {
          results.push(key)
        }
      }
    }

    results.sort()
    return results
  }

  async remove(key: string): Promise<void> {
    this.data.delete(key)
  }

  async removeDir(prefix: string): Promise<void> {
    const keysToDelete: string[] = []

    for (const key of this.data.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.data.delete(key)
    }

    // Remove directory entries
    const dirsToDelete: string[] = []
    for (const dir of this.directories) {
      if (dir.startsWith(prefix)) {
        dirsToDelete.push(dir)
      }
    }

    for (const dir of dirsToDelete) {
      this.directories.delete(dir)
    }
  }

  // Helper methods for testing
  getAllData(): Map<string, any> {
    return new Map(this.data)
  }

  hasKey(key: string): boolean {
    return this.data.has(key)
  }

  getKeyCount(): number {
    return this.data.size
  }
}

// Export a singleton instance that matches the Storage namespace pattern
export const Storage = {
  readJSON: <T>(key: string) => MockStorage.getInstance().readJSON<T>(key),
  writeJSON: (key: string, value: any) => MockStorage.getInstance().writeJSON(key, value),
  list: (prefix: string) => MockStorage.getInstance().list(prefix),
  remove: (key: string) => MockStorage.getInstance().remove(key),
  removeDir: (prefix: string) => MockStorage.getInstance().removeDir(prefix),
}
