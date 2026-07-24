import { create } from "zustand";

import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  deleteCookie,
  readCookie,
  writeCookie,
} from "@/lib/auth/cookies";

/** Minimal profile shape kept in the auth store (from GET /users/me). */
export interface AuthUser {
  id?: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  [key: string]: unknown;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  /** True once tokens have been read from cookies on the client. */
  hydrated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: AuthUser | null) => void;
  clear: () => void;
  hydrate: () => void;
}

/**
 * Auth session store. The durable source of truth is cookies (so
 * middleware can read them); this store mirrors them in memory for
 * reactive access (hook `enabled` flags, the API client's bearer token).
 * Call `hydrate()` once on the client to load cookie values in.
 */
export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  hydrated: false,
  setTokens: (accessToken, refreshToken) => {
    writeCookie(ACCESS_TOKEN_COOKIE, accessToken);
    writeCookie(REFRESH_TOKEN_COOKIE, refreshToken);
    set({ accessToken, refreshToken });
  },
  setUser: (user) => set({ user }),
  clear: () => {
    deleteCookie(ACCESS_TOKEN_COOKIE);
    deleteCookie(REFRESH_TOKEN_COOKIE);
    set({ accessToken: null, refreshToken: null, user: null });
  },
  hydrate: () =>
    set({
      accessToken: readCookie(ACCESS_TOKEN_COOKIE),
      refreshToken: readCookie(REFRESH_TOKEN_COOKIE),
      hydrated: true,
    }),
}));
