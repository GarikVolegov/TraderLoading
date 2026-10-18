import { useAuth } from "@clerk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTraderProcess, traderProcessKey, type ProcessState } from "@/lib/traderProcessApi";

export function useTraderProcess() {
  const { userId, isLoaded, isSignedIn } = useAuth();
  const client = useQueryClient();
  const queryKey = [...traderProcessKey, userId];
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const before = client.getQueryData<ProcessState>(queryKey);
      const received = await fetchTraderProcess();
      const current = client.getQueryData<ProcessState>(queryKey);
      const latest =
        current?.session?.id === received.session?.id &&
        current?.session &&
        received.session &&
        current.session.revision > received.session.revision
          ? current
          : received;
      return current &&
        (current.methodDraft !== before?.methodDraft ||
          (current.methodDraft?.id === received.methodDraft?.id &&
            current.methodDraft &&
            received.methodDraft &&
            current.methodDraft.revision > received.methodDraft.revision))
        ? { ...latest, methodDraft: current.methodDraft }
        : latest;
    },
    enabled: isLoaded && isSignedIn === true && Boolean(userId),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  return { ...query, authReady: isLoaded && isSignedIn === true && Boolean(userId), userId };
}

export function useProcessMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    meta: { suppressGlobalError: true },
    onSuccess: () => client.invalidateQueries({ queryKey: traderProcessKey }),
  });
}
