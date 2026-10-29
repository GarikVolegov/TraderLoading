export const STORAGE_KEY = "limen.threshold_selection_pact.v1";
export const OPEN_THRESHOLD_EVENT = "limen:open-threshold-manifesto";

export function openThresholdManifesto() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_THRESHOLD_EVENT));
  }
}

export function hasAcceptedThresholdPact(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "accepted";
  } catch {
    return true;
  }
}
