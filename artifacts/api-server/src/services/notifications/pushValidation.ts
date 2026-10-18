import { Agent } from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod/v4";
import { isBlockedIp } from "../ssrfGuard.js";

export const NotificationPreferencePatch = z
  .object({
    sessions: z.boolean().optional(),
    messages: z.boolean().optional(),
    social: z.boolean().optional(),
    goals: z.boolean().optional(),
    dailyReminder: z.boolean().optional(),
    macroEvents: z.boolean().optional(),
    scheduledCalls: z.boolean().optional(),
  })
  .strict();

function isEncodedKey(value: string, length: number, firstByte?: number): boolean {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return false;
  const bytes = Buffer.from(value, "base64url");
  return bytes.length === length && (firstByte === undefined || bytes[0] === firstByte);
}

export const PushSubscriptionBody = z.object({
  endpoint: z.string().min(1).max(4096),
  keys: z.object({
    p256dh: z
      .string()
      .max(100)
      .refine((v) => isEncodedKey(v, 65, 4)),
    auth: z
      .string()
      .max(30)
      .refine((v) => isEncodedKey(v, 16)),
  }),
});

export const PushUnsubscriptionBody = z.object({ endpoint: z.string().min(1).max(4096) });

/** Literal-address checks also normalize IPv6, including hex IPv4-mapped forms. */
export function isPublicPushAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  if (family === 4) {
    const [a, b] = address.split(".").map(Number);
    return !isBlockedIp(address) && a < 224 && !(a === 198 && (b === 18 || b === 19));
  }
  const normalized = new URL(`https://[${address}]/`).hostname.slice(1, -1).toLowerCase();
  // IPv4-compatible/mapped destinations can hide a private IPv4 address from a
  // string-prefix IPv6 guard; public push services do not require these forms.
  return (
    !normalized.startsWith("::") &&
    !normalized.startsWith("ff") &&
    !normalized.startsWith("2001:db8:") &&
    !isBlockedIp(normalized)
  );
}

export function parsePushEndpoint(endpoint: string): URL {
  const url = new URL(endpoint);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new Error("Push endpoint must be an HTTPS URL without credentials or fragments");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(hostname)) {
    if (!isPublicPushAddress(hostname)) throw new Error("Push endpoint address is not public");
  } else if (
    !hostname.includes(".") ||
    /(?:^|\.)(?:localhost|local|internal|invalid)$/.test(hostname)
  ) {
    throw new Error("Push endpoint host is not public");
  }
  return url;
}

type Address = { address: string; family: number };
type Resolve = (hostname: string) => Promise<Address[]>;

/** Resolve once and pin the checked address to the HTTPS connection. A second
 * lookup after validation would allow DNS rebinding to an internal destination. */
export async function createPublicPushAgent(
  endpoint: string,
  resolve: Resolve = (hostname) => lookup(hostname, { all: true }),
): Promise<Agent> {
  const url = parsePushEndpoint(endpoint);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await resolve(hostname);
  if (!addresses.length || addresses.some(({ address }) => !isPublicPushAddress(address))) {
    throw new Error("Push endpoint resolves to a non-public address");
  }
  const address = addresses[0];
  return new Agent({
    lookup(requestedHost, options, callback) {
      if (requestedHost !== hostname) {
        callback(new Error("Unexpected push endpoint host"), "", 0);
        return;
      }
      if (options.all) callback(null, [address]);
      else callback(null, address.address, address.family);
    },
  });
}
