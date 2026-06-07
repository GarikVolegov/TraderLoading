import { useCallback, useEffect, useMemo, useState } from "react";
import type { AccountConnectionList, AccountConnectionProfile } from "./types";

type ProfileDraft = Partial<
  Pick<
    AccountConnectionProfile,
    | "id"
    | "label"
    | "adapter"
    | "mode"
    | "host"
    | "port"
    | "terminalPath"
    | "importJournal"
    | "orderEnabled"
    | "orderAckTimeoutMs"
  >
>;

function apiUrl(path: string): string {
  const configured = import.meta.env.VITE_API_BASE as string | undefined;
  const base = configured && configured.trim() ? configured : window.location.origin;
  return new URL(`/api${path}`, base).toString();
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Account connection request failed");
  }
  return data;
}

export function useAccountConnections() {
  const [connections, setConnections] = useState<AccountConnectionList>({ activeProfileId: null, profiles: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await readJson<AccountConnectionList>(
        await fetch(apiUrl("/account/connections"), { credentials: "include" }),
      );
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
    async (draft: ProfileDraft): Promise<AccountConnectionProfile> => {
      const data = await readJson<{ profile: AccountConnectionProfile }>(
        await fetch(apiUrl("/account/connections"), {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft),
        }),
      );
      await refresh();
      setMessage("Profilo conto salvato");
      return data.profile;
    },
    [refresh],
  );

  const activateProfile = useCallback(
    async (id: string) => {
      await readJson(
        await fetch(apiUrl(`/account/connections/${id}/activate`), {
          method: "POST",
          credentials: "include",
        }),
      );
      await refresh();
      setMessage("Profilo conto attivato");
    },
    [refresh],
  );

  const deleteProfile = useCallback(
    async (id: string) => {
      const response = await fetch(apiUrl(`/account/connections/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Impossibile eliminare il profilo");
      await refresh();
      setMessage("Profilo conto eliminato");
    },
    [refresh],
  );

  const testProfile = useCallback(async (id: string): Promise<string> => {
    const data = await readJson<{ reachable: boolean; message: string }>(
      await fetch(apiUrl(`/account/connections/${id}/test`), {
        method: "POST",
        credentials: "include",
      }),
    );
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
