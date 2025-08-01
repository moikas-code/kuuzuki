import * as path from "path"

export namespace TokenUtils {
  /**
   * Estimates token count for text content
   * Uses rough approximation: 1 token ≈ 3.5 characters for English text
   * This matches the estimation used in session/index.ts
   */
  export function estimateTokens(text: string): number {
    if (!text) return 0
    // More accurate estimation accounting for whitespace and punctuation
    return Math.ceil(text.length / 3.5)
  }

  /**
   * Estimates token count for a file without loading it entirely into memory
   */
  export async function estimateFileTokens(filePath: string): Promise<number> {
    const file = Bun.file(filePath)
    if (!(await file.exists())) {
      throw new Error(`File not found: ${filePath}`)
    }
    
    const text = await file.text()
    return estimateTokens(text)
  }

  /**
   * Calculates a safe chunk size based on context limit
   * Uses conservative 60% of context limit to leave room for system prompts and output
   */
  export function calculateSafeChunkSize(contextLimit: number): number {
    return Math.floor(contextLimit * 0.6)
  }

  /**
   * Detects the content type of text to inform chunking strategy
   */
  export function detectContentType(content: string): 'markdown' | 'code' | 'json' | 'text' {
    const lines = content.split('\n').slice(0, 50) // Check first 50 lines
    
    // Check for markdown indicators
    const markdownIndicators = [
      /^#{1,6}\s+/, // Headers
      /^\s*[-*+]\s+/, // Lists
      /^\s*\d+\.\s+/, // Numbered lists
      /```/, // Code blocks
      /^\s*\|.*\|/, // Tables
    ]
    
    const markdownCount = lines.filter(line => 
      markdownIndicators.some(pattern => pattern.test(line))
    ).length
    
    if (markdownCount > lines.length * 0.1) {
      return 'markdown'
    }
    
    // Check for JSON
    const trimmed = content.trim()
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(trimmed)
        return 'json'
      } catch {
        // Not valid JSON, continue checking
      }
    }
    
    // Check for code indicators
    const codeIndicators = [
      /^\s*(function|class|interface|type|const|let|var|import|export)\s+/,
      /^\s*(def|class|import|from)\s+/, // Python
      /^\s*(public|private|protected|static)\s+/, // Java/C#
      /^\s*#include\s+/, // C/C++
      /^\s*(fn|struct|impl|use)\s+/, // Rust
    ]
    
    const codeCount = lines.filter(line => 
      codeIndicators.some(pattern => pattern.test(line))
    ).length
    
    if (codeCount > lines.length * 0.05) {
      return 'code'
    }
    
    return 'text'
  }

  /**
   * Detects natural break points in content for better chunking
   */
  export function findBreakPoints(content: string, contentType: 'markdown' | 'code' | 'json' | 'text'): number[] {
    const lines = content.split('\n')
    const breakPoints: number[] = [0] // Always include start
    
    switch (contentType) {
      case 'markdown':
        // Break at headers
        lines.forEach((line, index) => {
          if (/^#{1,6}\s+/.test(line)) {
            breakPoints.push(index)
          }
        })
        break
        
      case 'code':
        // Break at function/class definitions
        lines.forEach((line, index) => {
          if (/^\s*(function|class|interface|type|def|fn|struct)\s+/.test(line)) {
            breakPoints.push(index)
          }
        })
        break
        
      case 'json':
        // For JSON, break at top-level objects/arrays
        let braceLevel = 0
        let inString = false
        let escaped = false
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          for (let j = 0; j < line.length; j++) {
            const char = line[j]
            
            if (escaped) {
              escaped = false
              continue
            }
            
            if (char === '\\') {
              escaped = true
              continue
            }
            
            if (char === '"') {
              inString = !inString
              continue
            }
            
            if (!inString) {
              if (char === '{' || char === '[') {
                braceLevel++
              } else if (char === '}' || char === ']') {
                braceLevel--
                if (braceLevel === 1) {
                  breakPoints.push(i + 1)
                }
              }
            }
          }
        }
        break
        
      case 'text':
      default:
        // Break at paragraph boundaries (double newlines)
        for (let i = 1; i < lines.length - 1; i++) {
          if (lines[i].trim() === '' && lines[i - 1].trim() !== '' && lines[i + 1].trim() !== '') {
            breakPoints.push(i + 1)
          }
        }
        break
    }
    
    // Always include end
    breakPoints.push(lines.length)
    
    // Remove duplicates and sort
    return [...new Set(breakPoints)].sort((a, b) => a - b)
  }

  /**
   * Validates that a chunk size is reasonable
   */
  export function validateChunkSize(chunkTokens: number, maxTokens: number): boolean {
    return chunkTokens > 0 && chunkTokens <= maxTokens
  }

  /**
   * Estimates processing time for a file based on size
   */
  export function estimateProcessingTime(tokenCount: number): number {
    // Rough estimate: 1000 tokens per second processing
    return Math.ceil(tokenCount / 1000)
  }

  /**
   * Gets file extension for content type hints
   */
  export function getFileExtension(filePath: string): string {
    return path.extname(filePath).toLowerCase()
  }

  /**
   * Determines if a file is likely to be large based on extension
   */
  export function isLikelyLargeFile(filePath: string): boolean {
    const ext = getFileExtension(filePath)
    const largeFileExtensions = [
      '.md', '.txt', '.log', '.json', '.xml', '.csv', 
      '.sql', '.html', '.css', '.js', '.ts', '.py'
    ]
    return largeFileExtensions.includes(ext)
  }
}