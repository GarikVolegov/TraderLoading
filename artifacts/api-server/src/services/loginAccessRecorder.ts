type Access = { userId: string; ipAddress: string; userAgent: string | null };
type Dependencies = {
  findRecent(userId: string, ipAddress: string, since: Date): Promise<boolean>;
  insert(access: Access): Promise<void>;
  now?: () => number;
};
const TTL = 60 * 60 * 1000;

/** Cache only confirmed records. Share an in-flight write so recovery does not
 * trade lost records for duplicate inserts on simultaneous requests. */
export function createLoginAccessRecorder(deps: Dependencies) {
  const recent = new Map<string, number>();
  const active = new Map<string, Promise<void>>();
  const now = deps.now ?? Date.now;
  return function record(userId: string, ipAddress: string, userAgent: string | undefined): Promise<void> {
    const key = JSON.stringify([userId, ipAddress]), startedAt = now(), last = recent.get(key);
    if (last !== undefined && startedAt - last < TTL) return Promise.resolve();
    const running = active.get(key);
    if (running) return running;
    for (const [entry, recordedAt] of recent) if (startedAt - recordedAt >= TTL) recent.delete(entry);
    const pending = Promise.resolve().then(async () => {
      if (!(await deps.findRecent(userId, ipAddress, new Date(startedAt - TTL)))) {
        await deps.insert({ userId, ipAddress, userAgent: userAgent ?? null });
      }
      recent.set(key, startedAt);
    }).finally(() => { active.delete(key); });
    active.set(key, pending);
    return pending;
  };
}
