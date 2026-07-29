import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { AccentKey } from "@/lib/theme/accents";

export type ThemeMode = "light" | "dark" | "system";
export type DateFormat = "utc" | "local";

interface ThemeState {
  mode: ThemeMode;
  accent: AccentKey;
  dateFormat: DateFormat;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentKey) => void;
  setDateFormat: (dateFormat: DateFormat) => void;
  reset: () => void;
}

/**
 * Personal appearance preferences (theme mode + accent color). Persisted
 * to localStorage — this is a browser preference, not workspace data, so
 * it deliberately lives outside the API/workspace layer.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "system",
      accent: "neutral",
      dateFormat: "utc",
      setMode: (mode) => set({ mode }),
      setAccent: (accent) => set({ accent }),
      setDateFormat: (dateFormat) => set({ dateFormat }),
      reset: () => set({ mode: "system", accent: "neutral", dateFormat: "utc" }),
    }),
    { name: "projectops.theme" },
  ),
);
