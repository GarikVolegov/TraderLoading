/** A local cache namespace for one authenticated account. Legacy unowned keys stay untouched. */
export type AccountStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function accountStorage(userId: string | null | undefined, storage?: AccountStorage): AccountStorage | undefined {
  if (!userId || !storage) return undefined;
  const prefix = `tl_account_v1:${encodeURIComponent(userId)}:`;
  return {
    getItem: (key) => storage.getItem(prefix + key),
    setItem: (key, value) => storage.setItem(prefix + key, value),
    removeItem: (key) => storage.removeItem(prefix + key),
  };
}
