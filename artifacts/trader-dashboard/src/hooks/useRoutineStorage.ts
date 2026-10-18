import { useMemo } from "react";
import { useAuth } from "@clerk/react";
import { accountStorage } from "@/lib/accountStorage";

export function useRoutineStorage() {
  const { userId } = useAuth();
  return useMemo(() => {
    try { return accountStorage(userId, window.localStorage); }
    catch { return undefined; }
  }, [userId]);
}
