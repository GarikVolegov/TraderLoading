import { useState, useEffect, useCallback } from "react";
import { getOrCreateKeyPair } from "@/lib/e2ee";
import { useSavePublicKey, type SavePublicKeyBodyPublicKeyJwk } from "@workspace/api-client-react";

export function useE2EEKeys(userId: string | null) {
  const [keyPair, setKeyPair] = useState<{ publicKey: JsonWebKey; privateKey: JsonWebKey } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(false);
  const savePublicKeyMutation = useSavePublicKey();

  const initialize = useCallback(async () => {
    if (!userId) return;
    try {
      const pair = await getOrCreateKeyPair(userId);
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
