import { ArchiveCard } from "./ArchiveCard";
import type { WikiSource } from "@/lib/archive";

export function ArchiveGrid({ items, onOpen }: { items: WikiSource[]; onOpen: (id: number) => void }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-[var(--arc-gap,16px)] sm:grid-cols-[repeat(auto-fill,minmax(216px,1fr))]">
      {items.map((s) => (
        <ArchiveCard key={s.id} source={s} onOpen={onOpen} />
      ))}
    </div>
  );
}
