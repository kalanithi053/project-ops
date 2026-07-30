"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";
import type { Me, UpdateMeDto } from "@/lib/api/types";

/** GET /users/me — the current signed-in user. */
export function useMe() {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<Me>("/users/me"),
    enabled: Boolean(token),
  });
}

/** PATCH /users/me — update the current profile. `username` is immutable. */
export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateMeDto) =>
      apiFetch<Me>("/users/me", { method: "PATCH", body: dto }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Profile updated");
    },
  });
}

/** PATCH /users/me/product-tour — mark the onboarding tour as seen. */
export function useCompleteProductTour() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<Me>("/users/me/product-tour", { method: "PATCH" }),
    onSuccess: (me) => {
      queryClient.setQueryData<Me | undefined>(["me"], (prev) =>
        prev ? { ...prev, ...me } : prev,
      );
    },
  });
}
