/**
 * AUREUS PROTOCOL — Sovereign Production Secrets Generator
 *
 * Generates fresh 256-bit cryptographically secure keys for:
 * - BROKER_VAULT_KEY (64 hex characters / 32 bytes)
 * - HONOR_SEAL_SECRET (64 hex characters / 32 bytes)
 * - SESSION_SECRET (64 hex characters / 32 bytes)
 * - VAPID Web Push Keypair (NIST P-256 / prime256v1 base64url)
 */
import crypto from "node:crypto";

export function generateSovereignSecrets() {
  const brokerVaultKey = crypto.randomBytes(32).toString("hex");
  const honorSealSecret = crypto.randomBytes(32).toString("hex");
  const sessionSecret = crypto.randomBytes(32).toString("hex");

  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const vapidPublicKey = ecdh.getPublicKey("base64url");
  const vapidPrivateKey = ecdh.getPrivateKey("base64url");

  return {
    brokerVaultKey,
    honorSealSecret,
    sessionSecret,
    vapidPublicKey,
    vapidPrivateKey,
  };
}

if (
  process.argv[1] &&
  process.argv[1].endsWith("generateProductionSecrets.ts")
) {
  const secrets = generateSovereignSecrets();
  console.log("════════════════════════════════════════════════════════════════");
  console.log("👑 AUREUS PROTOCOL — CHIAVI CRITTOGRAFICHE DI PRODUZIONE GENERATE");
  console.log("════════════════════════════════════════════════════════════════\n");

  console.log("# 1. Crittografia Interna & Vault Sovrano:");
  console.log(`BROKER_VAULT_KEY=${secrets.brokerVaultKey}`);
  console.log(`HONOR_SEAL_SECRET=${secrets.honorSealSecret}`);
  console.log(`SESSION_SECRET=${secrets.sessionSecret}`);
  console.log("");
  console.log("# 2. Notifiche Web Push (Standard RFC 8292 NIST P-256):");
  console.log(`VAPID_PUBLIC_KEY=${secrets.vapidPublicKey}`);
  console.log(`VAPID_PRIVATE_KEY=${secrets.vapidPrivateKey}`);
  console.log("");
  console.log("════════════════════════════════════════════════════════════════");
}
