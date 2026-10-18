import { ArchiveRow } from "./ArchiveRow";
import { archiveSourceKey } from "@/lib/archive";
import type { WikiSource } from "@/lib/archive";

export function ArchiveList({ items, onOpen }: { items: WikiSource[]; onOpen: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((s) => (
        <ArchiveRow key={archiveSourceKey(s)} source={s} onOpen={onOpen} />
      ))}
    </div>
  );
}
