import { archiveSourceKey, filterSources, type ArchiveFilter, type WikiSource } from "./archive";
import { REWARDS, isRewardAvailable, type Reward } from "./rewardsLibrary";
import type { MindMapData } from "../components/MindMapEditor";

export interface LibraryContent {
  id: number;
  collectionId: number | null;
  type: "document" | "mindmap" | "video";
  title: string;
  description: string;
  bodyMarkdown: string;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number;
  mimeType: string | null;
  embedUrl: string | null;
  mindmap?: MindMapData | null;
  tags: string;
  requiredLevel: number;
  orderIndex: number;
  published: boolean;
  createdAt?: string;
}

export type ArchiveResource =
  | { origin: "personal"; ref: string; source: WikiSource; personal: WikiSource }
  | { origin: "library"; ref: string; source: WikiSource; content: LibraryContent }
  | { origin: "reward"; ref: string; source: WikiSource; reward: Reward };

export const CATALOG_COLLECTION = -1;
export const REWARD_COLLECTION = -2;
export function canUsePersonalArchive(pro: boolean | undefined): boolean { return pro === true; }

function readonlySource(input: Partial<WikiSource> & Pick<WikiSource, "id" | "title" | "resourceKey">): WikiSource {
  return { kind: "text", status: "ready", error: null, fileUrl: null, fileName: null, mimeType: null,
    folderId: null, extractedText: "", tags: "[]", originalUrl: null, fileSize: 0, createdAt: "",
    readOnly: true, ...input };
}

/** A view index referencing originals, with no copies or writes to private storage. */
export function buildArchiveResources(input: {
  personal: WikiSource[]; contents: LibraryContent[]; level: number; pro: boolean;
  rewards?: Reward[];
}): ArchiveResource[] {
  const personal: ArchiveResource[] = input.pro ? input.personal.map(personal => ({
    origin: "personal", ref: archiveSourceKey(personal), personal,
    source: { ...personal, originLabelKey: "reorg.archive.personal" },
  })) : [];
  const catalog: ArchiveResource[] = input.contents.filter(c => c.published && c.requiredLevel <= input.level)
    .map(content => ({ origin: "library", ref: `library:${content.id}`, content,
      source: readonlySource({ id: content.id, resourceKey: `library:${content.id}`, title: content.title,
        kind: content.type === "mindmap" ? "mindmap" : content.type === "video" ? "video" : content.mimeType === "application/pdf" ? "pdf" : content.mimeType?.startsWith("image/") ? "image" : "text",
        folderId: CATALOG_COLLECTION, extractedText: `${content.description}\n${content.bodyMarkdown}`, tags: content.tags,
        fileUrl: content.fileUrl, fileName: content.fileName, fileSize: content.fileSize, mimeType: content.mimeType,
        originalUrl: content.embedUrl, createdAt: content.createdAt ?? "", originLabelKey: "reorg.archive.catalog" }) }));
  const rewards: ArchiveResource[] = (input.rewards ?? REWARDS).filter(r => r.milestone <= input.level)
    .map(reward => ({ origin: "reward", ref: `reward:${reward.id}`, reward,
      source: readonlySource({ id: 0, resourceKey: `reward:${reward.id}`, title: reward.title,
        kind: reward.type === "video" ? "video" : "url", folderId: REWARD_COLLECTION,
        extractedText: reward.description, originalUrl: isRewardAvailable(reward) ? reward.url : null,
        unavailable: !isRewardAvailable(reward), originLabelKey: "reorg.archive.reward" }) }));
  return [...personal, ...catalog, ...rewards];
}

export function filterArchiveResources(resources: ArchiveResource[], filter: ArchiveFilter, tab: "all" | "unlocked"): ArchiveResource[] {
  const allowed = new Set(filterSources(resources.map(r => r.source), filter).map(archiveSourceKey));
  return resources.filter(r => (tab === "all" || r.origin !== "personal") && allowed.has(r.ref));
}

/** Notifications and settings use the same catalog and unlock thresholds as the archive. */
export function catalogMilestones(contents: LibraryContent[]): number[] {
  return [...new Set([...REWARDS.map(r => r.milestone), ...contents.filter(c => c.published).map(c => c.requiredLevel)])]
    .filter(level => level > 0).sort((a, b) => a - b);
}
export function catalogRewardsForMilestone(contents: LibraryContent[], milestone: number): Reward[] {
  const editorial = contents.filter(c => c.published && c.requiredLevel === milestone).map(c => ({
    id: `library:${c.id}`, milestone, type: c.type === "video" ? "video" as const : "pdf" as const,
    title: c.title, description: c.description, thumbnailUrl: "", available: true,
    url: `/wiki?t=unlocked&resource=${encodeURIComponent(`library:${c.id}`)}`,
  }));
  return [...editorial, ...REWARDS.filter(r => r.milestone === milestone)];
}
