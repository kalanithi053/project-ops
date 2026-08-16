/**
 * Accent color presets for the Preferences screen. Each preset overrides
 * `--primary` / `--primary-foreground` / `--ring` (and the sidebar
 * equivalents) for light and dark mode.
 *
 * Keys and order mirror the backend's `ThemeColor` enum exactly, so a
 * value round-trips through PATCH /workspace-members/me/theme unchanged.
 */

export type AccentKey =
  | "blue"
  | "green"
  | "purple"
  | "red"
  | "orange"
  | "pink"
  | "gray"
  | "yellow";

interface AccentTokens {
  primary: string;
  primaryForeground: string;
  ring: string;
}

interface AccentPreset {
  label: string;
  /** Swatch color shown in the picker (light-mode primary). */
  swatch: string;
  light: AccentTokens;
  dark: AccentTokens;
}

export const ACCENT_PRESETS: Record<AccentKey, AccentPreset> = {
  blue: {
    label: "Blue",
    swatch: "oklch(0.55 0.18 250)",
    light: {
      primary: "oklch(0.55 0.18 250)",
      primaryForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.6 0.15 250)",
    },
    dark: {
      primary: "oklch(0.72 0.15 250)",
      primaryForeground: "oklch(0.145 0 0)",
      ring: "oklch(0.6 0.15 250)",
    },
  },
  green: {
    label: "Green",
    swatch: "oklch(0.55 0.15 149)",
    light: {
      primary: "oklch(0.55 0.15 149)",
      primaryForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.62 0.15 149)",
    },
    dark: {
      primary: "oklch(0.75 0.17 149)",
      primaryForeground: "oklch(0.145 0 0)",
      ring: "oklch(0.62 0.15 149)",
    },
  },
  purple: {
    label: "Purple",
    swatch: "oklch(0.5 0.22 300)",
    light: {
      primary: "oklch(0.5 0.22 300)",
      primaryForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.6 0.18 300)",
    },
    dark: {
      primary: "oklch(0.74 0.16 300)",
      primaryForeground: "oklch(0.145 0 0)",
      ring: "oklch(0.6 0.18 300)",
    },
  },
  red: {
    label: "Red",
    swatch: "oklch(0.55 0.22 27)",
    light: {
      primary: "oklch(0.55 0.22 27)",
      primaryForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.62 0.18 27)",
    },
    dark: {
      primary: "oklch(0.72 0.18 27)",
      primaryForeground: "oklch(0.145 0 0)",
      ring: "oklch(0.62 0.18 27)",
    },
  },
  orange: {
    label: "Orange",
    swatch: "oklch(0.62 0.19 50)",
    light: {
      primary: "oklch(0.62 0.19 50)",
      primaryForeground: "oklch(0.145 0 0)",
      ring: "oklch(0.68 0.16 50)",
    },
    dark: {
      primary: "oklch(0.75 0.17 55)",
      primaryForeground: "oklch(0.145 0 0)",
      ring: "oklch(0.68 0.16 50)",
    },
  },
  pink: {
    label: "Pink",
    swatch: "oklch(0.58 0.2 20)",
    light: {
      primary: "oklch(0.58 0.2 20)",
      primaryForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.64 0.17 20)",
    },
    dark: {
      primary: "oklch(0.75 0.15 20)",
      primaryForeground: "oklch(0.145 0 0)",
      ring: "oklch(0.64 0.17 20)",
    },
  },
  gray: {
    label: "Gray",
    swatch: "oklch(0.4 0 0)",
    light: {
      primary: "oklch(0.4 0 0)",
      primaryForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.55 0 0)",
    },
    dark: {
      primary: "oklch(0.75 0 0)",
      primaryForeground: "oklch(0.145 0 0)",
      ring: "oklch(0.55 0 0)",
    },
  },
  yellow: {
    label: "Yellow",
    swatch: "oklch(0.75 0.15 90)",
    light: {
      primary: "oklch(0.75 0.15 90)",
      primaryForeground: "oklch(0.145 0 0)",
      ring: "oklch(0.8 0.13 90)",
    },
    dark: {
      primary: "oklch(0.8 0.14 90)",
      primaryForeground: "oklch(0.145 0 0)",
      ring: "oklch(0.8 0.13 90)",
    },
  },
};

export const ACCENT_KEYS = Object.keys(ACCENT_PRESETS) as AccentKey[];

/** Applies an accent's CSS variable overrides on <html>. */
export function applyAccent(accent: AccentKey, isDark: boolean) {
  const root = document.documentElement;
  const tokens = ACCENT_PRESETS?.[accent]?.[isDark ? "dark" : "light"] ?? ACCENT_PRESETS.blue.light;

  root.style.setProperty("--primary", tokens.primary);
  root.style.setProperty("--primary-foreground", tokens.primaryForeground);
  root.style.setProperty("--ring", tokens.ring);
  root.style.setProperty("--sidebar-primary", tokens.primary);
  root.style.setProperty("--sidebar-primary-foreground", tokens.primaryForeground);
  root.style.setProperty("--sidebar-ring", tokens.ring);
}
