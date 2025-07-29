// KV Storage type definitions for Cloudflare Workers and compatible environments
export interface KVNamespace {
  get(key: string): Promise<string | null>
  get(key: string, options: { type: "text" }): Promise<string | null>
  get(key: string, options: { type: "json" }): Promise<any>
  get(key: string, options: { type: "arrayBuffer" }): Promise<ArrayBuffer | null>
  get(key: string, options: { type: "stream" }): Promise<ReadableStream | null>
  
  put(key: string, value: string | ArrayBuffer | ReadableStream): Promise<void>
  put(key: string, value: string | ArrayBuffer | ReadableStream, options: {
    expiration?: number
    expirationTtl?: number
    metadata?: Record<string, any>
  }): Promise<void>
  
  delete(key: string): Promise<void>
  
  list(): Promise<{ keys: { name: string; expiration?: number; metadata?: Record<string, any> }[] }>
  list(options: {
    prefix?: string
    limit?: number
    cursor?: string
  }): Promise<{ keys: { name: string; expiration?: number; metadata?: Record<string, any> }[]; list_complete: boolean; cursor?: string }>
  
  getWithMetadata(key: string): Promise<{ value: string | null; metadata: any }>
  getWithMetadata(key: string, options: { type: "text" }): Promise<{ value: string | null; metadata: any }>
  getWithMetadata(key: string, options: { type: "json" }): Promise<{ value: any; metadata: any }>
  getWithMetadata(key: string, options: { type: "arrayBuffer" }): Promise<{ value: ArrayBuffer | null; metadata: any }>
  getWithMetadata(key: string, options: { type: "stream" }): Promise<{ value: ReadableStream | null; metadata: any }>
  
  putWithMetadata(key: string, value: string | ArrayBuffer | ReadableStream, metadata: Record<string, any>): Promise<void>
}

// Global declaration for environments that provide KVNamespace globally
declare global {
  interface KVNamespace extends KVNamespace {}
}