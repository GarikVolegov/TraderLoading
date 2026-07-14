// SSRF guard (audit finding 0.3). Any server-side fetch toward a user-supplied
// URL (archive URL ingestion) must refuse to reach internal addresses — above all
// the cloud metadata endpoint 169.254.169.254. `isBlockedIp` is a pure predicate
// checked against every DNS-resolved address; `assertPublicHost` does the DNS
// resolution (I/O) and throws if any resolved address is blocked.

import { lookup } from "node:dns/promises";

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return true; // malformed → fail closed
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = nums;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 127) return true; // loopback 127/8
  if (a === 10) return true; // private 10/8
  if (a === 172 && b >= 16 && b <= 31) return true; // private 172.16/12
  if (a === 192 && b === 168) return true; // private 192.168/16
  if (a === 169 && b === 254) return true; // link-local 169.254/16 (metadata)
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const v = ip.replace(/^\[|\]$/g, "");
  if (v === "::1" || v === "::") return true; // loopback / unspecified
  const first = v.split(":")[0];
  if (/^f[cd]/.test(first)) return true; // fc00::/7 unique-local
  if (/^fe[89ab]/.test(first)) return true; // fe80::/10 link-local
  return false;
}

/** True if `ip` is a private/loopback/link-local/CGNAT address that a
 *  server-side fetch must never reach. Fails closed on malformed input. */
export function isBlockedIp(ip: string): boolean {
  const v = ip.trim().toLowerCase();
  const mapped = v.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/); // IPv4-mapped IPv6
  if (mapped) return isBlockedIpv4(mapped[1]);
  if (v.includes(":")) return isBlockedIpv6(v);
  return isBlockedIpv4(v);
}

/** Resolve `hostname` and throw if ANY resolved address is internal. Called
 *  before every fetch hop (redirect targets included) to block SSRF. */
export async function assertPublicHost(hostname: string): Promise<void> {
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new Error("URL non risolvibile.");
  }
  if (addresses.length === 0) throw new Error("URL non risolvibile.");
  for (const { address } of addresses) {
    if (isBlockedIp(address)) {
      throw new Error("URL non consentito: indirizzo interno o riservato.");
    }
  }
}
