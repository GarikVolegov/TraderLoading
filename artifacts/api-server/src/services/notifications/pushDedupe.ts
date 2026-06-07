export function shouldSendPushNotification(
  cache: Map<string, number>,
  key: string,
  now = Date.now(),
  windowMs = 30_000,
): boolean {
  const previous = cache.get(key) ?? 0;
  if (previous > 0 && now - previous < windowMs) return false;
  cache.set(key, now);
  return true;
}
