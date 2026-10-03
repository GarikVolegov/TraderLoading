import assert from "node:assert/strict";
import { isBlockedIp } from "./ssrfGuard.js";

// Finding 0.3: SSRF guard. A server-side URL fetch (archive URL ingestion) must
// refuse to reach internal/loopback/link-local/CGNAT addresses — most critically
// the cloud metadata endpoint 169.254.169.254. isBlockedIp is the pure predicate
// applied to every DNS-resolved address before fetching.

// ── Blocked IPv4 ranges ──────────────────────────────────────────────────────
for (const ip of [
  "127.0.0.1", "127.5.5.5",        // loopback 127/8
  "10.0.0.5", "10.255.255.255",    // private 10/8
  "172.16.0.1", "172.31.255.255",  // private 172.16/12
  "192.168.1.1",                    // private 192.168/16
  "169.254.169.254",                // link-local — AWS/GCP metadata
  "100.64.0.1", "100.127.255.255", // CGNAT 100.64/10
  "0.0.0.0",                        // "this network" 0/8
]) {
  assert.equal(isBlockedIp(ip), true, `${ip} must be blocked`);
}

// ── Allowed (public) IPv4 — including the just-outside-range boundaries ───────
for (const ip of [
  "8.8.8.8", "1.1.1.1",
  "172.15.255.255", // just below 172.16/12
  "172.32.0.1",     // just above 172.16/12 (172.32.x is public)
  "192.167.1.1", "192.169.1.1", // 192.168 neighbours are public
  "11.0.0.1",       // 11/8 is public
  "100.63.255.255", "100.128.0.1", // just outside CGNAT
]) {
  assert.equal(isBlockedIp(ip), false, `${ip} must be allowed`);
}

// ── Blocked IPv6 ─────────────────────────────────────────────────────────────
for (const ip of [
  "::1",                          // loopback
  "::",                           // unspecified
  "fc00::1", "fd12:3456:789a::1", // unique-local fc00::/7
  "fe80::1", "feaf::1",           // link-local fe80::/10
  "::ffff:169.254.169.254",       // IPv4-mapped metadata address
  "::ffff:10.0.0.1",              // IPv4-mapped private
]) {
  assert.equal(isBlockedIp(ip), true, `${ip} must be blocked`);
}

// ── Allowed public IPv6 ──────────────────────────────────────────────────────
for (const ip of ["2606:4700:4700::1111", "2001:4860:4860::8888"]) {
  assert.equal(isBlockedIp(ip), false, `${ip} must be allowed`);
}

// Malformed → fail closed (block).
assert.equal(isBlockedIp("not-an-ip"), true);
assert.equal(isBlockedIp("999.0.0.1"), true);

console.log("ssrf guard checks passed");
