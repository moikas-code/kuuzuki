import { z } from "zod"
import * as fs from "fs"
import * as path from "path"
import { Tool } from "./tool"
import { LSP } from "../lsp"
import { FileTime } from "../file/time"
import DESCRIPTION from "./read.txt"
import { App } from "../app/app"
import { TokenUtils } from "../util/token-utils"
import { FileChunker } from "./file-chunker"
import { Provider } from "../provider/provider"

const DEFAULT_READ_LIMIT = 2000
const MAX_LINE_LENGTH = 2000
const DEFAULT_CONTEXT_LIMIT = 200000 // Conservative default

export const ReadTool = Tool.define("read", {
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("The path to the file to read"),
    offset: z.number().describe("The line number to start reading from (0-based)").optional(),
    limit: z.number().describe("The number of lines to read (defaults to 2000)").optional(),
    
    // New chunking parameters
    chunkStrategy: z.enum(["auto", "lines", "sections", "tokens"])
      .describe("Strategy for handling large files: auto (smart choice), lines (by line count), sections (by headers/functions), tokens (by token count)")
      .optional(),
    maxTokens: z.number()
      .describe("Maximum tokens per chunk (defaults to 60% of context limit)")
      .optional(),
    chunkIndex: z.number()
      .describe("Specific chunk to read (0-based, use with chunked files)")
      .optional(),
    showSummary: z.boolean()
      .describe("Show file summary and chunk information for large files")
      .optional(),
    preserveContext: z.boolean()
      .describe("Include context lines from adjacent chunks")
      .optional(),
  }),
  async execute(params, ctx) {
    let filePath = params.filePath
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(process.cwd(), filePath)
    }

    const file = Bun.file(filePath)
    if (!(await file.exists())) {
      const dir = path.dirname(filePath)
      const base = path.basename(filePath)

      const dirEntries = fs.readdirSync(dir)
      const suggestions = dirEntries
        .filter(
          (entry) =>
            entry.toLowerCase().includes(base.toLowerCase()) || base.toLowerCase().includes(entry.toLowerCase()),
        )
        .map((entry) => path.join(dir, entry))
        .slice(0, 3)

      if (suggestions.length > 0) {
        throw new Error(`File not found: ${filePath}\n\nDid you mean one of these?\n${suggestions.join("\n")}`)
      }

      throw new Error(`File not found: ${filePath}`)
    }

    const isImage = isImageFile(filePath)
    if (isImage) throw new Error(`This is an image file of type: ${isImage}\nUse a different tool to process images`)
    
    const isBinary = await isBinaryFile(file)
    if (isBinary) throw new Error(`Cannot read binary file: ${filePath}`)
    
    const fileContent = await file.text()
    const estimatedTokens = TokenUtils.estimateTokens(fileContent)
    
    // Get context limit from current session or use default
    let contextLimit = DEFAULT_CONTEXT_LIMIT
    try {
      // Try to get the current model's context limit
      const defaultModel = await Provider.defaultModel()
      const model = await Provider.getModel(defaultModel.providerID, defaultModel.modelID)
      contextLimit = model.info.limit.context || DEFAULT_CONTEXT_LIMIT
    } catch {
      // Use default if we can't get model info
    }
    
    const safeLimit = TokenUtils.calculateSafeChunkSize(contextLimit)
    
    // Check if file needs chunking
    if (estimatedTokens > safeLimit && !params.offset && !params.limit) {
      return handleLargeFile(fileContent, filePath, params, ctx, estimatedTokens, contextLimit)
    }
    
    // Standard processing for small files or when specific offset/limit is requested
    return processStandardFile(fileContent, filePath, params, ctx)
  },
})

/**
 * Handle large files that exceed token limits
 */
async function handleLargeFile(
  content: string, 
  filePath: string, 
  params: any, 
  ctx: any, 
  estimatedTokens: number, 
  contextLimit: number
) {
  const maxTokens = params.maxTokens || TokenUtils.calculateSafeChunkSize(contextLimit)
  const chunkStrategy = params.chunkStrategy || 'auto'
  
  // Validate chunk options
  const chunkOptions: FileChunker.ChunkOptions = {
    strategy: chunkStrategy,
    maxTokens,
    preserveContext: params.preserveContext || false,
    contextLines: 3
  }
  
  const validationErrors = FileChunker.validateChunkOptions(chunkOptions)
  if (validationErrors.length > 0) {
    throw new Error(`Invalid chunk options: ${validationErrors.join(', ')}`)
  }
  
  // Chunk the file
  const chunkResult = FileChunker.chunkFile(content, chunkOptions)
  
  // If user wants summary or file info
  if (params.showSummary) {
    return generateFileSummary(filePath, chunkResult, estimatedTokens, contextLimit)
  }
  
  // If user wants a specific chunk
  if (params.chunkIndex !== undefined) {
    const chunkIndex = params.chunkIndex
    if (chunkIndex < 0 || chunkIndex >= chunkResult.chunks.length) {
      throw new Error(`Invalid chunk index ${chunkIndex}. File has ${chunkResult.chunks.length} chunks (0-${chunkResult.chunks.length - 1})`)
    }
    
    return formatChunk(chunkResult.chunks[chunkIndex], filePath, chunkResult, ctx)
  }
  
  // Default: return first chunk with navigation info
  const firstChunk = chunkResult.chunks[0]
  return formatChunk(firstChunk, filePath, chunkResult, ctx)
}

/**
 * Process files using standard method (small files or specific offset/limit)
 */
async function processStandardFile(content: string, filePath: string, params: any, ctx: any) {
  const lines = content.split("\n")
  const limit = params.limit ?? DEFAULT_READ_LIMIT
  const offset = params.offset || 0
  
  const raw = lines.slice(offset, offset + limit).map((line) => {
    return line.length > MAX_LINE_LENGTH ? line.substring(0, MAX_LINE_LENGTH) + "..." : line
  })
  
  const formattedContent = raw.map((line, index) => {
    return `${(index + offset + 1).toString().padStart(5, "0")}| ${line}`
  })
  
  const preview = raw.slice(0, 20).join("\n")
  const contentType = TokenUtils.detectContentType(content)

  let output = "<file>\n"
  output += formattedContent.join("\n")

  if (lines.length > offset + formattedContent.length) {
    output += `\n\n(File has more lines. Use 'offset' parameter to read beyond line ${offset + formattedContent.length})`
  }
  output += "\n</file>"

  // Warm the LSP client and track file access (optional - may not be available in all contexts)
  try {
    LSP.touchFile(filePath, false)
    FileTime.read(ctx.sessionID, filePath)
  } catch {
    // LSP and FileTime not available in this context, continue without them
  }
  
  // Get relative path, fallback to basename if App context not available
  let title: string
  try {
    title = path.relative(App.info().path.root, filePath)
  } catch {
    title = path.basename(filePath)
  }
  
  return {
    title,
    output,
    metadata: {
      fileSize: TokenUtils.estimateTokens(content),
      chunkCount: 1,
      contentType,
      strategy: 'standard',
      isChunked: false,
      isSummary: false,
      preview,
    },
  }
}

/**
 * Generate a summary for large files
 */
function generateFileSummary(
  filePath: string, 
  chunkResult: FileChunker.ChunkResult, 
  estimatedTokens: number, 
  contextLimit: number
) {
  const fileName = path.basename(filePath)
  const { chunks, contentType, strategy, metadata } = chunkResult
  
  let output = `📄 **${fileName}** - Large File Summary\n\n`
  output += `**File Information:**\n`
  output += `• Size: ${metadata.originalLines} lines (~${estimatedTokens.toLocaleString()} tokens)\n`
  output += `• Content Type: ${contentType}\n`
  output += `• Context Limit: ${contextLimit.toLocaleString()} tokens\n`
  output += `• Safe Chunk Size: ${TokenUtils.calculateSafeChunkSize(contextLimit).toLocaleString()} tokens\n\n`
  
  output += `**Chunking Strategy:** ${strategy}\n`
  output += `• Total Chunks: ${chunks.length}\n`
  output += `• Average Chunk Size: ${metadata.averageChunkSize.toLocaleString()} tokens\n`
  output += `• Largest Chunk: ${metadata.largestChunk.toLocaleString()} tokens\n`
  output += `• Smallest Chunk: ${metadata.smallestChunk.toLocaleString()} tokens\n\n`
  
  output += `**Available Chunks:**\n`
  chunks.forEach((chunk, index) => {
    const summary = FileChunker.generateChunkSummary(chunk, contentType)
    output += `${index}: Lines ${chunk.startLine + 1}-${chunk.endLine + 1} (${chunk.tokenCount.toLocaleString()} tokens) - ${summary}\n`
  })
  
  output += `\n**Usage:**\n`
  output += `• Read specific chunk: \`chunkIndex=0\` (0-${chunks.length - 1})\n`
  output += `• Change strategy: \`chunkStrategy=sections|tokens|lines\`\n`
  output += `• Adjust chunk size: \`maxTokens=30000\`\n`
  output += `• Add context: \`preserveContext=true\`\n`
  
  return {
    title: `${fileName} (Summary)`,
    output,
    metadata: {
      fileSize: estimatedTokens,
      chunkCount: chunks.length,
      contentType,
      strategy,
      isChunked: true,
      isSummary: true
    }
  }
}

/**
 * Format a single chunk for display
 */
function formatChunk(
  chunk: FileChunker.FileChunk, 
  filePath: string, 
  chunkResult: FileChunker.ChunkResult, 
  ctx: any
) {
  const fileName = path.basename(filePath)
  let output = ""
  
  // Chunk header
  output += `📄 **${fileName}** (Chunk ${chunk.chunkIndex + 1} of ${chunk.totalChunks})\n`
  output += `Lines ${chunk.startLine + 1}-${chunk.endLine + 1} | ~${chunk.tokenCount.toLocaleString()} tokens | Strategy: ${chunkResult.strategy}\n\n`
  
  // Context before (if available)
  if (chunk.contextBefore) {
    output += `<context-before>\n${chunk.contextBefore}\n</context-before>\n\n`
  }
  
  // Main content
  output += `<file>\n`
  const lines = chunk.content.split('\n')
  const formattedLines = lines.map((line, index) => {
    const lineNumber = chunk.startLine + index + 1
    const truncatedLine = line.length > MAX_LINE_LENGTH ? line.substring(0, MAX_LINE_LENGTH) + "..." : line
    return `${lineNumber.toString().padStart(5, "0")}| ${truncatedLine}`
  })
  output += formattedLines.join('\n')
  output += `\n</file>`
  
  // Context after (if available)
  if (chunk.contextAfter) {
    output += `\n\n<context-after>\n${chunk.contextAfter}\n</context-after>`
  }
  
  // Navigation info
  if (chunk.totalChunks > 1) {
    output += `\n\n**Navigation:**\n`
    if (chunk.chunkIndex > 0) {
      output += `• Previous chunk: \`chunkIndex=${chunk.chunkIndex - 1}\`\n`
    }
    if (chunk.hasMore) {
      output += `• Next chunk: \`chunkIndex=${chunk.chunkIndex + 1}\`\n`
    }
    output += `• Show all chunks: \`showSummary=true\`\n`
    output += `• Jump to chunk: \`chunkIndex=N\` (0-${chunk.totalChunks - 1})\n`
  }
  
  // Warm the LSP client and track file access (optional - may not be available in all contexts)
  try {
    LSP.touchFile(filePath, false)
    FileTime.read(ctx.sessionID, filePath)
  } catch {
    // LSP and FileTime not available in this context, continue without them
  }

  return {
    title: `${fileName} (${chunk.chunkIndex + 1}/${chunk.totalChunks})`,
    output,
    metadata: {
      fileSize: chunk.tokenCount,
      chunkCount: chunk.totalChunks,
      contentType: chunkResult.contentType,
      strategy: chunkResult.strategy,
      isChunked: true,
      isSummary: false,
      chunkIndex: chunk.chunkIndex,
      hasMore: chunk.hasMore
    }
  }
}

function isImageFile(filePath: string): string | false {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "JPEG"
    case ".png":
      return "PNG"
    case ".gif":
      return "GIF"
    case ".bmp":
      return "BMP"
    case ".svg":
      return "SVG"
    case ".webp":
      return "WebP"
    default:
      return false
  }
}

async function isBinaryFile(file: Bun.BunFile): Promise<boolean> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer.slice(0, 512)) // Check first 512 bytes

  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) return true // Null byte indicates binary
  }

  return false
}
