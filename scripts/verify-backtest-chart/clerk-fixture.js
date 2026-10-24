export function useAuth() { return { userId: (typeof location !== "undefined" ? new URLSearchParams(location.search).get("user") : null) || "chart-a", isLoaded: true }; }
