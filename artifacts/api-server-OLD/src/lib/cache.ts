let cached: { data: unknown; time: number } | null = null;
const TTL = 5 * 60 * 1000; // 5 דקות

export function getCache<T>(): T | null {
  if (cached && Date.now() - cached.time < TTL) return cached.data as T;
  return null;
}

export function setCache(data: unknown) {
  cached = { data, time: Date.now() };
}
