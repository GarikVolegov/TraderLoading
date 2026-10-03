export function shouldSendPushNotification(
  cache: Map<string, number>,
  key: string,
  now = Date.now(),
  windowMs = 30_000,
): boolean {
  // Sweep entries older than the dedup window so the cache stays bounded by the
  // set of recently-notified keys instead of growing for the process lifetime
  // (deleting during Map iteration is well-defined).
  for (const [seenKey, seenAt] of cache) {
    if (now - seenAt >= windowMs) cache.delete(seenKey);
  }
  const previous = cache.get(key) ?? 0;
  if (previous > 0 && now - previous < windowMs) return false;
  cache.set(key, now);
  return true;
}
