import { ArchiveCard } from "./ArchiveCard";
import { archiveSourceKey } from "@/lib/archive";
import type { WikiSource } from "@/lib/archive";

export function ArchiveGrid({ items, onOpen }: { items: WikiSource[]; onOpen: (id: string) => void }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-[var(--arc-gap,16px)] sm:grid-cols-[repeat(auto-fill,minmax(216px,1fr))]">
      {items.map((s) => (
        <ArchiveCard key={archiveSourceKey(s)} source={s} onOpen={onOpen} />
      ))}
    </div>
  );
}
