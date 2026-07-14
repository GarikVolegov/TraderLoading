type WatchlistUpdateHandler = (pair: string, item: unknown) => void;

const handlers: Set<WatchlistUpdateHandler> = new Set();

export function onWatchlistUpdate(handler: WatchlistUpdateHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function emitWatchlistUpdate(pair: string, item: unknown): void {
  for (const h of handlers) {
    try {
      h(pair, item);
    } catch {
      // swallow handler errors
    }
  }
}

export {};
