"use client";

import * as React from "react";
import { ChevronsUpDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SelectOption } from "@/components/shared/select-field";

interface MultiSelectFieldProps {
  options: SelectOption[];
  values: string[];
  onValuesChange: (values: string[]) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * Multi-select counterpart to <SelectField>, built on the same DropdownMenu
 * primitive so the two controls look identical in a form.
 *
 * Selected options render as removable chips inside the trigger, which keeps
 * the current selection readable without opening the menu — important when
 * the choice drives what gets provisioned, as it does for project plans.
 */
export function MultiSelectField({
  options,
  values,
  onValuesChange,
  placeholder = "Select…",
  id,
  disabled,
  invalid,
  className,
  ...aria
}: MultiSelectFieldProps) {
  const selected = options.filter((option) => values.includes(option.value));

  function toggle(value: string) {
    onValuesChange(
      values.includes(value)
        ? values.filter((current) => current !== value)
        : [...values, value],
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        id={id}
        disabled={disabled}
        aria-label={aria["aria-label"]}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-[invalid=true]:border-destructive",
          className,
        )}
      >
        {selected.length === 0 ? (
          <span className="truncate text-muted-foreground">{placeholder}</span>
        ) : (
          <span className="flex flex-wrap items-center gap-1 py-1 text-left">
            {selected.map((option) => (
              <Badge
                key={option.value}
                variant="secondary"
                className="gap-1 font-normal"
              >
                {option.label}
                {/*
                  A nested <button> inside the trigger would be invalid HTML,
                  so this chip's remove affordance is a span with an explicit
                  role — the menu remains the keyboard path for deselection.
                */}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Remove ${option.label}`}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggle(option.value);
                  }}
                  className="cursor-pointer rounded-sm hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </span>
              </Badge>
            ))}
          </span>
        )}
        <ChevronsUpDown className="h-4 w-4 shrink-0 self-center text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
      >
        {options.length === 0 ? (
          <p className="px-2 py-3 text-center text-sm text-muted-foreground">
            Nothing to choose from.
          </p>
        ) : (
          options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={values.includes(option.value)}
              // Keeps the menu open so several options can be picked in one go.
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={() => toggle(option.value)}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
