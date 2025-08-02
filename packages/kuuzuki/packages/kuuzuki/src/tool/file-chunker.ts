import { TokenUtils } from "../util/token-utils"

export namespace FileChunker {
  export interface ChunkOptions {
    strategy: 'auto' | 'lines' | 'sections' | 'tokens'
    maxTokens: number
    preserveContext?: boolean
    contextLines?: number
  }

  export interface FileChunk {
    content: string
    startLine: number
    endLine: number
    tokenCount: number
    chunkIndex: number
    totalChunks: number
    hasMore: boolean
    summary?: string
    contextBefore?: string
    contextAfter?: string
  }

  export interface ChunkResult {
    chunks: FileChunk[]
    totalTokens: number
    contentType: 'markdown' | 'code' | 'json' | 'text'
    strategy: string
    metadata: {
      originalLines: number
      averageChunkSize: number
      largestChunk: number
      smallestChunk: number
    }
  }

  /**
   * Main entry point for chunking files
   */
  export function chunkFile(content: string, options: ChunkOptions): ChunkResult {
    const contentType = TokenUtils.detectContentType(content)
    const totalTokens = TokenUtils.estimateTokens(content)
    
    let chunks: FileChunk[]
    let strategyUsed: string
    
    switch (options.strategy) {
      case 'tokens':
        chunks = chunkByTokens(content, options.maxTokens)
        strategyUsed = 'tokens'
        break
      case 'sections':
        chunks = chunkBySections(content, options.maxTokens, contentType)
        strategyUsed = 'sections'
        break
      case 'lines':
        chunks = chunkByLines(content, options.maxTokens)
        strategyUsed = 'lines'
        break
      case 'auto':
      default:
        const result = autoChunk(content, options.maxTokens, contentType)
        chunks = result.chunks
        strategyUsed = result.strategy
        break
    }

    // Add context if requested
    if (options.preserveContext) {
      chunks = addContextToChunks(chunks, content, options.contextLines || 3)
    }

    // Calculate metadata
    const chunkSizes = chunks.map(c => c.tokenCount)
    const metadata = {
      originalLines: content.split('\n').length,
      averageChunkSize: Math.round(chunkSizes.reduce((a, b) => a + b, 0) / chunks.length),
      largestChunk: Math.max(...chunkSizes),
      smallestChunk: Math.min(...chunkSizes)
    }

    return {
      chunks,
      totalTokens,
      contentType,
      strategy: strategyUsed,
      metadata
    }
  }

  /**
   * Automatically choose the best chunking strategy based on content
   */
  function autoChunk(content: string, maxTokens: number, contentType: 'markdown' | 'code' | 'json' | 'text'): {
    chunks: FileChunk[]
    strategy: string
  } {
    switch (contentType) {
      case 'markdown':
        return {
          chunks: chunkBySections(content, maxTokens, contentType),
          strategy: 'auto-sections (markdown)'
        }
      case 'code':
        return {
          chunks: chunkBySections(content, maxTokens, contentType),
          strategy: 'auto-sections (code)'
        }
      case 'json':
        return {
          chunks: chunkByTokens(content, maxTokens), // JSON is hard to section
          strategy: 'auto-tokens (json)'
        }
      default:
        return {
          chunks: chunkByTokens(content, maxTokens),
          strategy: 'auto-tokens (text)'
        }
    }
  }

  /**
   * Chunk by token count with smart line boundaries
   */
  export function chunkByTokens(content: string, maxTokens: number): FileChunk[] {
    const lines = content.split('\n')
    const chunks: FileChunk[] = []
    let currentChunk = ''
    let currentTokens = 0
    let startLine = 0
    let currentLine = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineTokens = TokenUtils.estimateTokens(line + '\n')
      
      // If adding this line would exceed the limit and we have content
      if (currentTokens + lineTokens > maxTokens && currentChunk) {
        chunks.push(createChunk(
          currentChunk.trim(),
          startLine,
          currentLine - 1,
          currentTokens,
          chunks.length,
          0 // Will be set later
        ))
        
        currentChunk = line
        currentTokens = lineTokens
        startLine = i
        currentLine = i + 1
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line
        currentTokens += lineTokens
        currentLine = i + 1
      }
    }

    // Add the last chunk if there's content
    if (currentChunk.trim()) {
      chunks.push(createChunk(
        currentChunk.trim(),
        startLine,
        currentLine - 1,
        currentTokens,
        chunks.length,
        0
      ))
    }

    // Update total chunks count
    chunks.forEach(chunk => {
      chunk.totalChunks = chunks.length
      chunk.hasMore = chunk.chunkIndex < chunks.length - 1
    })

    return chunks
  }

  /**
   * Chunk by natural sections (headers, functions, etc.)
   */
  export function chunkBySections(content: string, maxTokens: number, contentType: 'markdown' | 'code' | 'json' | 'text'): FileChunk[] {
    const lines = content.split('\n')
    const breakPoints = TokenUtils.findBreakPoints(content, contentType)
    const chunks: FileChunk[] = []
    
    for (let i = 0; i < breakPoints.length - 1; i++) {
      const startLine = breakPoints[i]
      const endLine = breakPoints[i + 1] - 1
      const sectionContent = lines.slice(startLine, endLine + 1).join('\n')
      const sectionTokens = TokenUtils.estimateTokens(sectionContent)
      
      // If section is too large, split it further
      if (sectionTokens > maxTokens) {
        const subChunks = chunkByTokens(sectionContent, maxTokens)
        subChunks.forEach((subChunk) => {
          chunks.push({
            ...subChunk,
            startLine: startLine + subChunk.startLine,
            endLine: startLine + subChunk.endLine,
            chunkIndex: chunks.length,
            totalChunks: 0, // Will be set later
            hasMore: false // Will be set later
          })
        })
      } else {
        chunks.push(createChunk(
          sectionContent,
          startLine,
          endLine,
          sectionTokens,
          chunks.length,
          0
        ))
      }
    }

    // Update total chunks count
    chunks.forEach(chunk => {
      chunk.totalChunks = chunks.length
      chunk.hasMore = chunk.chunkIndex < chunks.length - 1
    })

    return chunks
  }

  /**
   * Chunk by line count (legacy method)
   */
  export function chunkByLines(content: string, maxTokens: number): FileChunk[] {
    const lines = content.split('\n')
    const chunks: FileChunk[] = []
    
    // Estimate lines per chunk based on average line length
    const avgLineTokens = TokenUtils.estimateTokens(content) / lines.length
    const linesPerChunk = Math.floor(maxTokens / avgLineTokens)
    
    for (let i = 0; i < lines.length; i += linesPerChunk) {
      const endLine = Math.min(i + linesPerChunk - 1, lines.length - 1)
      const chunkContent = lines.slice(i, endLine + 1).join('\n')
      const chunkTokens = TokenUtils.estimateTokens(chunkContent)
      
      chunks.push(createChunk(
        chunkContent,
        i,
        endLine,
        chunkTokens,
        chunks.length,
        0
      ))
    }

    // Update total chunks count
    chunks.forEach(chunk => {
      chunk.totalChunks = chunks.length
      chunk.hasMore = chunk.chunkIndex < chunks.length - 1
    })

    return chunks
  }

  /**
   * Add context lines before and after each chunk
   */
  function addContextToChunks(chunks: FileChunk[], originalContent: string, contextLines: number): FileChunk[] {
    const allLines = originalContent.split('\n')
    
    return chunks.map(chunk => {
      const contextBefore = chunk.startLine > 0 
        ? allLines.slice(Math.max(0, chunk.startLine - contextLines), chunk.startLine).join('\n')
        : ''
      
      const contextAfter = chunk.endLine < allLines.length - 1
        ? allLines.slice(chunk.endLine + 1, Math.min(allLines.length, chunk.endLine + 1 + contextLines)).join('\n')
        : ''
      
      return {
        ...chunk,
        contextBefore: contextBefore || undefined,
        contextAfter: contextAfter || undefined
      }
    })
  }

  /**
   * Create a standardized chunk object
   */
  function createChunk(
    content: string,
    startLine: number,
    endLine: number,
    tokenCount: number,
    chunkIndex: number,
    totalChunks: number
  ): FileChunk {
    return {
      content,
      startLine,
      endLine,
      tokenCount,
      chunkIndex,
      totalChunks,
      hasMore: chunkIndex < totalChunks - 1
    }
  }

  /**
   * Generate a summary for a chunk or entire file
   */
  export function generateChunkSummary(chunk: FileChunk, contentType: 'markdown' | 'code' | 'json' | 'text'): string {
    const lines = chunk.content.split('\n')
    const lineCount = lines.length
    
    switch (contentType) {
      case 'markdown':
        const headers = lines.filter(line => /^#{1,6}\s+/.test(line))
        return headers.length > 0 
          ? `${headers.length} sections: ${headers.slice(0, 3).map(h => h.replace(/^#+\s*/, '')).join(', ')}${headers.length > 3 ? '...' : ''}`
          : `${lineCount} lines of markdown content`
          
      case 'code':
        const functions = lines.filter(line => /^\s*(function|def|fn|class|interface)\s+/.test(line))
        return functions.length > 0
          ? `${functions.length} definitions: ${functions.slice(0, 2).map(f => f.trim().split(/\s+/)[1]).join(', ')}${functions.length > 2 ? '...' : ''}`
          : `${lineCount} lines of code`
          
      case 'json':
        return `JSON data (${lineCount} lines, ~${chunk.tokenCount} tokens)`
        
      default:
        return `${lineCount} lines of text content`
    }
  }

  /**
   * Validate chunk options
   */
  export function validateChunkOptions(options: ChunkOptions): string[] {
    const errors: string[] = []
    
    if (options.maxTokens <= 0) {
      errors.push('maxTokens must be greater than 0')
    }
    
    if (options.maxTokens > 200000) {
      errors.push('maxTokens should not exceed 200000 (context limit)')
    }
    
    if (options.contextLines && options.contextLines < 0) {
      errors.push('contextLines must be non-negative')
    }
    
    return errors
  }
}