import { z } from "zod";

export function voiceChannelId(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id <= 2147483647 ? id : null;
}

// SDP/ICE remain opaque strings: the browser owns their WebRTC interpretation.
// Bound their size and reject object coercion and unsupported signal types.
export const voiceSignalInput = z.object({
  to: z.string().min(1).max(200).refine(value => value.trim() === value),
  type: z.enum(["offer", "answer", "ice"]),
  data: z.string().max(131072).optional().default(""),
});
