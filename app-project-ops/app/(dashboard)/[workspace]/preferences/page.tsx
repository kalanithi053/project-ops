"use client";

import { Check, Laptop, Moon, Sun } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useThemeStore, type ThemeMode } from "@/lib/store/theme-store";
import { ACCENT_KEYS, ACCENT_PRESETS, type AccentKey } from "@/lib/theme/accents";
import { toast } from "@/lib/toast/toast-store";

const MODE_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
];

export default function PreferencesPage() {
  const mode = useThemeStore((state) => state.mode);
  const accent = useThemeStore((state) => state.accent);
  const setMode = useThemeStore((state) => state.setMode);
  const setAccent = useThemeStore((state) => state.setAccent);

  function handleMode(next: ThemeMode) {
    setMode(next);
    toast.success("Appearance updated", `Theme set to ${next}`);
  }

  function handleAccent(next: AccentKey) {
    setAccent(next);
    toast.success("Appearance updated", `Accent set to ${ACCENT_PRESETS[next].label}`);
  }

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader
        title="Preferences"
        description="Personalize how ProjectOps looks for you. Changes apply instantly and only affect your browser."
      />

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Choose a theme mode and an accent color.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Theme mode</span>
            <div className="inline-flex w-fit rounded-lg border border-border bg-muted p-1">
              {MODE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = mode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleMode(option.value)}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Accent color</span>
            <div className="flex flex-wrap gap-3">
              {ACCENT_KEYS.map((key) => {
                const preset = ACCENT_PRESETS[key];
                const active = accent === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleAccent(key)}
                    aria-pressed={active}
                    aria-label={preset.label}
                    title={preset.label}
                    className={cn(
                      "relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-transform hover:scale-105",
                      active ? "border-foreground" : "border-transparent",
                    )}
                  >
                    <span
                      className="h-8 w-8 rounded-full shadow-sm"
                      style={{ backgroundColor: preset.swatch }}
                    />
                    {active && (
                      <Check className="absolute h-4 w-4 text-white drop-shadow" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
