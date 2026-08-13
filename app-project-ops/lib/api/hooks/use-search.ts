"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import type { GlobalSearchResult } from "@/lib/api/types";

/** GET /search — projects, work items, and members matching `q`, for the header's global search. */
export function useGlobalSearch(workspaceSlug: string, q: string) {
  const token = useAuthStore((state) => state.accessToken);
  const query = q.trim();
  return useQuery({
    queryKey: ["search", workspaceSlug, query],
    queryFn: () =>
      apiFetch<GlobalSearchResult>(`/search?q=${encodeURIComponent(query)}`, {
        workspaceSlug,
      }),
    enabled: Boolean(token && workspaceSlug && query),
  });
}
