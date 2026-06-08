import { useCallback, useEffect, useMemo, useState } from "react";
import type { AccountConnectionList, AccountConnectionProfile } from "./types";
import {
  activateAccountConnection,
  createAccountConnection,
  deleteAccountConnection,
  listAccountConnections,
  testAccountConnection,
  type AccountConnectionDraft,
} from "./accountConnectionsApi";

export function useAccountConnections() {
  const [connections, setConnections] = useState<AccountConnectionList>({ activeProfileId: null, profiles: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAccountConnections();
      setConnections(data);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Connessioni non disponibili");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveProfile = useCallback(
    async (draft: AccountConnectionDraft): Promise<AccountConnectionProfile> => {
      const data = await createAccountConnection(draft);
      await refresh();
      setMessage("Profilo conto salvato");
      return data.profile;
    },
    [refresh],
  );

  const activateProfile = useCallback(
    async (id: string) => {
      await activateAccountConnection(id);
      await refresh();
      setMessage("Profilo conto attivato");
    },
    [refresh],
  );

  const deleteProfile = useCallback(
    async (id: string) => {
      await deleteAccountConnection(id);
      await refresh();
      setMessage("Profilo conto eliminato");
    },
    [refresh],
  );

  const testProfile = useCallback(async (id: string): Promise<string> => {
    const data = await testAccountConnection(id);
    const nextMessage = data.reachable ? data.message : `Non raggiungibile: ${data.message}`;
    setMessage(nextMessage);
    return nextMessage;
  }, []);

  return useMemo(
    () => ({
      connections,
      loading,
      message,
      refresh,
      saveProfile,
      activateProfile,
      deleteProfile,
      testProfile,
    }),
    [connections, loading, message, refresh, saveProfile, activateProfile, deleteProfile, testProfile],
  );
}
