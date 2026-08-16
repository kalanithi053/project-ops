"use client";

import * as React from "react";

import { useMyMembership } from "@/lib/api/hooks/use-my-membership";
import { useThemeStore } from "@/lib/store/theme-store";

/**
 * Pulls the member's server-remembered appearance (theme mode + accent)
 * down into this device's local store once per workspace — e.g. first
 * visit on a new browser, or switching into a workspace for the first
 * time this session. The local store wins after that; Settings >
 * Preferences pushes further changes back up via useUpdateMyTheme.
 */
export function MembershipThemeSync({ slug }: { slug: string }) {
  const { data: membership } = useMyMembership(slug);
  const setMode = useThemeStore((state) => state.setMode);
  const setAccent = useThemeStore((state) => state.setAccent);

  const syncedFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!membership || syncedFor.current === slug) return;
    syncedFor.current = slug;
    setMode(membership.theme);
    setAccent(membership.themeColor);
  }, [membership, slug, setMode, setAccent]);

  return null;
}
