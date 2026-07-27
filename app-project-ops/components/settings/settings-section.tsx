"use client";

import * as React from "react";
import { Loader2, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface SettingsSectionProps {
  title: string;
  description?: string;
  /** Right-aligned control for the section (typically an "Add" button). */
  action?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Heading block for one settings section: title and description on the
 * left, an optional action on the right, content below. The heading sits
 * outside the content card so a section can hold several cards or a table
 * without nesting headers.
 */
export function SettingsSection({
  title,
  description,
  action,
  children,
}: SettingsSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

interface SettingsFormCardProps {
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  /** Enables the save/discard controls; false renders the footer inert. */
  dirty: boolean;
  pending?: boolean;
  onDiscard?: () => void;
  /** Local validation message, rendered above the footer. */
  error?: string | null;
  /** Disables the whole form (missing permission). */
  disabled?: boolean;
  footerNote?: React.ReactNode;
  saveLabel?: string;
  savingLabel?: string;
  children: React.ReactNode;
}

/**
 * Card wrapping an editable settings form, with a persistent footer bar
 * holding Discard / Save.
 *
 * Save stays disabled until something actually changes, so the footer
 * doubles as the dirty indicator — the user never has to guess whether an
 * edit is pending.
 */
export function SettingsFormCard({
  onSubmit,
  dirty,
  pending = false,
  onDiscard,
  error,
  disabled = false,
  footerNote,
  saveLabel = "Save",
  savingLabel = "Saving…",
  children,
}: SettingsFormCardProps) {
  return (
    <Card>
      <form onSubmit={onSubmit} noValidate>
        <fieldset disabled={disabled} className="flex flex-col gap-5 p-4">
          {children}
        </fieldset>

        {error && (
          <p role="alert" className="px-4 pb-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div
          className={cn(
            "flex flex-col-reverse gap-3 border-t border-border px-4 py-3",
            "sm:flex-row sm:items-center sm:justify-between",
          )}
        >
          <p className="text-xs text-muted-foreground">
            {disabled ? (
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                You don&apos;t have permission to change this.
              </span>
            ) : (
              footerNote
            )}
          </p>

          <div className="flex items-center justify-end gap-2">
            {onDiscard && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onDiscard}
                disabled={disabled || !dirty || pending}
              >
                Discard changes
              </Button>
            )}
            <Button type="submit" size="sm" disabled={disabled || !dirty || pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {savingLabel}
                </>
              ) : (
                saveLabel
              )}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

/**
 * Labelled form row. Keeps label/control/hint spacing identical across every
 * settings form.
 */
export function SettingsField({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed"
      >
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
