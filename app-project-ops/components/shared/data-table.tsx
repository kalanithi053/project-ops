"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  MoreHorizontal,
  Search,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import type { ColumnDef, TableConfig } from "@/types/module";

const ALL = "__all__";

const hideBelowClass: Record<NonNullable<ColumnDef<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

const alignClass = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/** Best-effort string for search/sort when a column has no explicit accessor. */
function fallbackValue<T>(row: T, key: string): string | number {
  const value = (row as Record<string, unknown>)[key];
  if (typeof value === "number") return value;
  return value == null ? "" : String(value);
}

/**
 * Generic, fully client-side data table driven by a <TableConfig>.
 * Provides search, single-select filters, column sorting, pagination,
 * and per-row action menus — so every list module gets the same
 * interactions for free by declaring columns + data.
 */
export function DataTable<T>({
  columns,
  data,
  searchAccessors,
  searchPlaceholder = "Search…",
  filters = [],
  rowActions = [],
  pageSize = 10,
  getRowId,
  emptyMessage = "No records match your current search and filters.",
}: TableConfig<T>) {
  const [query, setQuery] = React.useState("");
  const [filterValues, setFilterValues] = React.useState<Record<string, string>>(
    {},
  );
  const [sort, setSort] = React.useState<{
    key: string;
    dir: "asc" | "desc";
  } | null>(null);
  const [page, setPage] = React.useState(0);

  const columnByKey = React.useMemo(
    () => new Map(columns.map((c) => [c.key, c])),
    [columns],
  );

  function sortValue(row: T, key: string): string | number {
    const column = columnByKey.get(key);
    if (column?.sortAccessor) return column.sortAccessor(row);
    return fallbackValue(row, key);
  }

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    let rows = data.filter((row) => {
      if (q && searchAccessors) {
        const haystack = searchAccessors
          .map((accessor) => accessor(row).toLowerCase())
          .join(" ");
        if (!haystack.includes(q)) return false;
      }
      for (const filter of filters) {
        const value = filterValues[filter.key];
        if (value && value !== ALL && !filter.predicate(row, value)) {
          return false;
        }
      }
      return true;
    });

    if (sort) {
      const dir = sort.dir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const av = sortValue(a, sort.key);
        const bv = sortValue(b, sort.key);
        if (typeof av === "number" && typeof bv === "number") {
          return (av - bv) * dir;
        }
        return String(av).localeCompare(String(bv)) * dir;
      });
    }

    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, query, filterValues, filters, sort, searchAccessors]);

  // Keep the current page in range as filters/search shrink the result set.
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(
    currentPage * pageSize,
    currentPage * pageSize + pageSize,
  );

  // Reset to the first page whenever the query or a filter changes, so the
  // user never lands on an out-of-range page. Done in the change handlers
  // below rather than an effect to avoid cascading renders.
  function handleQueryChange(value: string) {
    setQuery(value);
    setPage(0);
  }

  function handleFilterChange(key: string, value: string) {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  }

  function toggleSort(column: ColumnDef<T>) {
    if (!column.sortable) return;
    setSort((prev) => {
      if (prev?.key !== column.key) return { key: column.key, dir: "asc" };
      if (prev.dir === "asc") return { key: column.key, dir: "desc" };
      return null;
    });
  }

  const hasToolbar = Boolean(searchAccessors) || filters.length > 0;
  const rangeStart = filtered.length === 0 ? 0 : currentPage * pageSize + 1;
  const rangeEnd = currentPage * pageSize + pageRows.length;

  return (
    <div className="flex flex-col gap-4">
      {hasToolbar && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {searchAccessors && (
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => handleQueryChange(event.target.value)}
                placeholder={searchPlaceholder}
                className="pl-8"
                aria-label="Search"
              />
            </div>
          )}

          {filters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => {
                const value = filterValues[filter.key] ?? ALL;
                const active =
                  value !== ALL
                    ? filter.options.find((o) => o.value === value)?.label
                    : null;
                return (
                  <DropdownMenu key={filter.key}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(active && "border-foreground/30")}
                      >
                        {filter.label}
                        {active && (
                          <span className="text-muted-foreground">: {active}</span>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      <DropdownMenuLabel>{filter.label}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        value={value}
                        onValueChange={(next) =>
                          handleFilterChange(filter.key, next)
                        }
                      >
                        <DropdownMenuRadioItem value={ALL}>
                          All
                        </DropdownMenuRadioItem>
                        {filter.options.map((option) => (
                          <DropdownMenuRadioItem
                            key={option.value}
                            value={option.value}
                          >
                            {option.label}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => {
                const isSorted = sort?.key === column.key;
                return (
                  <TableHead
                    key={column.key}
                    className={cn(
                      alignClass[column.align ?? "left"],
                      column.hideBelow && hideBelowClass[column.hideBelow],
                      column.headClassName,
                    )}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className="inline-flex items-center gap-1 rounded font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {column.header}
                        {isSorted ? (
                          sort?.dir === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                );
              })}
              {rowActions.length > 0 && (
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row) => (
              <TableRow key={getRowId(row)}>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      alignClass[column.align ?? "left"],
                      column.hideBelow && hideBelowClass[column.hideBelow],
                      column.cellClassName,
                    )}
                  >
                    {column.cell
                      ? column.cell(row)
                      : String(fallbackValue(row, column.key))}
                  </TableCell>
                ))}
                {rowActions.length > 0 && (
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Row actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        {rowActions.map((action) => {
                          const ActionIcon = action.icon;
                          const content = (
                            <>
                              {ActionIcon && <ActionIcon className="h-4 w-4" />}
                              {action.label}
                            </>
                          );
                          return (
                            <DropdownMenuItem
                              key={action.label}
                              asChild={Boolean(action.href)}
                              className={cn(
                                action.destructive &&
                                  "text-destructive focus:bg-destructive/10 focus:text-destructive",
                              )}
                            >
                              {action.href ? (
                                <Link href={action.href(row)}>{content}</Link>
                              ) : (
                                <span>{content}</span>
                              )}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filtered.length === 0 && (
          <div className="p-3">
            <EmptyState
              title="No results"
              description={emptyMessage}
              className="border-0"
            />
          </div>
        )}
      </div>

      {filtered.length > pageSize && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {rangeStart}–{rangeEnd} of {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 0}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage + 1} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= pageCount - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
