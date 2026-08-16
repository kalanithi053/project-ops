"use client";

import { Check, Clock3, Laptop, Moon, Sun } from "lucide-react";
import { useParams } from "next/navigation";
import * as React from "react";

import { OwnerOnlyNotice } from "@/components/settings/owner-only-notice";
import {
  SettingsField,
  SettingsFormCard,
  SettingsSection,
} from "@/components/settings/settings-section";
import { QueryState } from "@/components/shared/query-state";
import { SelectField } from "@/components/shared/select-field";
import { CardsSkeleton } from "@/components/shared/skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { useUpdateMyTheme } from "@/lib/api/hooks/use-my-membership";
import {
  useUpdateWorkspacePreferences,
  useWorkspaceSettings,
} from "@/lib/api/hooks/use-settings";
import { useIsWorkspaceOwner } from "@/lib/api/hooks/use-workspace-owner";
import { PERMISSIONS } from "@/lib/api/permissions";
import {
  useThemeStore,
  type DateFormat,
  type ThemeMode,
} from "@/lib/store/theme-store";
import { ACCENT_KEYS, ACCENT_PRESETS, type AccentKey } from "@/lib/theme/accents";
import { toast } from "@/lib/toast/toast-store";
import type {
  TimeLogPastLimitUnit,
  WorkspacePreferences,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";

const UNIT_OPTIONS: { value: TimeLogPastLimitUnit; label: string }[] = [
  { value: "day", label: "Day(s)" },
  { value: "week", label: "Week(s)" },
  { value: "month", label: "Month(s)" },
];

export default function PreferencesSettingsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const settings = useWorkspaceSettings(workspace);
  const { can } = usePermissions(workspace);
  const { isOwner, isResolved } = useIsWorkspaceOwner(workspace);

  const saved = settings.data?.preferences;

  return (
    <div className="flex flex-col gap-8">
      <SettingsSection
        title="Appearance"
        description="Personalize how ProjectOps looks for you. Theme and accent are remembered for you on this workspace; date format is saved to this browser only."
      >
        <AppearanceCard workspaceSlug={workspace} />
      </SettingsSection>

      <SettingsSection
        title="Time Log Restrictions"
        description="Control how members are allowed to log time on this workspace."
      >
        {isResolved && !isOwner ? (
          <OwnerOnlyNotice />
        ) : (
          <QueryState
            isLoading={settings.isLoading}
            isError={settings.isError}
            error={settings.error}
            onRetry={() => settings.refetch()}
            skeleton={<CardsSkeleton count={1} />}
          >
            {saved && (
              <TimeLogPreferencesForm
                key={JSON.stringify(saved)}
                workspaceSlug={workspace}
                saved={saved}
                canManage={can(PERMISSIONS.WORKSPACE_MANAGE)}
              />
            )}
          </QueryState>
        )}
      </SettingsSection>
    </div>
  );
}

const MODE_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
];

const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string }[] = [
  { value: "utc", label: "UTC" },
  { value: "local", label: "Local" },
];

/**
 * Theme mode and accent are synced to the member's own `workspace_member`
 * row (any active member may read/set their own, regardless of role) so
 * they follow the member back to this workspace on another device — the
 * initial pull-down happens once per workspace in MembershipThemeSync,
 * mounted at the workspace layout level. Date format stays purely local —
 * it was never part of this request and has no server model of its own.
 */
function AppearanceCard({ workspaceSlug }: { workspaceSlug: string }) {
  const updateTheme = useUpdateMyTheme(workspaceSlug);

  const mode = useThemeStore((state) => state.mode);
  const accent = useThemeStore((state) => state.accent);
  const dateFormat = useThemeStore((state) => state.dateFormat);
  const setMode = useThemeStore((state) => state.setMode);
  const setAccent = useThemeStore((state) => state.setAccent);
  const setDateFormat = useThemeStore((state) => state.setDateFormat);

  function handleMode(next: ThemeMode) {
    setMode(next);
    updateTheme.mutate({ theme: next, themeColor: accent });
    toast.success("Appearance updated", `Theme set to ${next}`);
  }

  function handleAccent(next: AccentKey) {
    setAccent(next);
    updateTheme.mutate({ theme: mode, themeColor: next });
    toast.success("Appearance updated", `Accent set to ${ACCENT_PRESETS[next].label}`);
  }

  function handleDateFormat(next: DateFormat) {
    setDateFormat(next);
    toast.success("Date display updated", `Dates now use ${next === "utc" ? "UTC" : "local time"}`);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 pt-4">
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
          <span className="text-sm font-medium">Date and time</span>
          <span className="text-sm text-muted-foreground">
            Choose whether timestamps use UTC or your browser&apos;s local time.
          </span>
          <div className="inline-flex w-fit rounded-lg border border-border bg-muted p-1">
            {DATE_FORMAT_OPTIONS.map((option) => {
              const active = dateFormat === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleDateFormat(option.value)}
                  aria-pressed={active}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Clock3 className="h-4 w-4" />
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
  );
}

function TimeLogPreferencesForm({
  workspaceSlug,
  saved,
  canManage,
}: {
  workspaceSlug: string;
  saved: WorkspacePreferences;
  canManage: boolean;
}) {
  const update = useUpdateWorkspacePreferences(workspaceSlug);

  const [allowManualTimeLog, setAllowManualTimeLog] = React.useState(
    saved.allowManualTimeLog,
  );
  const [allowPastTimeLog, setAllowPastTimeLog] = React.useState(
    saved.allowPastTimeLog,
  );
  const [limitValue, setLimitValue] = React.useState(
    saved.pastTimeLogLimitValue ? String(saved.pastTimeLogLimitValue) : "",
  );
  const [limitUnit, setLimitUnit] = React.useState<TimeLogPastLimitUnit>(
    saved.pastTimeLogLimitUnit,
  );
  const [error, setError] = React.useState<string | null>(null);

  const dirty =
    allowManualTimeLog !== saved.allowManualTimeLog ||
    allowPastTimeLog !== saved.allowPastTimeLog ||
    (allowPastTimeLog &&
      (limitValue !== (saved.pastTimeLogLimitValue ?? "").toString() ||
        limitUnit !== saved.pastTimeLogLimitUnit));

  function discard() {
    setAllowManualTimeLog(saved.allowManualTimeLog);
    setAllowPastTimeLog(saved.allowPastTimeLog);
    setLimitValue(
      saved.pastTimeLogLimitValue ? String(saved.pastTimeLogLimitValue) : "",
    );
    setLimitUnit(saved.pastTimeLogLimitUnit);
    setError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (allowPastTimeLog && limitValue && Number(limitValue) < 1) {
      return setError("The past-date limit must be at least 1.");
    }

    update.mutate({
      allowManualTimeLog,
      allowPastTimeLog,
      pastTimeLogLimitValue:
        allowPastTimeLog && limitValue ? Number(limitValue) : null,
      pastTimeLogLimitUnit: limitUnit,
    });
  }

  return (
    <SettingsFormCard
      onSubmit={handleSubmit}
      dirty={Boolean(dirty)}
      pending={update.isPending}
      onDiscard={discard}
      error={error}
      disabled={!canManage}
      footerNote={
        dirty ? "You have unsaved changes." : "Everything is up to date."
      }
    >
      <SettingsField
        label="Manual time log entries"
        htmlFor="allow-manual-time-log"
        hint="When off, members can only log time through the timer — the manual entry form is hidden."
      >
        <Switch
          id="allow-manual-time-log"
          checked={allowManualTimeLog}
          onCheckedChange={setAllowManualTimeLog}
        />
      </SettingsField>

      <SettingsField
        label="Allow logging time for past dates"
        htmlFor="allow-past-time-log"
        hint="When off, members can only log time against today's date."
      >
        <Switch
          id="allow-past-time-log"
          checked={allowPastTimeLog}
          onCheckedChange={setAllowPastTimeLog}
        />
      </SettingsField>

      {allowPastTimeLog && (
        <SettingsField
          label="How far back"
          htmlFor="past-time-log-limit"
          hint="Leave blank for no limit."
          className="max-w-xs"
        >
          <div className="flex gap-2">
            <Input
              id="past-time-log-limit"
              type="number"
              min={1}
              value={limitValue}
              onChange={(event) => setLimitValue(event.target.value)}
              placeholder="Unlimited"
              className="w-28"
            />
            <SelectField
              aria-label="Past time log limit unit"
              options={UNIT_OPTIONS}
              value={limitUnit}
              onValueChange={(value) =>
                setLimitUnit(value as TimeLogPastLimitUnit)
              }
              className="flex-1"
            />
          </div>
        </SettingsField>
      )}
    </SettingsFormCard>
  );
}
