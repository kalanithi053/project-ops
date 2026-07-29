"use client";

import { Pencil, Trash2 } from "lucide-react";
import * as React from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * The shape ticket statuses and priorities have in common. Both are ordered,
 * colored, workspace-scoped lists with exactly one default.
 */
export interface TaxonomyRow {
  id: string;
  name: string;
  color?: string | null;
  order: number;
  isDefault: boolean;
}

interface TaxonomyTableProps<T extends TaxonomyRow> {
  rows: T[];
  canManage: boolean;
  /** Column rendered after Order — e.g. a ticket status's category. */
  extraColumn?: { header: string; render: (row: T) => React.ReactNode };
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
  canDeleteRow?: (row: T) => boolean;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: React.ReactNode;
}

/**
 * Table for an ordered, colored taxonomy (ticket statuses, priorities).
 *
 * Rows are display-only with explicit edit/delete actions rather than
 * inline-editable cells: both resources have server-side uniqueness and
 * in-use constraints, so edits need a validated commit step and a place to
 * surface a 409 rather than saving on every keystroke.
 */
export function TaxonomyTable<T extends TaxonomyRow>({
  rows,
  canManage,
  extraColumn,
  onEdit,
  onDelete,
  canDeleteRow = () => true,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: TaxonomyTableProps<T>) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-60">Name</TableHead>
              <TableHead className="w-20">Order</TableHead>
              {extraColumn && (
                <TableHead className="w-40">{extraColumn.header}</TableHead>
              )}
              <TableHead className="w-40">Color</TableHead>
              {canManage && (
                <TableHead className="w-24 text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{row.name}</span>
                    {row.isDefault && (
                      <Badge variant="secondary" className="font-normal">
                        Default
                      </Badge>
                    )}
                  </div>
                </TableCell>

                <TableCell className="tabular-nums text-muted-foreground">
                  {row.order}
                </TableCell>

                {extraColumn && (
                  <TableCell>{extraColumn.render(row)}</TableCell>
                )}

                <TableCell>
                  {row.color ? (
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: row.color }}
                        aria-hidden
                      />
                      <span className="font-mono text-xs uppercase text-muted-foreground">
                        {row.color}
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">None</span>
                  )}
                </TableCell>

                {canManage && (
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Edit ${row.name}`}
                        onClick={() => onEdit(row)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {canDeleteRow(row) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          aria-label={`Delete ${row.name}`}
                          onClick={() => onDelete(row)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
