/**
 * Accent color presets for the Preferences screen. Each preset overrides
 * `--primary` / `--primary-foreground` / `--ring` (and the sidebar
 * equivalents) for light and dark mode. "Neutral" is the app's original
 * palette (defined in globals.css) and needs no overrides — selecting it
 * clears any previously-applied accent.
 */

export type AccentKey =
  | "neutral"
  | "blue"
  | "violet"
  | "green"
  | "orange"
  | "red"
  | "rose";

interface AccentTokens {
  primary: string;
  primaryForeground: string;
  ring: string;
}

interface AccentPreset {
  label: string;
  /** Swatch color shown in the picker (light-mode primary). */
  swatch: string;
  light?: AccentTokens;
  dark?: AccentTokens;
}

export const ACCENT_PRESETS: Record<AccentKey, AccentPreset> = {
  neutral: {
    label: "Neutral",
    swatch: "oklch(0.205 0 0)",
    // No overrides — falls back to the base tokens in globals.css.
  },
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
  violet: {
    label: "Violet",
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
  rose: {
    label: "Rose",
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
};

export const ACCENT_KEYS = Object.keys(ACCENT_PRESETS) as AccentKey[];

/** Applies (or clears) an accent's CSS variable overrides on <html>. */
export function applyAccent(accent: AccentKey, isDark: boolean) {
  const root = document.documentElement;
  const preset = ACCENT_PRESETS[accent];
  const tokens = isDark ? preset.dark : preset.light;

  const vars: [string, string | undefined][] = [
    ["--primary", tokens?.primary],
    ["--primary-foreground", tokens?.primaryForeground],
    ["--ring", tokens?.ring],
    ["--sidebar-primary", tokens?.primary],
    ["--sidebar-primary-foreground", tokens?.primaryForeground],
    ["--sidebar-ring", tokens?.ring],
  ];

  for (const [name, value] of vars) {
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  }
}
