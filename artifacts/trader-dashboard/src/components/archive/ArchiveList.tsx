import { ArchiveRow } from "./ArchiveRow";
import type { WikiSource } from "@/lib/archive";

export function ArchiveList({ items, onOpen }: { items: WikiSource[]; onOpen: (id: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((s) => (
        <ArchiveRow key={s.id} source={s} onOpen={onOpen} />
      ))}
    </div>
  );
}
