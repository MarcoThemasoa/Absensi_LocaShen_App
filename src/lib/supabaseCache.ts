/**
 * Lightweight in-memory cache for Supabase queries.
 * Prevents re-fetching data when switching between admin tabs.
 *
 * Accepts either a Promise or a thenable (like Supabase's PostgrestFilterBuilder).
 */
const store = new Map<string, { data: unknown; ts: number }>();
const DEFAULT_TTL = 60_000; // 1 minute

type Thenable<T> = { then: (onfulfilled: (value: T) => any) => any };

export async function cachedQuery<T>(
  key: string,
  fetcher: () => PromiseLike<{ data: T | null; error: any }>,
  ttl = DEFAULT_TTL
): Promise<{ data: T | null; error: any }> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.ts < ttl) {
    return { data: hit.data as T, error: null };
  }
  const result = await fetcher();
  if (result.data) {
    store.set(key, { data: result.data, ts: Date.now() });
  }
  return result;
}

export function invalidateCache(prefix?: string) {
  if (!prefix) { store.clear(); return; }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
