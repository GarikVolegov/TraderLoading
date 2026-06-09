import { useState, useEffect, useCallback } from "react";
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
  const savePublicKeyMutation = useSavePublicKey();

  const initialize = useCallback(async () => {
    if (!userId) return;
    try {
      const pair = await getOrCreateAccountKeyPair(userId, {
        load: async (): Promise<E2EEKeyPair | null> => {
          const backup = await getAccountKeyBackup();
          if (!backup.hasBackup || !backup.publicKeyJwk || !backup.privateKeyJwk) {
            return null;
          }
          return {
            publicKey: backup.publicKeyJwk as JsonWebKey,
            privateKey: backup.privateKeyJwk as JsonWebKey,
          };
        },
        save: async (nextPair) => {
          await saveAccountKeyBackup({
            publicKeyJwk: nextPair.publicKey as SaveAccountKeyBackupBodyPublicKeyJwk,
            privateKeyJwk: nextPair.privateKey as SaveAccountKeyBackupBodyPrivateKeyJwk,
          });
        },
      });
      setKeyPair(pair);
      await savePublicKeyMutation.mutateAsync({ data: { publicKeyJwk: pair.publicKey as SavePublicKeyBodyPublicKeyJwk } });
      setIsReady(true);
    } catch (err) {
      console.error("E2EE key initialization failed:", err);
      setError(true);
    }
  }, [userId]);

  useEffect(() => {
    setIsReady(false);
    setError(false);
    setKeyPair(null);
    initialize();
  }, [initialize]);

  return { keyPair, isReady, error };
}
