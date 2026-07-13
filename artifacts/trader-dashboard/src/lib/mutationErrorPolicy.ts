// Policy for the global MutationCache onError handler (App.tsx): decides whether
// a failed mutation should surface the generic destructive toast, or whether the
// call site already handles its own error feedback.

type MutationLike = {
  options?: {
    onError?: unknown;
    meta?: Record<string, unknown>;
  };
};

export function shouldNotifyGlobally(mutation: MutationLike | undefined): boolean {
  const options = mutation?.options;
  if (!options) return true;
  // The mutation surfaces its own failure (per-call onError wins over the global).
  if (typeof options.onError === "function") return false;
  // Explicit opt-out for mutateAsync/try-catch call sites that toast on their own.
  if (options.meta?.suppressGlobalError === true) return false;
  return true;
}
