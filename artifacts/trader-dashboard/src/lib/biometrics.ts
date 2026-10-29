/**
 * AUREUS PROTOCOL — Motore di Sblocco Biometrico Sovrano (WebAuthn / Biometrics)
 *
 * Consente l'accesso ultrarapido al cockpit decisionale tramite Face ID, Touch ID
 * o Windows Hello (Platform Authenticator) con fallback istantaneo su codice PIN.
 *
 * Caratteristiche:
 * - 100% Client-Side & Zero Network Latency
 * - Crittografia asimmetrica hardware-backed (Secure Enclave / TPM)
 * - Compatibile con PWA installata su iOS, Android, macOS e Windows
 */

const BIOMETRIC_ENABLED_KEY = "aureus_biometric_enabled";
const BIOMETRIC_CRED_ID_KEY = "aureus_biometric_cred_id";

/** Verifica se il dispositivo corrente supporta un Platform Authenticator (Face ID / Touch ID) */
export async function isBiometricSupported(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return false;
  }
  try {
    const PK = window.PublicKeyCredential;
    if (typeof PK.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
      return await PK.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return false;
  } catch {
    return false;
  }
}

/** Verifica se lo sblocco biometrico è stato attivato dall'Operatore */
export function isBiometricEnabled(): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  return window.localStorage.getItem(BIOMETRIC_ENABLED_KEY) === "true";
}

/** Abilita o disabilita lo sblocco biometrico */
export function setBiometricEnabled(enabled: boolean): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? "true" : "false");
  if (!enabled) {
    window.localStorage.removeItem(BIOMETRIC_CRED_ID_KEY);
  }
}

/** Recupera l'ID della credenziale biometrica registrata su questo dispositivo */
export function getStoredCredentialId(): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage.getItem(BIOMETRIC_CRED_ID_KEY);
}

/** Utility: converte base64 in Uint8Array */
function base64ToUint8(base64: string): Uint8Array {
  const bin = atob(base64);
  const buffer = new ArrayBuffer(bin.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Utility: converte ArrayBuffer in base64 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Registra il sensore biometrico (Face ID / Touch ID) dell'Operatore.
 * Genera una coppia di chiavi protetta da Secure Enclave / TPM.
 */
export async function registerBiometric(operatorName = "Operatore Aureus"): Promise<boolean> {
  if (typeof window === "undefined" || !navigator.credentials) return false;

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const userIdBytes = new TextEncoder().encode("aureus-operator-local");

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: "AUREUS PROTOCOL",
          id: window.location.hostname || "localhost",
        },
        user: {
          id: userIdBytes,
          name: operatorName,
          displayName: operatorName,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },  // ES256 (NIST P-256)
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          requireResidentKey: false,
        },
        timeout: 60000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;

    if (!credential || !credential.rawId) return false;

    const credIdBase64 = bufferToBase64(credential.rawId);
    window.localStorage.setItem(BIOMETRIC_CRED_ID_KEY, credIdBase64);
    window.localStorage.setItem(BIOMETRIC_ENABLED_KEY, "true");
    return true;
  } catch {
    return false;
  }
}

/**
 * Effettua la scansione biometrica (Face ID / Touch ID / Windows Hello).
 * Ritorna true se l'impronta o il volto sono stati verificati con successo dall'hardware.
 */
export async function authenticateBiometric(): Promise<boolean> {
  if (typeof window === "undefined" || !navigator.credentials) return false;

  const credIdBase64 = getStoredCredentialId();

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      userVerification: "required",
      rpId: window.location.hostname || "localhost",
    };

    if (credIdBase64) {
      publicKeyOptions.allowCredentials = [
        {
          id: base64ToUint8(credIdBase64) as unknown as BufferSource,
          type: "public-key",
          transports: ["internal"],
        },
      ];
    }

    const assertion = (await navigator.credentials.get({
      publicKey: publicKeyOptions,
    })) as PublicKeyCredential | null;

    return !!assertion;
  } catch {
    return false;
  }
}
