"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Flag, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormPanel } from "@/components/shared/form-panel";
import { QueryState } from "@/components/shared/query-state";
import { TableSkeleton } from "@/components/shared/skeletons";
import { ColorPicker, isValidHex } from "@/components/shared/color-picker";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SettingsField, SettingsSection } from "@/components/settings/settings-section";
import { TaxonomyTable } from "@/components/settings/taxonomy-table";
import { useWorkspaceSettings } from "@/lib/api/hooks/use-settings";
import {
  useCreatePriority,
  useDeletePriority,
  useUpdatePriority,
} from "@/lib/api/hooks/use-priorities";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/api/permissions";
import type { Priority } from "@/lib/api/types";

export default function PrioritiesPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const settings = useWorkspaceSettings(workspace);
  const remove = useDeletePriority(workspace);
  const { can } = usePermissions(workspace);

  const canManage = can(PERMISSIONS.PRIORITY_MANAGE);
  const priorities = settings.data?.priorities ?? [];

  const [editing, setEditing] = React.useState<Priority | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Priority | null>(null);

  const addButton = canManage ? (
    <Button size="sm" onClick={() => setCreating(true)}>
      <Plus className="h-4 w-4" />
      Add Priority
    </Button>
  ) : null;

  return (
    <SettingsSection
      title="Priorities"
      description="Define the urgency scale available on tasks."
      action={addButton}
    >
      <QueryState
        isLoading={settings.isLoading}
        isError={settings.isError}
        error={settings.error}
        onRetry={() => settings.refetch()}
        skeleton={<TableSkeleton columns={3} rows={4} />}
      >
        <TaxonomyTable
          rows={priorities}
          canManage={canManage}
          onEdit={setEditing}
          onDelete={setDeleting}
          emptyTitle="No priorities"
          emptyDescription="Priorities let people signal urgency on a task. Add your first one to get started."
          emptyAction={addButton}
        />
      </QueryState>

      {(creating || editing) && (
        <PriorityDialog
          workspaceSlug={workspace}
          priority={editing}
          existing={priorities}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.name}"?`}
        description="Tasks still using this priority must be reassigned first — the server will refuse the delete otherwise."
        confirmLabel="Delete priority"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
      />
    </SettingsSection>
  );
}

/** Create/edit form for a priority. One dialog serves both modes. */
function PriorityDialog({
  workspaceSlug,
  priority,
  existing,
  onClose,
}: {
  workspaceSlug: string;
  priority: Priority | null;
  existing: Priority[];
  onClose: () => void;
}) {
  const create = useCreatePriority(workspaceSlug);
  const update = useUpdatePriority(workspaceSlug);
  const isEdit = Boolean(priority);
  const pending = create.isPending || update.isPending;

  const nextOrder = existing.reduce((max, item) => Math.max(max, item.order), -1) + 1;

  const [name, setName] = React.useState(priority?.name ?? "");
  const [color, setColor] = React.useState(priority?.color ?? "#94a3b8");
  const [order, setOrder] = React.useState(String(priority?.order ?? nextOrder));
  const [isDefault, setIsDefault] = React.useState(priority?.isDefault ?? false);
  const [error, setError] = React.useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) return setError("Enter a priority name.");
    if (color && !isValidHex(color)) {
      return setError("Color must be a hex value like #f59e0b.");
    }

    const parsedOrder = Number(order);
    if (!Number.isInteger(parsedOrder) || parsedOrder < 0) {
      return setError("Order must be a whole number of 0 or more.");
    }

    const dto = { name: trimmed, color, order: parsedOrder, isDefault };

    if (priority) {
      update.mutate({ id: priority.id, dto }, { onSuccess: onClose });
    } else {
      create.mutate(dto, { onSuccess: onClose });
    }
  }

  return (
    <FormPanel
      title={isEdit ? "Edit priority" : "Add priority"}
      description="Priorities are ordered from least to most urgent by their order value."
      onClose={onClose}
      onSubmit={handleSubmit}
      busy={pending}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : isEdit ? (
              "Save changes"
            ) : (
              <>
                <Flag className="h-4 w-4" />
                Create priority
              </>
            )}
          </Button>
        </>
      }
    >
      <SettingsField label="Priority name" htmlFor="priority-name">
        <Input
          id="priority-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="High"
          maxLength={50}
          autoFocus
        />
      </SettingsField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SettingsField label="Color" htmlFor="priority-color">
          <div>
            <ColorPicker
              id="priority-color"
              aria-label="Priority color"
              value={color}
              onChange={setColor}
            />
          </div>
        </SettingsField>

        <SettingsField
          label="Order"
          htmlFor="priority-order"
          hint="Lower numbers appear first."
        >
          <Input
            id="priority-order"
            type="number"
            min={0}
            value={order}
            onChange={(event) => setOrder(event.target.value)}
          />
        </SettingsField>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Default priority</span>
          <span className="text-xs text-muted-foreground">
            New tasks start here. Setting this clears the current default.
          </span>
        </div>
        <Switch
          checked={isDefault}
          onCheckedChange={setIsDefault}
          aria-label="Default priority"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </FormPanel>
  );
}
