"use client";

import {
  FolderKanban,
  ListChecks,
  Loader2,
  Search,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SETTINGS_NAV } from "@/components/settings/settings-nav";
import { SETTINGS_NAV_ICONS } from "@/components/settings/settings-sidebar";
import { navigationConfig } from "@/config/navigation";
import { useGlobalSearch } from "@/lib/api/hooks/use-search";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { useIsWorkspaceOwner } from "@/lib/api/hooks/use-workspace-owner";
import { useTenant } from "@/lib/tenant/tenant-context";
import { cn } from "@/lib/utils";
import type { GlobalSearchResultItem } from "@/lib/api/types";

/** One row in the palette's flattened result list, regardless of source. */
interface ResultRow {
  key: string;
  groupLabel: string;
  icon: LucideIcon;
  title: string;
  subtitle?: string | null;
  href: string;
}

function emptyResult() {
  return {
    projects: [] as GlobalSearchResultItem[],
    workItems: [] as GlobalSearchResultItem[],
    members: [] as GlobalSearchResultItem[],
  };
}

const API_GROUPS: Array<{
  key: keyof ReturnType<typeof emptyResult>;
  label: string;
  icon: LucideIcon;
}> = [
  { key: "projects", label: "Projects", icon: FolderKanban },
  { key: "workItems", label: "Work items", icon: ListChecks },
  { key: "members", label: "Members", icon: Users },
];

function apiResultHref(
  workspaceSlug: string,
  item: GlobalSearchResultItem,
): string {
  switch (item.type) {
    case "project":
      return `/${workspaceSlug}/projects/${item.id}`;
    case "workitem":
      return `/${workspaceSlug}/projects/${item.projectId}/work-items/${item.id}`;
    case "member":
      return `/${workspaceSlug}/users`;
  }
}

/**
 * Header global search — Cmd/Ctrl+K opens a command-palette-style dialog
 * that searches page routes locally (instant, matched against the same
 * navigationConfig/SETTINGS_NAV the sidebar renders from) alongside
 * projects, work items, and members across the active workspace
 * (GET /search, debounced as the user types).
 */
export function GlobalSearch() {
  const router = useRouter();
  const { tenant } = useTenant();
  const { permissions } = usePermissions(tenant.slug);
  const { isOwner, isResolved: isOwnerResolved } = useIsWorkspaceOwner(
    tenant.slug,
  );

  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    const id = setTimeout(() => setQuery(input), 250);
    return () => clearTimeout(id);
  }, [input]);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setInput("");
      setQuery("");
      setActiveIndex(0);
    }
  }

  const { data, isFetching } = useGlobalSearch(tenant.slug, query);
  const result = data ?? emptyResult();

  // Every navigable page route, filtered the same way the sidebar/settings
  // grid already filter theirs — matched locally against `input`, not the
  // debounced `query`, since there's no network round-trip to wait on.
  const pageRows = React.useMemo<ResultRow[]>(() => {
    const topLevel = navigationConfig.flatMap((section) =>
      section.items
        .filter(
          (item) =>
            item.href && (!item.permission || permissions.has(item.permission)),
        )
        .map((item) => ({
          key: `page-${item.href}`,
          groupLabel: "Pages",
          icon: item.icon ?? FolderKanban,
          title: item.label,
          subtitle: null,
          href: `/${tenant.slug}${item.href}`,
        })),
    );

    const settingsPages = SETTINGS_NAV.filter(
      (item) => !item.ownerOnly || (isOwnerResolved && isOwner),
    ).map((item) => ({
      key: `page-settings-${item.segment}`,
      groupLabel: "Pages",
      icon: SETTINGS_NAV_ICONS[item.segment] ?? Settings,
      title: `Settings — ${item.label}`,
      subtitle: null,
      href: `/${tenant.slug}/settings/${item.segment}`,
    }));

    return [...topLevel, ...settingsPages];
  }, [permissions, isOwner, isOwnerResolved, tenant.slug]);

  const normalizedInput = input.trim().toLowerCase();
  const matchingPages = normalizedInput
    ? pageRows.filter((page) => page.title.toLowerCase().includes(normalizedInput))
    : [];

  const apiRows = React.useMemo<ResultRow[]>(
    () =>
      API_GROUPS.flatMap(({ key, label, icon }) =>
        result[key].map((item) => ({
          key: `${item.type}-${item.id}`,
          groupLabel: label,
          icon,
          title: item.title,
          subtitle: item.subtitle,
          href: apiResultHref(tenant.slug, item),
        })),
      ),
    [result, tenant.slug],
  );

  const sections = React.useMemo(() => {
    const grouped: Array<{ label: string; rows: ResultRow[] }> = [
      { label: "Pages", rows: matchingPages },
      ...API_GROUPS.map(({ label }) => ({
        label,
        rows: apiRows.filter((row) => row.groupLabel === label),
      })),
    ];
    return grouped.filter((group) => group.rows.length > 0);
  }, [matchingPages, apiRows]);

  const flatResults = React.useMemo(
    () => sections.flatMap((group) => group.rows),
    [sections],
  );

  React.useEffect(() => {
    setActiveIndex(0);
  }, [flatResults.length, query, normalizedInput]);

  function select(row: ResultRow) {
    router.push(row.href);
    onOpenChange(false);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (flatResults.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % flatResults.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + flatResults.length) % flatResults.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      select(flatResults[activeIndex]);
    }
  }

  const hasQuery = normalizedInput.length > 0;
  const debounceSettled = query === input;
  const hasResults = flatResults.length > 0;
  const showNoResults =
    hasQuery && debounceSettled && !isFetching && !hasResults;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="hidden gap-2 text-muted-foreground sm:flex"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
        <span>Search…</span>
        <kbd className="ml-2 hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:inline-block">
          ⌘K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="top-[20%] max-w-lg translate-y-0 gap-0 p-0">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              autoFocus
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Search pages, projects, work items, members…"
              className="h-11 border-0 shadow-none focus-visible:ring-0"
            />
            {isFetching && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            )}
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {!hasQuery ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Search for a page, project, work item, or member.
              </p>
            ) : showNoResults ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No results for &ldquo;{input}&rdquo;.
              </p>
            ) : (
              sections.map((group) => (
                <div key={group.label} className="mb-2 last:mb-0">
                  <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                  {group.rows.map((row) => {
                    const flatIndex = flatResults.indexOf(row);
                    const Icon = row.icon;
                    return (
                      <button
                        key={row.key}
                        type="button"
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                        onClick={() => select(row)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm",
                          flatIndex === activeIndex
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/60",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{row.title}</span>
                        {row.subtitle && (
                          <span className="shrink-0 truncate text-xs text-muted-foreground">
                            {row.subtitle}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
