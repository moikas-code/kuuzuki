import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { TokenUtils } from "../../src/util/token-utils"
import { FileChunker } from "../../src/tool/file-chunker"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

describe("TokenUtils", () => {
  describe("estimateTokens", () => {
    it("should estimate tokens correctly for empty string", () => {
      expect(TokenUtils.estimateTokens("")).toBe(0)
    })

    it("should estimate tokens for simple text", () => {
      const text = "Hello world"
      const tokens = TokenUtils.estimateTokens(text)
      expect(tokens).toBeGreaterThan(0)
      expect(tokens).toBe(Math.ceil(text.length / 3.5))
    })

    it("should handle large text", () => {
      const text = "a".repeat(10000)
      const tokens = TokenUtils.estimateTokens(text)
      expect(tokens).toBe(Math.ceil(10000 / 3.5))
    })
  })

  describe("calculateSafeChunkSize", () => {
    it("should calculate 60% of context limit", () => {
      expect(TokenUtils.calculateSafeChunkSize(100000)).toBe(60000)
      expect(TokenUtils.calculateSafeChunkSize(200000)).toBe(120000)
    })
  })

  describe("detectContentType", () => {
    it("should detect markdown content", () => {
      const markdown = `# Header 1
## Header 2
- List item
1. Numbered item
\`\`\`javascript
code block
\`\`\``
      expect(TokenUtils.detectContentType(markdown)).toBe("markdown")
    })

    it("should detect code content", () => {
      const code = `function test() {
  return true;
}

class MyClass {
  constructor() {}
}`
      expect(TokenUtils.detectContentType(code)).toBe("code")
    })

    it("should detect JSON content", () => {
      const json = `{
  "name": "test",
  "value": 123,
  "nested": {
    "array": [1, 2, 3]
  }
}`
      expect(TokenUtils.detectContentType(json)).toBe("json")
    })

    it("should default to text for unrecognized content", () => {
      const text = "This is just plain text without any special formatting."
      expect(TokenUtils.detectContentType(text)).toBe("text")
    })
  })

  describe("findBreakPoints", () => {
    it("should find markdown headers", () => {
      const content = `# Header 1
Some content
## Header 2
More content
### Header 3
Final content`
      const breakPoints = TokenUtils.findBreakPoints(content, "markdown")
      expect(breakPoints).toContain(0) // Start
      expect(breakPoints).toContain(2) // ## Header 2
      expect(breakPoints).toContain(4) // ### Header 3
      expect(breakPoints).toContain(6) // End
    })

    it("should find code functions", () => {
      const content = `const x = 1;

function first() {
  return 1;
}

function second() {
  return 2;
}

const y = 2;`
      const breakPoints = TokenUtils.findBreakPoints(content, "code")
      expect(breakPoints).toContain(0) // Start
      expect(breakPoints).toContain(2) // function first
      expect(breakPoints).toContain(6) // function second
    })
  })
})

describe("FileChunker", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kuuzuki-test-"))
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe("chunkByTokens", () => {
    it("should chunk content by token count", () => {
      // Create multi-line content that will definitely be chunked
      const lines: string[] = []
      for (let i = 0; i < 100; i++) {
        lines.push(`This is line ${i} with some content that makes it longer`)
      }
      const content = lines.join('\n')
      const chunks = FileChunker.chunkByTokens(content, 200)
      
      expect(chunks.length).toBeGreaterThan(1)
      chunks.forEach(chunk => {
        expect(chunk.tokenCount).toBeLessThanOrEqual(200)
        expect(chunk.content.length).toBeGreaterThan(0)
      })
    })

    it("should maintain line boundaries", () => {
      const content = `Line 1
Line 2
Line 3
Line 4
Line 5`
      const chunks = FileChunker.chunkByTokens(content, 50)
      
      chunks.forEach(chunk => {
        // Each chunk should contain complete lines
        expect(chunk.content.split('\n').every(line => 
          content.split('\n').includes(line) || line === ''
        )).toBe(true)
      })
    })

    it("should set chunk metadata correctly", () => {
      const content = "test content"
      const chunks = FileChunker.chunkByTokens(content, 100)
      
      expect(chunks).toHaveLength(1)
      expect(chunks[0].chunkIndex).toBe(0)
      expect(chunks[0].totalChunks).toBe(1)
      expect(chunks[0].hasMore).toBe(false)
      expect(chunks[0].startLine).toBe(0)
      expect(chunks[0].endLine).toBe(0)
    })
  })

  describe("chunkBySections", () => {
    it("should chunk markdown by headers", () => {
      const content = `# Introduction
This is the introduction section.

## Getting Started
This section covers getting started.

### Prerequisites
You need these prerequisites.

## Advanced Topics
This covers advanced topics.`

      const chunks = FileChunker.chunkBySections(content, 1000, "markdown")
      
      expect(chunks.length).toBeGreaterThan(1)
      // Should have sections starting with headers
      expect(chunks.some(chunk => chunk.content.includes("# Introduction"))).toBe(true)
      expect(chunks.some(chunk => chunk.content.includes("## Getting Started"))).toBe(true)
    })

    it("should split large sections further", () => {
      // Create a large section that will need to be split
      const lines: string[] = [`# Large Section`]
      for (let i = 0; i < 50; i++) {
        lines.push(`This is line ${i} with substantial content that will make the section large enough to require splitting into multiple chunks.`)
      }
      const largeSection = lines.join('\n')
      
      const chunks = FileChunker.chunkBySections(largeSection, 300, "markdown")
      
      expect(chunks.length).toBeGreaterThan(1)
      chunks.forEach(chunk => {
        expect(chunk.tokenCount).toBeLessThanOrEqual(300)
      })
    })
  })

  describe("chunkFile", () => {
    it("should auto-select appropriate strategy", () => {
      const markdownContent = `# Header 1
Content here

## Header 2
More content`

      const result = FileChunker.chunkFile(markdownContent, {
        strategy: "auto",
        maxTokens: 1000
      })

      expect(result.contentType).toBe("markdown")
      expect(result.strategy).toContain("auto-sections")
      expect(result.chunks.length).toBeGreaterThan(0)
    })

    it("should calculate metadata correctly", () => {
      const content = `Line 1
Line 2
Line 3`

      const result = FileChunker.chunkFile(content, {
        strategy: "tokens",
        maxTokens: 1000
      })

      expect(result.metadata.originalLines).toBe(3)
      expect(result.metadata.averageChunkSize).toBeGreaterThan(0)
      expect(result.metadata.largestChunk).toBeGreaterThan(0)
      expect(result.metadata.smallestChunk).toBeGreaterThan(0)
    })

    it("should preserve context when requested", () => {
      const content = `Line 1
Line 2
Line 3
Line 4
Line 5
Line 6`

      const result = FileChunker.chunkFile(content, {
        strategy: "tokens",
        maxTokens: 20, // Force multiple chunks
        preserveContext: true,
        contextLines: 1
      })

      if (result.chunks.length > 1) {
        const secondChunk = result.chunks[1]
        expect(secondChunk.contextBefore).toBeDefined()
        expect(secondChunk.contextBefore?.length).toBeGreaterThan(0)
      }
    })
  })

  describe("validateChunkOptions", () => {
    it("should validate valid options", () => {
      const options: FileChunker.ChunkOptions = {
        strategy: "auto",
        maxTokens: 1000
      }
      
      const errors = FileChunker.validateChunkOptions(options)
      expect(errors).toHaveLength(0)
    })

    it("should catch invalid maxTokens", () => {
      const options: FileChunker.ChunkOptions = {
        strategy: "auto",
        maxTokens: 0
      }
      
      const errors = FileChunker.validateChunkOptions(options)
      expect(errors).toContain("maxTokens must be greater than 0")
    })

    it("should catch excessive maxTokens", () => {
      const options: FileChunker.ChunkOptions = {
        strategy: "auto",
        maxTokens: 300000
      }
      
      const errors = FileChunker.validateChunkOptions(options)
      expect(errors).toContain("maxTokens should not exceed 200000 (context limit)")
    })

    it("should catch negative contextLines", () => {
      const options: FileChunker.ChunkOptions = {
        strategy: "auto",
        maxTokens: 1000,
        contextLines: -1
      }
      
      const errors = FileChunker.validateChunkOptions(options)
      expect(errors).toContain("contextLines must be non-negative")
    })
  })

  describe("generateChunkSummary", () => {
    it("should generate markdown summary", () => {
      const chunk: FileChunker.FileChunk = {
        content: `# Introduction
## Getting Started
Some content here`,
        startLine: 0,
        endLine: 2,
        tokenCount: 50,
        chunkIndex: 0,
        totalChunks: 1,
        hasMore: false
      }

      const summary = FileChunker.generateChunkSummary(chunk, "markdown")
      expect(summary).toContain("sections")
      expect(summary).toContain("Introduction")
      expect(summary).toContain("Getting Started")
    })

    it("should generate code summary", () => {
      const chunk: FileChunker.FileChunk = {
        content: `function test() {
  return true;
}

class MyClass {
  constructor() {}
}`,
        startLine: 0,
        endLine: 6,
        tokenCount: 80,
        chunkIndex: 0,
        totalChunks: 1,
        hasMore: false
      }

      const summary = FileChunker.generateChunkSummary(chunk, "code")
      expect(summary).toContain("definitions")
      expect(summary).toContain("test")
      expect(summary).toContain("MyClass")
    })

    it("should generate generic summary for text", () => {
      const chunk: FileChunker.FileChunk = {
        content: "Just some plain text content",
        startLine: 0,
        endLine: 0,
        tokenCount: 20,
        chunkIndex: 0,
        totalChunks: 1,
        hasMore: false
      }

      const summary = FileChunker.generateChunkSummary(chunk, "text")
      expect(summary).toContain("lines of text content")
    })
  })
})