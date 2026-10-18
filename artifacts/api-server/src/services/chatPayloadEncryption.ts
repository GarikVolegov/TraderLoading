import { webcrypto } from "node:crypto";

/** Same at-rest chat format as the client; private keys are already escrowed. */
export async function encryptChatPayload(
  payload: unknown,
  privateJwk: webcrypto.JsonWebKey,
  recipientPublicJwk: webcrypto.JsonWebKey,
): Promise<{ ciphertext: string; iv: string }> {
  const privateKey = await webcrypto.subtle.importKey("jwk", privateJwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const publicKey = await webcrypto.subtle.importKey("jwk", recipientPublicJwk, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const bits = await webcrypto.subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
  const hkdf = await webcrypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  const key = await webcrypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: new TextEncoder().encode("traderloading-e2ee-chat") }, hkdf, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const encrypted = await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(payload)));
  return { ciphertext: Buffer.from(encrypted).toString("base64"), iv: Buffer.from(iv).toString("base64") };
}
