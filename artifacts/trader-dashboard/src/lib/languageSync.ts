export type LanguageSyncDecision<L extends string = string> =
  | { action: "adopt"; language: L }
  | { action: "write" }
  | { action: "none" };

/**
 * Decide how to reconcile the client language with the server-saved one at
 * session bootstrap. The server preference wins only when this device has no
 * explicit local choice (fresh device / cleared storage): that's the
 * cross-device sync case. An explicit local choice is the user's freshest
 * intent on this device, so it flows up to the server instead.
 */
export function decideLanguageSync<L extends string>(input: {
  serverLanguage: string | null | undefined;
  clientLanguage: L;
  hasExplicitLocalChoice: boolean;
  supported: readonly string[];
}): LanguageSyncDecision<L> {
  const server =
    input.serverLanguage && input.supported.includes(input.serverLanguage)
      ? (input.serverLanguage as L)
      : null;

  if (!input.hasExplicitLocalChoice && server) {
    return server === input.clientLanguage
      ? { action: "none" }
      : { action: "adopt", language: server };
  }

  return server === input.clientLanguage ? { action: "none" } : { action: "write" };
}
