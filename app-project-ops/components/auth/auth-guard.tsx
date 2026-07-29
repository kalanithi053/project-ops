"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuthStore } from "@/lib/store/auth-store";
import { loginPath } from "@/lib/auth/redirect";

/**
 * Client-side gate for authenticated areas. Waits for the persisted auth
 * store to rehydrate, then either renders the app (token present) or
 * redirects to sign-in. Real authorization still happens on the backend;
 * this only avoids flashing protected UI to signed-out users.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hydrated = useAuthStore((state) => state.hydrated);
  const token = useAuthStore((state) => state.accessToken);

  React.useEffect(() => {
    if (hydrated && !token) {
      const search = searchParams.toString();
      router.replace(loginPath(`${pathname}${search ? `?${search}` : ""}`));
    }
  }, [hydrated, token, router, pathname, searchParams]);

  if (!hydrated || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
