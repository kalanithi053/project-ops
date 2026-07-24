"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import type { Me } from "@/lib/api/types";

/** GET /users/me — the current signed-in user. */
export function useMe() {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<Me>("/users/me"),
    enabled: Boolean(token),
  });
}

/** PATCH /users/me — update the current profile. */
export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: Partial<Me>) =>
      apiFetch<Me>("/users/me", { method: "PATCH", body: dto }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
