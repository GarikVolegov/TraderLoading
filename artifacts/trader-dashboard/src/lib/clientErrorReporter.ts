type ToastPayload = {
  description: string;
  variant?: "default" | "destructive";
};

type ReportClientErrorOptions = {
  context: string;
  fallbackMessage?: string;
  notify?: boolean;
  toast?: (payload: ToastPayload) => void;
  consoleWarn?: (...args: unknown[]) => void;
};

export function getClientErrorMessage(
  error: unknown,
  fallbackMessage = "Operazione non riuscita.",
): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallbackMessage;
}

export function reportClientError(
  error: unknown,
  options: ReportClientErrorOptions,
): void {
  const message = getClientErrorMessage(error, options.fallbackMessage);
  const warn = options.consoleWarn ?? console.warn;
  warn(`[${options.context}]`, error);

  if (options.notify === false || !options.toast) return;
  options.toast({ description: message, variant: "destructive" });
}
