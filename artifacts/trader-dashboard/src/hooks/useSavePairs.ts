import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetUserSettingsQueryKey, useUpdateUserSettings } from "@workspace/api-client-react";
import { useBackground } from "@/contexts/BackgroundContext";

/** Keep the committed workspace unchanged until the server accepts the selection. */
export function useSavePairs() {
  const { setSelectedPairs } = useBackground();
  const queryClient = useQueryClient();
  const mutation = useUpdateUserSettings({ mutation: { meta: { suppressGlobalError: true } } });
  const busy = useRef(false);
  const [failed, setFailed] = useState(false);
  const save = async (pairs: string[]): Promise<boolean> => {
    if (busy.current || pairs.length === 0) return false;
    busy.current = true;
    setFailed(false);
    try {
      // Cancel an older settings read before committing a new server response.
      await queryClient.cancelQueries({ queryKey: getGetUserSettingsQueryKey() });
      const settings = await mutation.mutateAsync({ data: { selectedPairs: pairs } });
      queryClient.setQueryData(getGetUserSettingsQueryKey(), settings);
      setSelectedPairs(settings.selectedPairs ?? pairs);
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      busy.current = false;
    }
  };
  return { save, failed, saving: mutation.isPending };
}
