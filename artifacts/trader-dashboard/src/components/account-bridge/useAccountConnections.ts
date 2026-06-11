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
import { useLanguage } from "@/contexts/LanguageContext";

export function useAccountConnections() {
  const { t } = useLanguage();
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
      setMessage(error instanceof Error ? error.message : t("account_bridge.connections_unavailable"));
    } finally {
      setLoading(false);
    }
    }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveProfile = useCallback(
    async (draft: AccountConnectionDraft): Promise<AccountConnectionProfile> => {
      const data = await createAccountConnection(draft);
      await refresh();
      setMessage(t("account_bridge.profile_saved"));
      return data.profile;
    },
    [refresh, t],
  );

  const activateProfile = useCallback(
    async (id: string) => {
      await activateAccountConnection(id);
      await refresh();
      setMessage(t("account_bridge.profile_enabled"));
    },
    [refresh, t],
  );

  const deleteProfile = useCallback(
    async (id: string) => {
      await deleteAccountConnection(id);
      await refresh();
      setMessage(t("account_bridge.profile_deleted"));
    },
    [refresh, t],
  );

  const testProfile = useCallback(async (id: string): Promise<string> => {
    const data = await testAccountConnection(id);
    const nextMessage = data.reachable ? data.message : t("account_bridge.not_reachable", { message: data.message });
    setMessage(nextMessage);
    return nextMessage;
  }, [t]);

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
