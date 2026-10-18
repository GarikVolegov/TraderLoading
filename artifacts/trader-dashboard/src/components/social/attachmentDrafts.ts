/** Uploaded attachment metadata, retained only during this SPA lifetime.
 * No file bytes or chat keys are retained here. Account and peer are mandatory.
 * Reload persistence requires a durable send protocol, not blindly replaying an
 * uncertain message after a lost server response. */
export interface AttachmentPayload {
  type: "image" | "video" | "file";
  url: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
}
const drafts = new Map<string, AttachmentPayload>();
const key = (account: string, peer: string) => JSON.stringify([account, peer]);
export function getAttachmentDraft(account: string, peer: string): AttachmentPayload | null {
  const draft = drafts.get(key(account, peer));
  return draft ? { ...draft } : null;
}
export function keepAttachmentDraft(account: string, peer: string, draft: AttachmentPayload): void {
  drafts.set(key(account, peer), { ...draft });
}
export function clearAttachmentDraft(account: string, peer: string, url: string): void {
  if (drafts.get(key(account, peer))?.url === url) drafts.delete(key(account, peer));
}
