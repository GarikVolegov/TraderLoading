const DB_NAME = "traderloading-e2ee";
const STORE_NAME = "keys";

export type E2EEKeyPair = { publicKey: JsonWebKey; privateKey: JsonWebKey };

export type AccountKeyBackupStore = {
  load: () => Promise<E2EEKeyPair | null>;
  save: (keyPair: E2EEKeyPair) => Promise<void>;
  loadLocal?: (userId: string) => Promise<E2EEKeyPair | null>;
  saveLocal?: (userId: string, keyPair: E2EEKeyPair) => Promise<void>;
};

function getKeyId(userId: string): string {
  return `ecdh-keypair-${userId}`;
}

function getFallbackKeyId(userId: string): string {
  return `traderloading:e2ee:${getKeyId(userId)}`;
}

function getIndexedDB(): IDBFactory | null {
  return typeof indexedDB === "undefined" ? null : indexedDB;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const dbFactory = getIndexedDB();
    if (!dbFactory) {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const req = dbFactory.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeKeyPairInIndexedDB(userId: string, keyPair: E2EEKeyPair) {
  const idb = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(keyPair, getKeyId(userId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function storeKeyPairInLocalStorage(userId: string, keyPair: E2EEKeyPair): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(getFallbackKeyId(userId), JSON.stringify(keyPair));
}

async function storeKeyPair(userId: string, keyPair: E2EEKeyPair) {
  let stored = false;
  try {
    storeKeyPairInLocalStorage(userId, keyPair);
    stored = true;
  } catch {
    // localStorage may be blocked by the browser.
  }

  try {
    await storeKeyPairInIndexedDB(userId, keyPair);
    stored = true;
  } catch {
    // IndexedDB may be unavailable or reset during app updates.
  }

  if (!stored) {
    throw new Error("Unable to persist E2EE key pair");
  }
}

async function storeKeyPairBestEffort(userId: string, keyPair: E2EEKeyPair): Promise<void> {
  try {
    await storeKeyPair(userId, keyPair);
  } catch {
    // Account backup remains the source of truth when local storage is unavailable.
  }
}

async function loadKeyPairFromIndexedDB(userId: string): Promise<E2EEKeyPair | null> {
  const idb = await openDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(getKeyId(userId));
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

function loadKeyPairFromLocalStorage(userId: string): E2EEKeyPair | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(getFallbackKeyId(userId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.publicKey && parsed?.privateKey) {
      return parsed;
    }
  } catch {
    localStorage.removeItem(getFallbackKeyId(userId));
  }

  return null;
}

async function loadKeyPair(userId: string): Promise<E2EEKeyPair | null> {
  try {
    const fromIndexedDB = await loadKeyPairFromIndexedDB(userId);
    if (fromIndexedDB) {
      try {
        storeKeyPairInLocalStorage(userId, fromIndexedDB);
      } catch {
        // Best-effort fallback cache.
      }
      return fromIndexedDB;
    }
  } catch {
    // Fall back to localStorage when IndexedDB is unavailable or was reset.
  }

  const fromLocalStorage = loadKeyPairFromLocalStorage(userId);
  if (fromLocalStorage) {
    try {
      await storeKeyPairInIndexedDB(userId, fromLocalStorage);
    } catch {
      // IndexedDB can be unavailable in private/incognito contexts.
    }
  }
  return fromLocalStorage;
}

export async function generateKeyPair(userId: string): Promise<E2EEKeyPair> {
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

export async function getOrCreateKeyPair(userId: string): Promise<E2EEKeyPair> {
  const existing = await loadKeyPair(userId);
  if (existing) return existing;
  return generateKeyPair(userId);
}

export async function getOrCreateAccountKeyPair(
  userId: string,
  accountBackup: AccountKeyBackupStore,
): Promise<E2EEKeyPair> {
  const loadLocal = accountBackup.loadLocal ?? loadKeyPair;
  const saveLocal = accountBackup.saveLocal ?? storeKeyPairBestEffort;

  const localPair = await loadLocal(userId);

  let accountPair: E2EEKeyPair | null;
  try {
    accountPair = await accountBackup.load(); // null = definitively no backup exists
  } catch (err) {
    // Couldn't determine whether a backup exists (network/server error). Fail
    // closed: never regenerate + overwrite, which would destroy the only key
    // copy and make every past message undecryptable. Use the local key if we
    // have one, otherwise surface the error rather than silently start fresh.
    if (localPair) return localPair;
    throw err;
  }

  if (accountPair) {
    await saveLocal(userId, accountPair);
    return accountPair;
  }

  if (localPair) {
    try {
      await accountBackup.save(localPair);
    } catch {
      // Keep messaging usable; a later login can retry account backup sync.
    }
    return localPair;
  }

  // No backup exists (load resolved to null) and no local key: genuine first use.
  const generated = await generateKeyPair(userId);
  try {
    await accountBackup.save(generated);
  } catch {
    // Local persistence is enough to start; account backup can retry later.
  }
  return generated;
}

// NOTE: at-rest encryption, NOT end-to-end. The private key is backed up to the
// server (see PUT /chat/key-backup) for cross-device recovery, so the server can
// technically derive this shared key. UI copy must not claim E2EE.
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

function keyFingerprint(key: JsonWebKey): string {
  return [key.kty, key.crv, key.x, key.y].filter(Boolean).join(":");
}

export async function getSharedKey(privateKeyJwk: JsonWebKey, friendPublicKeyJwk: JsonWebKey): Promise<CryptoKey> {
  const cacheKey = `${keyFingerprint(privateKeyJwk)}->${keyFingerprint(friendPublicKeyJwk)}`;
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
