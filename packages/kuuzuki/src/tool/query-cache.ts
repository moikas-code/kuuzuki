/**
 * Query result caching system for improved performance
 * Implements LRU cache with TTL support
 */
export class QueryCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize: number = 100, defaultTTL: number = 300000) {
    // 5 minutes default
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get cached result if valid
   */
  get<T>(key: string, ttl?: number): T | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    const effectiveTTL = ttl || this.defaultTTL;
    const isExpired = Date.now() - entry.timestamp > effectiveTTL;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data as T;
  }

  /**
   * Cache a result
   */
  set<T>(key: string, data: T): void {
    // Remove oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove expired entries
   */
  cleanup(): number {
    let removed = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.defaultTTL) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need hit/miss tracking
      oldestEntry: this.getOldestEntryAge(),
    };
  }

  /**
   * Get age of oldest entry in milliseconds
   */
  private getOldestEntryAge(): number {
    if (this.cache.size === 0) return 0;

    const now = Date.now();
    let oldest = now;

    for (const entry of this.cache.values()) {
      if (entry.timestamp < oldest) {
        oldest = entry.timestamp;
      }
    }

    return now - oldest;
  }

  /**
   * Generate cache key from parameters
   */
  static generateKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}:${JSON.stringify(params[key])}`)
      .join("|");

    return `${prefix}:${sortedParams}`;
  }
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

interface CacheStats {
  size: number;
  maxSize: number;
  hitRate: number;
  oldestEntry: number;
}
