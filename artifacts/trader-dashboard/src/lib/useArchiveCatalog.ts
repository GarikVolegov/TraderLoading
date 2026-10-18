import { useQuery } from "@tanstack/react-query";
import { apiJSON } from "./apiFetch";
import type { LibraryContent } from "./archiveResources";
export function useArchiveCatalog() {
  return useQuery<LibraryContent[]>({ queryKey: ["library", "contents"], queryFn: () => apiJSON("library/contents") });
}
