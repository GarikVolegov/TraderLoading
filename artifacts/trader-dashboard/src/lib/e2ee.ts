const DB_NAME = "traderloading-e2ee";
const STORE_NAME = "keys";

function getKeyId(userId: string): string {
  return `ecdh-keypair-${userId}`;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeKeyPair(userId: string, keyPair: { publicKey: JsonWebKey; privateKey: JsonWebKey }) {
  const idb = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(keyPair, getKeyId(userId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadKeyPair(userId: string): Promise<{ publicKey: JsonWebKey; privateKey: JsonWebKey } | null> {
  const idb = await openDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(getKeyId(userId));
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function generateKeyPair(userId: string): Promise<{ publicKey: JsonWebKey; privateKey: JsonWebKey }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
  const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const pair = { publicKey, privateKey };
  await storeKeyPair(userId, pair);
  return pair;
}

export async function getOrCreateKeyPair(userId: string): Promise<{ publicKey: JsonWebKey; privateKey: JsonWebKey }> {
  const existing = await loadKeyPair(userId);
  if (existing) return existing;
  return generateKeyPair(userId);
}

async function deriveSharedKey(privateKeyJwk: JsonWebKey, publicKeyJwk: JsonWebKey): Promise<CryptoKey> {
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"]
  );
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    publicKeyJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: publicKey },
    privateKey,
    256
  );

  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    sharedBits,
    "HKDF",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(32),
      info: new TextEncoder().encode("traderloading-e2ee-chat"),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

const sharedKeyCache = new Map<string, CryptoKey>();

export async function getSharedKey(privateKeyJwk: JsonWebKey, friendPublicKeyJwk: JsonWebKey): Promise<CryptoKey> {
  const cacheKey = JSON.stringify(friendPublicKeyJwk);
  const cached = sharedKeyCache.get(cacheKey);
  if (cached) return cached;
  const key = await deriveSharedKey(privateKeyJwk, friendPublicKeyJwk);
  sharedKeyCache.set(cacheKey, key);
  return key;
}

export async function encryptMessage(
  text: string,
  sharedKey: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    encoded
  );
  return {
    ciphertext: bufferToBase64(new Uint8Array(encrypted)),
    iv: bufferToBase64(iv),
  };
}

export async function decryptMessage(
  ciphertext: string,
  iv: string,
  sharedKey: CryptoKey
): Promise<string> {
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBuffer(iv) },
      sharedKey,
      base64ToBuffer(ciphertext)
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return "[Messaggio non decifrabile]";
  }
}

function bufferToBase64(buffer: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
