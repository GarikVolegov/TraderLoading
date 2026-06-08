export interface EffectiveFilterItems {
  items: string[];
  requestedItems: string[];
  unsupportedItems: string[];
  supportedCount: number;
  requestedCount: number;
  hasUserSelection: boolean;
  isFallback: boolean;
}

export interface DeriveEffectiveFilterItemsInput {
  requestedItems: string[];
  supportedItems: string[];
  defaultItems: string[];
}

export function uniqueItems(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export function deriveEffectiveFilterItems(input: DeriveEffectiveFilterItemsInput): EffectiveFilterItems {
  const requestedItems = uniqueItems(input.requestedItems);
  const supportedItems = uniqueItems(input.supportedItems);
  const defaultItems = uniqueItems(input.defaultItems);
  const supportedSet = new Set(supportedItems);
  const matched = requestedItems.filter((item) => supportedSet.has(item));
  const unsupportedItems = requestedItems.filter((item) => !supportedSet.has(item));
  const hasUserSelection = requestedItems.length > 0;
  const isFallback = !hasUserSelection || matched.length === 0;
  const items = isFallback ? defaultItems : matched;

  return {
    items,
    requestedItems,
    unsupportedItems,
    supportedCount: matched.length,
    requestedCount: requestedItems.length,
    hasUserSelection,
    isFallback,
  };
}
