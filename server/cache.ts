interface CacheEntry<T> {
  data: T;
  timestamp: number;
  etag: string;
}

class ServerCache {
  private store = new Map<string, CacheEntry<any>>();
  private defaultTTL: number;

  constructor(defaultTTL = 60_000) {
    this.defaultTTL = defaultTTL;
  }

  get<T>(key: string, ttl?: number): CacheEntry<T> | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    const maxAge = ttl ?? this.defaultTTL;
    if (Date.now() - entry.timestamp > maxAge) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  set<T>(key: string, data: T): CacheEntry<T> {
    const etag = `"${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}"`;
    const entry: CacheEntry<T> = { data, timestamp: Date.now(), etag };
    this.store.set(key, entry);
    return entry;
  }

  invalidate(key: string) {
    this.store.delete(key);
  }

  invalidatePattern(pattern: string) {
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key);
      }
    }
  }

  clear() {
    this.store.clear();
  }
}

export const serverCache = new ServerCache(60_000);
