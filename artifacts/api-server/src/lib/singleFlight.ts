// Single-flight: dedupe concurrent async work by key. While a call for `key` is
// in flight, later callers get the same promise instead of starting a second run;
// the key is cleared once it settles (success or failure). Used to keep a
// stale-while-revalidate background rebuild from firing once per simultaneous reader.
export function singleFlight<T>(
  inFlight: Map<string, Promise<T>>,
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const promise = fn().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
