import { useAuth } from "@clerk/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  fetchTraderProcess,
  saveProcessMethodDraft,
  traderProcessKey,
  type ProcessMethodDraft,
  type ProcessState,
} from "@/lib/traderProcessApi";
import { methodDraftStep, type MethodDraftValues } from "@/lib/methodDraftSteps";

type Content = { draft: MethodDraftValues; step: 0 | 1 | 2; previousVersionId: string | null };
const encode = (content: Content) =>
  JSON.stringify({ ...content, draft: { ...content.draft, riskConfirmed: false } });
/** Definition drafts never attest rules, limits or progression. */
export function useMethodDraft(
  stored: ProcessMethodDraft | null,
  defaults: MethodDraftValues,
  previousVersionId: string | null,
  onGone: () => void,
  resolveStep = methodDraftStep,
) {
  const { userId } = useAuth();
  const client = useQueryClient();
  const initial = useRef<Content>({
    draft: { ...(stored?.draft ?? defaults), riskConfirmed: false },
    step: stored ? resolveStep(stored.draft, stored.step) : 0,
    previousVersionId: stored?.previousVersionId ?? previousVersionId,
  });
  const [content, setContent] = useState(initial.current);
  const [status, setStatus] = useState<
    "idle" | "unsaved" | "saving" | "saved" | "error" | "conflict"
  >(stored ? "saved" : "idle");
  const [error, setError] = useState<Error | null>(null);
  const text = encode(content);
  const current = useRef({ text, content });
  current.current = { text, content };
  const saved = useRef(text);
  const id = useRef(stored?.id ?? crypto.randomUUID());
  const revision = useRef(stored?.revision ?? 0);
  const chain = useRef<Promise<ProcessMethodDraft | null>>(Promise.resolve(stored));
  const pending = useRef(0);
  const confirmation = useRef<Promise<unknown> | null>(null);
  const blocked = useRef(false);
  const finished = useRef(false);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fail = useCallback((problem: unknown) => {
    const failure = problem instanceof Error ? problem : new Error(String(problem));
    blocked.current = (failure as Error & { status?: number }).status === 409;
    if (mounted.current) {
      setError(failure);
      setStatus(blocked.current ? "conflict" : "error");
    }
    return failure;
  }, []);
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const task = chain.current
      .catch(() => null)
      .then(async (last) => {
        if (finished.current) return last;
        if (blocked.current) throw new Error("Reload the saved method draft before continuing");
        const snapshot = current.current;
        if (snapshot.text === saved.current && revision.current > 0) return last;
        pending.current++;
        if (mounted.current) {
          setStatus("saving");
          setError(null);
        }
        try {
          const before = client.getQueryData<ProcessState>([...traderProcessKey, userId]);
          const updated = await saveProcessMethodDraft({
            id: id.current,
            expectedRevision: revision.current,
            ...snapshot.content,
            draft: { ...snapshot.content.draft, riskConfirmed: false },
          });
          revision.current = updated.revision;
          saved.current = snapshot.text;
          client.setQueryData<ProcessState>([...traderProcessKey, userId], (state) =>
            !state ||
            (state.methodDraft !== before?.methodDraft &&
              (!state.methodDraft ||
                state.methodDraft.id !== updated.id ||
                state.methodDraft.revision > updated.revision))
              ? state
              : { ...state, methodDraft: updated },
          );
          if (mounted.current)
            setStatus(current.current.text === saved.current ? "saved" : "unsaved");
          return updated;
        } catch (problem) {
          throw fail(problem);
        } finally {
          pending.current--;
        }
      });
    chain.current = task;
    return task;
  }, [client, userId, fail]);
  useEffect(() => {
    if (finished.current || text === saved.current) return;
    if (blocked.current) {
      setStatus("conflict");
      return;
    }
    setStatus("unsaved");
    timer.current = setTimeout(() => {
      void flush().catch(() => undefined);
    }, 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [text, flush]);
  useEffect(() => {
    if (pending.current || finished.current || confirmation.current) return;
    if (!stored) {
      if (revision.current > 0) {
        blocked.current = true;
        setStatus("conflict");
      }
      return;
    }
    if (stored.id === id.current && stored.revision <= revision.current) return;
    if (stored.id !== id.current || current.current.text !== saved.current) {
      blocked.current = true;
      setStatus("conflict");
      return;
    }
    revision.current = stored.revision;
    const received: Content = {
      previousVersionId: stored.previousVersionId,
      draft: { ...stored.draft, riskConfirmed: false },
      step: resolveStep(stored.draft, stored.step),
    };
    saved.current = encode(received);
    current.current = { text: saved.current, content: received };
    setContent(received);
    setStatus("saved");
  }, [stored, resolveStep]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (current.current.text !== saved.current) void flush().catch(() => undefined);
    };
  }, [flush]);
  const reload = async () => {
    if (timer.current) clearTimeout(timer.current);
    await chain.current.catch(() => null);
    await client.cancelQueries({ queryKey: [...traderProcessKey, userId] });
    const state = await client.fetchQuery({
      queryKey: [...traderProcessKey, userId],
      queryFn: fetchTraderProcess,
      staleTime: 0,
    });
    const received = state.methodDraft;
    if (!received) {
      finished.current = true;
      onGone();
      await client.invalidateQueries({ queryKey: traderProcessKey });
      return;
    }
    id.current = received.id;
    revision.current = received.revision;
    blocked.current = false;
    const data: Content = {
      draft: { ...received.draft, riskConfirmed: false },
      step: resolveStep(received.draft, received.step),
      previousVersionId: received.previousVersionId,
    };
    saved.current = encode(data);
    current.current = { text: saved.current, content: data };
    chain.current = Promise.resolve(received);
    setContent(data);
    setError(null);
    setStatus("saved");
  };
  const setValue = useCallback(
    (change: (values: MethodDraftValues) => MethodDraftValues) =>
      setContent((c) => ({ ...c, draft: change(c.draft) })),
    [],
  );
  const setStep = useCallback((step: 0 | 1 | 2) => setContent((c) => ({ ...c, step })), []);
  const confirm = <T>(
    create: (
      values: MethodDraftValues,
      metadata: { draftId: string; expectedDraftRevision: number },
    ) => Promise<T>,
  ): Promise<T> => {
    if (confirmation.current) return confirmation.current as Promise<T>;
    const task = (async () => {
      await flush();
      try {
        const result = await create(current.current.content.draft, {
          draftId: id.current,
          expectedDraftRevision: revision.current,
        });
        finished.current = true;
        saved.current = current.current.text;
        return result;
      } catch (problem) {
        if ((problem as { status?: number })?.status === 409) fail(problem);
        throw problem;
      }
    })();
    confirmation.current = task;
    void task
      .finally(() => {
        confirmation.current = null;
      })
      .catch(() => undefined);
    return task;
  };
  return {
    value: content.draft,
    setValue,
    step: content.step,
    setStep,
    previousVersionId: content.previousVersionId,
    status,
    error,
    flush,
    reload,
    confirm,
  };
}
