/**
 * Simple in-memory TTL cache. Fine for a single-instance demo deployment;
 * a production upgrade would swap this for Redis so cache state survives
 * restarts and is shared across instances.
 */
export class TtlCache<V> {
  private store = new Map<string, { value: V; expiresAt: number }>();

  constructor(private readonly defaultTtlMs: number) {}

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V, ttlMs?: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs) });
  }

  async getOrCompute(key: string, compute: () => Promise<V>, ttlMs?: number): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await compute();
    this.set(key, value, ttlMs);
    return value;
  }
}

// Geocoding results rarely change: cache for a day.
export const geocodeCache = new TtlCache<{ lat: number; lng: number }>(24 * 60 * 60 * 1000);

// Traffic-aware matrix results are time-sensitive: short TTL.
export const matrixCache = new TtlCache<unknown>(5 * 60 * 1000);
