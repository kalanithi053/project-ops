"use client";

import * as React from "react";

import { useThemeStore } from "@/lib/store/theme-store";
import { applyAccent } from "@/lib/theme/accents";

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/**
 * Applies the persisted appearance preference (light/dark/system + accent
 * color) to <html> whenever it changes, and reacts live to OS theme
 * changes while `mode === "system"`.
 *
 * Runs client-side only (like TenantProvider/AuthHydrator elsewhere in
 * this app) — the server and first paint use the base tokens from
 * globals.css, then this effect applies the real preference. A brief
 * flash on first load is an accepted tradeoff, consistent with the rest
 * of the app's "apply after mount" pattern.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useThemeStore((state) => state.mode);
  const accent = useThemeStore((state) => state.accent);

  const apply = React.useCallback(
    (dark: boolean) => {
      document.documentElement.classList.toggle("dark", dark);
      applyAccent(accent, dark);
    },
    [accent],
  );

  React.useEffect(() => {
    const isDark = mode === "dark" || (mode === "system" && systemPrefersDark());
    apply(isDark);

    if (mode !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => apply(event.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [mode, apply]);

  return <>{children}</>;
}
