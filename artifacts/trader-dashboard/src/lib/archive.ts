// Pure logic for the Archive page: type mapping, collection/tag derivation, and
// filtering. No React, no i18n — components resolve display strings via uiText.

export type WikiStatus = "queued" | "processing" | "ready" | "error" | "pending_transcription";
export type WikiKind = "text" | "pdf" | "image" | "office" | "audio" | "video" | "url" | "unknown";

export interface WikiSource {
  id: number;
  kind: WikiKind;
  title: string;
  status: WikiStatus;
  error: string | null;
  fileUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  folderId: number | null;
  extractedText: string;
  tags: string;
  originalUrl: string | null;
  fileSize: number;
  createdAt: string;
}

export interface ArchiveFolder {
  id: number;
  name: string;
  parentId: number | null;
  color: string | null;
  position: number;
}

export type ArchiveType = "image" | "video" | "audio" | "pdf" | "link" | "note";

export interface Collection {
  id: number;
  name: string;
  count: number;
  accent: string;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface ArchiveFilter {
  search: string;
  type: ArchiveType | "all";
  collection: "all" | "root" | number;
  tag: string | null;
}

export const ARCHIVE_TYPES: ArchiveType[] = ["image", "pdf", "video", "audio", "link", "note"];

export const TYPE_ACCENT: Record<ArchiveType, string> = {
  image: "hsl(142 71% 45%)",
  video: "hsl(262 83% 66%)",
  pdf: "hsl(0 84% 62%)",
  audio: "hsl(38 92% 52%)",
  link: "hsl(217 91% 62%)",
  note: "hsl(214 26% 74%)",
};

export const TYPE_LABEL_KEY: Record<ArchiveType, string> = {
  image: "archive.type.image",
  video: "archive.type.video",
  pdf: "archive.type.pdf",
  audio: "archive.type.audio",
  link: "archive.type.link",
  note: "archive.type.note",
};

export function archiveTypeOf(kind: WikiKind): ArchiveType {
  switch (kind) {
    case "image":
      return "image";
    case "video":
      return "video";
    case "audio":
      return "audio";
    case "pdf":
      return "pdf";
    case "office":
      return "pdf";
    case "url":
      return "link";
    default:
      return "note"; // text, unknown
  }
}

const COLLECTION_PALETTE = [
  "hsl(142 71% 45%)",
  "hsl(217 91% 62%)",
  "hsl(262 83% 66%)",
  "hsl(38 92% 52%)",
  "hsl(35 100% 56%)",
  "hsl(150 100% 42%)",
  "hsl(0 84% 62%)",
  "hsl(190 90% 50%)",
];

export function collectionAccent(folder: { id: number; color: string | null }): string {
  if (folder.color && folder.color.trim()) return folder.color;
  return COLLECTION_PALETTE[folder.id % COLLECTION_PALETTE.length];
}

export function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function collectionsFromFolders(folders: ArchiveFolder[], sources: WikiSource[]): Collection[] {
  const counts = new Map<number, number>();
  for (const s of sources) {
    if (s.folderId != null) counts.set(s.folderId, (counts.get(s.folderId) ?? 0) + 1);
  }
  return [...folders]
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
    .map((f) => ({
      id: f.id,
      name: f.name,
      count: counts.get(f.id) ?? 0,
      accent: collectionAccent(f),
    }));
}

export function tagCloud(sources: WikiSource[], limit = 12): TagCount[] {
  const counts = new Map<string, number>();
  for (const s of sources) {
    for (const tag of parseTags(s.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}

export function filterSources(sources: WikiSource[], filter: ArchiveFilter): WikiSource[] {
  const needle = filter.search.trim().toLowerCase();
  return sources.filter((s) => {
    if (filter.type !== "all" && archiveTypeOf(s.kind) !== filter.type) return false;
    if (filter.collection === "root") {
      if (s.folderId != null) return false;
    } else if (filter.collection !== "all") {
      if (s.folderId !== filter.collection) return false;
    }
    if (filter.tag && !parseTags(s.tags).includes(filter.tag)) return false;
    if (needle) {
      const haystack = [
        s.title,
        s.extractedText ?? "",
        parseTags(s.tags).join(" "),
        s.fileName ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}
