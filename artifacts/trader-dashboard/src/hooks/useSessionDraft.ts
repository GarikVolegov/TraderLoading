import { useAuth } from "@clerk/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  fetchTraderProcess,
  startProcessSession,
  traderProcessKey,
  updateProcessSession,
  type ProcessSession,
  type ProcessSessionDraft,
  type ProcessState,
  type UpdateProcessSession,
} from "@/lib/traderProcessApi";

/** Drafts are separate from confirmations. Serialize writes and detect another device. */
export function useSessionDraft<T extends ProcessSessionDraft>(
  session: ProcessSession | null,
  defaults: T,
  methodVersionId?: string,
) {
  const { userId } = useAuth();
  const client = useQueryClient();
  const localDraftKey = `tl_session_draft_${defaults.stage}_${methodVersionId || "default"}`;
  const [value, setValue] = useState<T>(() => {
    if (session?.draft?.stage === defaults.stage && session.draft) {
      return { ...defaults, ...session.draft } as T;
    }
    try {
      const local = localStorage.getItem(localDraftKey);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed?.stage === defaults.stage) {
          return { ...defaults, ...parsed } as T;
        }
      }
    } catch {
      // ignore
    }
    return defaults;
  });
  const [status, setStatus] = useState<
    "idle" | "unsaved" | "saving" | "saved" | "error" | "conflict"
  >(session?.draft ? "saved" : "idle");
  const [error, setError] = useState<Error | null>(null);
  const text = JSON.stringify(value);
  const current = useRef({ text, value });
  current.current = { text, value };
  const saved = useRef(text);
  const revision = useRef(session?.revision ?? 0);
  const sessionRef = useRef(session);
  if (session) sessionRef.current = session;
  const creation = useRef<Promise<ProcessSession> | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const confirmation = useRef<Promise<ProcessSession> | null>(null);
  const pending = useRef(0);
  const blocked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const baseline = useRef(defaults);
  baseline.current = defaults;
  const updateCache = useCallback(
    (updated: ProcessSession) => {
      client.setQueryData<ProcessState>([...traderProcessKey, userId], (previous) =>
        !previous ||
        (previous.session && previous.session.id !== updated.id) ||
        (previous.session && previous.session.revision > updated.revision)
          ? previous
          : { ...previous, session: updated },
      );
    },
    [client, userId],
  );
  const ensureSession = useCallback(async () => {
    if (sessionRef.current) return sessionRef.current;
    if (!creation.current) {
      creation.current = startProcessSession(methodVersionId).then((created) => {
        sessionRef.current = created;
        revision.current = created.revision;
        updateCache(created);
        return created;
      });
      void creation.current.catch(() => {
        creation.current = null;
      });
    }
    return creation.current;
  }, [methodVersionId, updateCache]);
  const fail = useCallback((problem: unknown) => {
    const failure = problem instanceof Error ? problem : new Error(String(problem));
    const conflict = (failure as Error & { status?: number }).status === 409;
    blocked.current = conflict;
    if (mounted.current) {
      setError(failure);
      setStatus(conflict ? "conflict" : "error");
    }
    return failure;
  }, []);
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const task = chain.current
      .catch(() => undefined)
      .then(async () => {
        if (blocked.current) throw new Error("Reload the saved session draft before continuing");
        const snapshot = current.current;
        if (snapshot.text === saved.current) return;
        if (sessionRef.current?.state === "closed") return;
        if (sessionRef.current?.day && sessionRef.current.day < new Date().toISOString().slice(0, 10)) return;
        pending.current++;
        if (mounted.current) {
          setStatus("saving");
          setError(null);
        }
        try {
          const updated = await updateProcessSession({
            id: (await ensureSession()).id,
            update: { action: "draft", expectedRevision: revision.current, draft: snapshot.value },
          });
          revision.current = updated.revision;
          saved.current = snapshot.text;
          updateCache(updated);
          if (mounted.current)
            setStatus(current.current.text === saved.current ? "saved" : "unsaved");
        } catch (problem) {
          const errStatus = (problem as { status?: number })?.status;
          if (errStatus === 409) {
            try {
              const freshState = await fetchTraderProcess();
              if (freshState.session && freshState.session.id === sessionRef.current?.id) {
                sessionRef.current = freshState.session;
                revision.current = freshState.session.revision;
                const retried = await updateProcessSession({
                  id: freshState.session.id,
                  update: {
                    action: "draft",
                    expectedRevision: freshState.session.revision,
                    draft: snapshot.value,
                  },
                });
                revision.current = retried.revision;
                saved.current = snapshot.text;
                updateCache(retried);
                if (mounted.current) {
                  setStatus(current.current.text === saved.current ? "saved" : "unsaved");
                  setError(null);
                }
                return;
              }
            } catch {
              // fallback
            }
          }
          throw fail(problem);
        } finally {
          pending.current--;
        }
      });
    chain.current = task;
    return task;
  }, [ensureSession, updateCache, fail]);
  const confirm = useCallback(
    (
      build: (
        value: T,
        expectedRevision: number,
      ) => Exclude<UpdateProcessSession, { action: "draft" }>,
    ) => {
      if (confirmation.current) return confirmation.current;
      const task = (async () => {
        await flush();
        try {
          const updated = await updateProcessSession({
            id: (await ensureSession()).id,
            update: build(current.current.value, revision.current),
          });
          revision.current = updated.revision;
          saved.current = current.current.text;
          blocked.current = true; // This form must not autosave into the next confirmed step.
          updateCache(updated);
          try {
            localStorage.removeItem(localDraftKey);
          } catch {
            // ignore
          }
          if (mounted.current) setStatus("idle");
          return updated;
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
    },
    [flush, ensureSession, updateCache, fail, localDraftKey],
  );
  useEffect(() => {
    if (text === saved.current) return;
    if (sessionRef.current?.state === "closed") return;
    if (blocked.current) {
      setStatus("conflict");
      return;
    }
    setStatus("unsaved");
    if (!sessionRef.current) void ensureSession().catch(fail);
    timer.current = setTimeout(() => {
      void flush().catch(() => undefined);
    }, 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [text, flush, ensureSession, fail]);
  useEffect(() => {
    if (!session || session.revision <= revision.current || pending.current || confirmation.current)
      return;
    // If local client has uncommitted edits, keep them and sync revision for next flush
    if (current.current.text !== saved.current) {
      revision.current = Math.max(revision.current, session.revision);
      return;
    }
    revision.current = session?.revision;
    // Only adopt received draft if it contains actual data for this stage
    if (session?.draft?.stage === baseline.current.stage && session.draft != null) {
      const received = { ...baseline.current, ...session.draft } as T;
      const encoded = JSON.stringify(received);
      saved.current = encoded;
      current.current = { text: encoded, value: received };
      setValue(received);
      try {
        localStorage.setItem(localDraftKey, encoded);
      } catch {
        // ignore
      }
      setStatus("saved");
    }
  }, [session, localDraftKey]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (sessionRef.current?.state !== "closed") {
        void flush().catch(() => undefined);
      }
    };
  }, [flush]);
  const reload = async () => {
    if (timer.current) clearTimeout(timer.current);
    await chain.current.catch(() => undefined);
    await client.cancelQueries({ queryKey: [...traderProcessKey, userId] });
    const state = await client.fetchQuery({
      queryKey: [...traderProcessKey, userId],
      queryFn: fetchTraderProcess,
      staleTime: 0,
    });
    if (
      !sessionRef.current ||
      !state.session ||
      state.session.id !== sessionRef.current.id ||
      state.session.state !== sessionRef.current.state
    )
      return;
    revision.current = state.session?.revision;
    blocked.current = false;
    const received =
      state.session?.draft?.stage === baseline.current.stage
        ? ({ ...baseline.current, ...state.session.draft } as T)
        : baseline.current;
    const encoded = JSON.stringify(received);
    saved.current = encoded;
    current.current = { text: encoded, value: received };
    setValue(received);
    try {
      localStorage.setItem(localDraftKey, encoded);
    } catch {
      // ignore
    }
    setError(null);
    setStatus("saved");
  };
  const edit = useCallback((update: T | ((previous: T) => T)) => {
    const next = typeof update === "function" ? update(current.current.value) : update;
    const text = JSON.stringify(next);
    current.current = { text, value: next };
    setValue(next);
    try {
      localStorage.setItem(localDraftKey, text);
    } catch {
      // ignore
    }
    if (text !== saved.current) setStatus(blocked.current ? "conflict" : "unsaved");
  }, [localDraftKey]);
  return { value, setValue: edit, status, error, flush, reload, confirm };
}
