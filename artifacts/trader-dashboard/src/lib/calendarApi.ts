import { createApiUrl, type RelativeApiOptions } from "./apiFetch";

export async function refreshEconomicCalendar(options?: RelativeApiOptions): Promise<void> {
  const response = await fetch(`${createApiUrl("calendar", options?.basePath)}?nocache=1`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Failed to refresh economic calendar: ${response.status}`);
  }
}
