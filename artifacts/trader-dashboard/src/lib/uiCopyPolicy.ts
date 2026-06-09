const HIDDEN_PROVIDER_NAMES = [
  "perplexity",
  "rss",
  "yahoo finance",
  "cftc",
  "groq",
  "benzinga",
  "finnhub",
  "polygon",
];

export function containsHiddenProviderName(value: string | null | undefined): boolean {
  const text = value?.toLowerCase() ?? "";
  return HIDDEN_PROVIDER_NAMES.some((name) => text.includes(name));
}

export function shouldShowProviderLabel(_provider: string | null | undefined): boolean {
  return false;
}

export function cleanProviderCopy(value: string | null | undefined): string {
  const text = value?.trim() ?? "";
  return containsHiddenProviderName(text) ? "" : text;
}

export function simpleStatusLabel(status: string | null | undefined): string {
  switch ((status ?? "").toLowerCase()) {
    case "connected":
    case "live":
    case "ready":
      return "Attivo";
    case "connecting":
    case "pending":
    case "waiting":
      return "In attesa";
    case "disabled":
    case "offline":
      return "Non attivo";
    case "error":
    case "failed":
      return "Non disponibile";
    default:
      return "Stato non disponibile";
  }
}
