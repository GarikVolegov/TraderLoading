import { useState, useEffect, useCallback, useRef } from "react";
import { getOrCreateAccountKeyPair, type E2EEKeyPair } from "@/lib/e2ee";
import {
  getAccountKeyBackup,
  saveAccountKeyBackup,
  useSavePublicKey,
  type SaveAccountKeyBackupBodyPrivateKeyJwk,
  type SaveAccountKeyBackupBodyPublicKeyJwk,
  type SavePublicKeyBodyPublicKeyJwk,
} from "@workspace/api-client-react";

export function useE2EEKeys(userId: string | null) {
  const [keyPair, setKeyPair] = useState<{ publicKey: JsonWebKey; privateKey: JsonWebKey } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(false);
  // Readiness/error UI owns this feedback; a stale request must not toast into
  // the next account after this hook has been cancelled.
  const { mutateAsync: savePublicKey } = useSavePublicKey({
    mutation: { meta: { suppressGlobalError: true } },
  });
  const generationRef = useRef(0);
  const activeAccountRef = useRef(userId);
  activeAccountRef.current = userId;
  const cancelInitialization = useCallback(() => {
    generationRef.current++;
  }, []);

  const initialize = useCallback(async () => {
    if (!userId) return;
    const generation = ++generationRef.current;
    const isCurrent = () => generationRef.current === generation && activeAccountRef.current === userId;
    const assertCurrent = () => {
      if (!isCurrent()) throw new Error("Account key initialization cancelled");
    };
    const assertResponseAccount = (responseUserId: string) => {
      if (responseUserId !== userId) {
        generationRef.current++;
        throw new Error("Account changed during key initialization");
      }
    };
    try {
      const pair = await getOrCreateAccountKeyPair(userId, {
        load: async (): Promise<E2EEKeyPair | null> => {
          assertCurrent();
          const backup = await getAccountKeyBackup();
          assertCurrent();
          assertResponseAccount(backup.userId);
          if (!backup.hasBackup || !backup.publicKeyJwk || !backup.privateKeyJwk) {
            return null;
          }
          return {
            publicKey: backup.publicKeyJwk as JsonWebKey,
            privateKey: backup.privateKeyJwk as JsonWebKey,
          };
        },
        save: async (nextPair) => {
          assertCurrent();
          const saved = await saveAccountKeyBackup({
            publicKeyJwk: nextPair.publicKey as SaveAccountKeyBackupBodyPublicKeyJwk,
            privateKeyJwk: nextPair.privateKey as SaveAccountKeyBackupBodyPrivateKeyJwk,
          });
          assertCurrent();
          assertResponseAccount(saved.userId);
        },
      });
      // The shared key store can fall back to a local pair after a failed load
      // or save. Recheck here so a cancelled account cannot publish that pair
      // with the next account's cookies.
      assertCurrent();
      await savePublicKey({ data: { publicKeyJwk: pair.publicKey as SavePublicKeyBodyPublicKeyJwk } });
      assertCurrent();
      setKeyPair(pair);
      setIsReady(true);
    } catch (err) {
      if (!isCurrent()) return;
      console.error("E2EE key initialization failed:", err);
      setError(true);
    }
  }, [userId, savePublicKey]);

  useEffect(() => {
    setIsReady(false);
    setError(false);
    setKeyPair(null);
    initialize();
    return cancelInitialization;
  }, [initialize, cancelInitialization]);

  return { keyPair, isReady, error };
}
