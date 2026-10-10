/**
 * In-Memory Cache-Aside Engine for FairPitch
 * 
 * Provides fast, sub-millisecond in-process caching with:
 * - TTL (Time-To-Live) expiration
 * - Tag-based invalidation (e.g. invalidate all entries for event:xxx)
 * - Size-bounded eviction (prevents unbounded memory growth)
 * - Cache-aside helper (getOrSet)
 * - Standard HTTP Cache-Control header generators
 * 
 * Financial Cost: $0.00 (Zero external services required)
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
  tags: string[]
}

const MAX_CACHE_ENTRIES = 2000

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>()
  private tagIndex = new Map<string, Set<string>>()

  /**
   * Retrieves an item from the cache. Returns undefined if missing or expired.
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    if (Date.now() > entry.expiresAt) {
      this.invalidate(key)
      return undefined
    }

    return entry.value as T
  }

  /**
   * Stores an item with a time-to-live in seconds and optional invalidation tags.
   */
  set<T>(key: string, value: T, ttlSeconds: number, tags: string[] = []): void {
    // Evict oldest entries if capacity is reached
    if (this.cache.size >= MAX_CACHE_ENTRIES && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) this.invalidate(oldestKey)
    }

    const expiresAt = Date.now() + ttlSeconds * 1000
    this.cache.set(key, { value, expiresAt, tags })

    // Index tags for quick invalidation
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set())
      }
      this.tagIndex.get(tag)!.add(key)
    }
  }

  /**
   * Cache-aside pattern: Checks cache first, falls back to fetcher on miss,
   * stores result with TTL, and returns it.
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number,
    tags: string[] = []
  ): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== undefined) {
      return cached
    }

    const fresh = await fetcher()
    if (fresh !== null && fresh !== undefined) {
      this.set(key, fresh, ttlSeconds, tags)
    }
    return fresh
  }

  /**
   * Invalidates a specific cache key.
   */
  invalidate(key: string): void {
    const entry = this.cache.get(key)
    if (entry) {
      for (const tag of entry.tags) {
        this.tagIndex.get(tag)?.delete(key)
      }
      this.cache.delete(key)
    }
  }

  /**
   * Invalidates all keys associated with a specific tag (e.g. "rubric:eventId", "event:eventId").
   */
  invalidateTag(tag: string): void {
    const keys = this.tagIndex.get(tag)
    if (keys) {
      for (const key of Array.from(keys)) {
        this.cache.delete(key)
      }
      this.tagIndex.delete(tag)
    }
  }

  /**
   * Clears entire cache.
   */
  clear(): void {
    this.cache.clear()
    this.tagIndex.clear()
  }

  /**
   * Returns current count of cached items.
   */
  size(): number {
    return this.cache.size
  }
}

// Global singleton across serverless invocations within the same container
export const memoryCache = new MemoryCache()

/**
 * Returns HTTP Cache-Control headers for public responses (Vercel CDN + Browser).
 */
export function publicCacheHeaders(sMaxAgeSeconds: number, staleWhileRevalidateSeconds?: number) {
  const swr = staleWhileRevalidateSeconds
    ? `, stale-while-revalidate=${staleWhileRevalidateSeconds}`
    : ''
  return {
    'Cache-Control': `public, s-maxage=${sMaxAgeSeconds}${swr}`,
    'CDN-Cache-Control': `public, s-maxage=${sMaxAgeSeconds}${swr}`,
    'Vercel-CDN-Cache-Control': `public, s-maxage=${sMaxAgeSeconds}${swr}`,
  }
}

/**
 * Returns strict HTTP Cache-Control headers preventing any CDN or shared caching of private/user data.
 */
export function privateNoStoreHeaders() {
  return {
    'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    'CDN-Cache-Control': 'no-store',
    'Vercel-CDN-Cache-Control': 'no-store',
    Pragma: 'no-cache',
    Expires: '0',
  }
}
