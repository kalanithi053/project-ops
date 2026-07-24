"use client";

import { useMutation } from "@tanstack/react-query";

import { apiFetch, extractTokens } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import type {
  RegisterDto,
  RequestOtpDto,
  VerifyOtpDto,
} from "@/lib/api/types";

/** Signal returned when a username has no account yet. */
export const CREATE_USER_SLUG = "Create-User";

interface OtpRequestResult {
  slug?: string;
  [key: string]: unknown;
}

/**
 * Request an OTP for a username. On success the result may carry
 * `slug: "Create-User"`, meaning the user must register first.
 */
export function useRequestOtp() {
  return useMutation({
    // Auth screens render errors inline, so skip the global error toast.
    meta: { suppressErrorToast: true },
    mutationFn: (dto: RequestOtpDto) =>
      apiFetch<OtpRequestResult>("/auth/otp/request", {
        method: "POST",
        body: dto,
        auth: false,
      }),
  });
}

/** Register a new user (after a Create-User signal); triggers an OTP. */
export function useRegister() {
  return useMutation({
    meta: { suppressErrorToast: true },
    mutationFn: (dto: RegisterDto) =>
      apiFetch("/auth/register", { method: "POST", body: dto, auth: false }),
  });
}

/** Verify an OTP; on success stores the access/refresh token pair. */
export function useVerifyOtp() {
  const setTokens = useAuthStore((state) => state.setTokens);
  return useMutation({
    meta: { suppressErrorToast: true },
    mutationFn: (dto: VerifyOtpDto) =>
      apiFetch<unknown>("/auth/otp/verify", {
        method: "POST",
        body: dto,
        auth: false,
      }),
    onSuccess: (data) => {
      const { accessToken, refreshToken } = extractTokens(data);
      if (accessToken && refreshToken) setTokens(accessToken, refreshToken);
    },
  });
}
