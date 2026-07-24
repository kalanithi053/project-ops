import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { BadgeProps } from "@/components/ui/badge";

/**
 * Config-driven module system.
 *
 * A module (Projects, Tasks, Users, …) is described entirely by a
 * `ModuleConfig` object — no bespoke page code. The reusable
 * <ModulePage slug="…" /> looks a config up from the registry and
 * renders shadcn components (PageHeader, StatsGrid, DataTable, panels)
 * from these declarations. Adding or reshaping a module means editing
 * config, not writing UI.
 */

/** Semantic tone reused from the Badge variant contract. */
export type Tone = NonNullable<BadgeProps["variant"]>;

/** A single KPI card in the stats row. */
export interface StatItem {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
}

/** Column declaration for <DataTable>. `T` is the row shape. */
export interface ColumnDef<T> {
  /** Unique, stable key for the column. */
  key: string;
  header: string;
  /** Custom cell renderer; falls back to `sortAccessor` / key lookup. */
  cell?: (row: T) => ReactNode;
  /** Value used for sorting and search when no `cell` string is derivable. */
  sortAccessor?: (row: T) => string | number;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  headClassName?: string;
  cellClassName?: string;
  /** Hide this column below the given breakpoint (responsive). */
  hideBelow?: "sm" | "md" | "lg";
}

/** A single-select filter rendered as a dropdown above the table. */
export interface FilterDef<T> {
  key: string;
  label: string;
  options: { label: string; value: string }[];
  /** Return true to keep the row for the selected value. */
  predicate: (row: T, value: string) => boolean;
}

/** Per-row action shown in the row's "⋯" menu. */
export interface RowAction<T> {
  label: string;
  icon?: LucideIcon;
  href?: (row: T) => string;
  destructive?: boolean;
}

export interface TableConfig<T> {
  columns: ColumnDef<T>[];
  data: T[];
  /** Fields (accessors) matched against the search query. */
  searchAccessors?: ((row: T) => string)[];
  searchPlaceholder?: string;
  filters?: FilterDef<T>[];
  rowActions?: RowAction<T>[];
  pageSize?: number;
  getRowId: (row: T) => string;
  emptyMessage?: string;
}

/** A row inside a "list" panel (activity feeds, recent items, …). */
export interface ListPanelItem {
  icon?: LucideIcon;
  primary: string;
  secondary?: string;
  meta?: string;
  tone?: Tone;
}

/** A row inside a "progress" panel (utilization, capacity, …). */
export interface ProgressPanelItem {
  label: string;
  value: number;
  max?: number;
  tone?: Tone;
  valueLabel?: string;
}

/** A row inside a "breakdown" panel (badge + count). */
export interface BreakdownPanelItem {
  label: string;
  count: number | string;
  tone?: Tone;
}

/** A row inside a "fields" panel (settings/definition display). */
export interface FieldPanelItem {
  label: string;
  value: string;
  hint?: string;
}

/**
 * Non-tabular content blocks. A discriminated union so <ModulePanels>
 * can render dashboards (analytics, capacity) and settings screens from
 * the same declarative config the table modules use.
 */
export type Panel =
  | { type: "list"; title: string; description?: string; span?: 1 | 2 | 3; items: ListPanelItem[] }
  | { type: "progress"; title: string; description?: string; span?: 1 | 2 | 3; items: ProgressPanelItem[] }
  | { type: "breakdown"; title: string; description?: string; span?: 1 | 2 | 3; items: BreakdownPanelItem[] }
  | { type: "fields"; title: string; description?: string; span?: 1 | 2 | 3; items: FieldPanelItem[] };

export interface ModuleConfig<T = unknown> {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Optional primary action button (display-only for now). */
  primaryAction?: { label: string; icon?: LucideIcon };
  stats?: StatItem[];
  panels?: Panel[];
  table?: TableConfig<T>;
}
