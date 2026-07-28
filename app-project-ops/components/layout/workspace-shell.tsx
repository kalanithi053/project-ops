"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useMe } from "@/lib/api/hooks/use-users";
import type { Me, UpdateMeDto } from "@/lib/api/types";
import { getFullname } from "@/lib/utils";
import type { AuthUser } from "@/types/auth";

/** Map the API profile onto the shell's AuthUser shape. */
function toAuthUser(me: Me | undefined, fallbackName: string): AuthUser {
  return {
    id: String(me?.id ?? me?.email ?? "me"),
    name: getFullname(me as UpdateMeDto) ?? "",
    email: me?.email ?? "",
    role: "Member",
    permissions: [],
  };
}

/**
 * Wraps the app shell with the real signed-in user (GET /users/me).
 * Notifications aren't exposed by the API yet, so an empty list is
 * passed; wire a notifications endpoint here when one exists.
 */
export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { data: me } = useMe();
  const user = toAuthUser(me, "Account");

  return (
    <AppShell user={user} notifications={[]}>
      {children}
    </AppShell>
  );
}
