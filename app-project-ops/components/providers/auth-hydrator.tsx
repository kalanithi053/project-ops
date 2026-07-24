"use client";

import * as React from "react";

import { useAuthStore } from "@/lib/store/auth-store";

/**
 * Loads the auth tokens from cookies into the in-memory store once on the
 * client. Runs high in the tree so hooks that gate on `accessToken` see
 * the hydrated value.
 */
export function AuthHydrator({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((state) => state.hydrate);

  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

  return <>{children}</>;
}
