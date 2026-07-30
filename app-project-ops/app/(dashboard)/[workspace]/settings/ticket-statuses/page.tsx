"use client";

import { ListChecks, Loader2, Plus } from "lucide-react";
import { useParams } from "next/navigation";
import * as React from "react";

import { OwnerOnlyNotice } from "@/components/settings/owner-only-notice";
import {
  SettingsField,
  SettingsSection,
} from "@/components/settings/settings-section";
import { TaxonomyTable } from "@/components/settings/taxonomy-table";
import { ColorPicker, isValidHex } from "@/components/shared/color-picker";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormPanel } from "@/components/shared/form-panel";
import { QueryState } from "@/components/shared/query-state";
import {
  SelectField,
  type SelectOption,
} from "@/components/shared/select-field";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { useWorkspaceSettings } from "@/lib/api/hooks/use-settings";
import {
  useCreateTicketStatus,
  useDeleteTicketStatus,
  useUpdateTicketStatus,
} from "@/lib/api/hooks/use-ticket-statuses";
import { useIsWorkspaceOwner } from "@/lib/api/hooks/use-workspace-owner";
import { PERMISSIONS } from "@/lib/api/permissions";
import {
  STATUS_CATEGORIES,
  STATUS_CATEGORY_LABELS,
  type StatusCategory,
  type TicketStatus,
} from "@/lib/api/types";

const CATEGORY_OPTIONS: SelectOption[] = STATUS_CATEGORIES.map((category) => ({
  label: STATUS_CATEGORY_LABELS[category],
  value: category,
}));

export default function TicketStatusesPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const settings = useWorkspaceSettings(workspace);
  const remove = useDeleteTicketStatus(workspace);
  const { can } = usePermissions(workspace);
  const { isOwner, isResolved } = useIsWorkspaceOwner(workspace);

  const canManage = can(PERMISSIONS.TICKETSTATUS_MANAGE);
  const statuses = settings.data?.ticketStatuses ?? [];

  const [editing, setEditing] = React.useState<TicketStatus | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<TicketStatus | null>(null);

  const addButton = canManage ? (
    <Button size="sm" onClick={() => setCreating(true)}>
      <Plus className="h-4 w-4" />
      Add Status
    </Button>
  ) : null;

  if (isResolved && !isOwner) {
    return (
      <SettingsSection
        title="Ticket Status"
        description="Manage the workflow states for your tasks."
      >
        <OwnerOnlyNotice />
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="Ticket Status"
      description="Manage the workflow states for your tasks."
      action={addButton}
    >
      <QueryState
        isLoading={settings.isLoading}
        isError={settings.isError}
        error={settings.error}
        onRetry={() => settings.refetch()}
        skeleton={<TableSkeleton columns={4} rows={5} />}
      >
        <TaxonomyTable
          rows={statuses}
          canManage={canManage}
          onEdit={setEditing}
          onDelete={setDeleting}
          canDeleteRow={(status) => status.canDelete !== false}
          emptyTitle="No ticket statuses"
          emptyDescription="Statuses define the columns tasks move through. Add your first one to get started."
          emptyAction={addButton}
        />
      </QueryState>

      {(creating || editing) && (
        <StatusDialog
          workspaceSlug={workspace}
          status={editing}
          existing={statuses}
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
        description="Tasks still using this status must be moved first — the server will refuse the delete otherwise."
        confirmLabel="Delete status"
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

/**
 * Create/edit form for a ticket status. One dialog serves both modes — the
 * fields and validation are identical, only the mutation differs.
 */
function StatusDialog({
  workspaceSlug,
  status,
  existing,
  onClose,
}: {
  workspaceSlug: string;
  status: TicketStatus | null;
  existing: TicketStatus[];
  onClose: () => void;
}) {
  const create = useCreateTicketStatus(workspaceSlug);
  const update = useUpdateTicketStatus(workspaceSlug);
  const isEdit = Boolean(status);
  const pending = create.isPending || update.isPending;

  // A new status goes to the end of the list by default.
  const nextOrder =
    existing.reduce((max, item) => Math.max(max, item.order), -1) + 1;

  const [name, setName] = React.useState(status?.name ?? "");
  const [category, setCategory] = React.useState<StatusCategory>(
    status?.category ?? "todo",
  );
  const [color, setColor] = React.useState(status?.color ?? "#94a3b8");
  const [order, setOrder] = React.useState(String(status?.order ?? nextOrder));
  const [isDefault, setIsDefault] = React.useState(status?.isDefault ?? false);
  const [error, setError] = React.useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) return setError("Enter a status name.");
    if (color && !isValidHex(color)) {
      return setError("Color must be a hex value like #3b82f6.");
    }

    const parsedOrder = Number(order);
    if (!Number.isInteger(parsedOrder) || parsedOrder < 0) {
      return setError("Order must be a whole number of 0 or more.");
    }

    const dto = {
      name: trimmed,
      category,
      color,
      order: parsedOrder,
      isDefault,
    };

    if (status) {
      update.mutate({ id: status.id, dto }, { onSuccess: onClose });
    } else {
      create.mutate(dto, { onSuccess: onClose });
    }
  }

  return (
    <FormPanel
      title={isEdit ? "Edit status" : "Add status"}
      description="Statuses are the workflow states a task can be in. The category controls how boards group them."
      onClose={onClose}
      onSubmit={handleSubmit}
      busy={pending}
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={pending}
          >
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
                <ListChecks className="h-4 w-4" />
                Create status
              </>
            )}
          </Button>
        </>
      }
    >
      <SettingsField label="Status name" htmlFor="status-name">
        <Input
          id="status-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="In Progress"
          maxLength={50}
          autoFocus
        />
      </SettingsField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SettingsField label="Category" htmlFor="status-category">
          <SelectField
            id="status-category"
            aria-label="Category"
            options={CATEGORY_OPTIONS}
            value={category}
            onValueChange={(value) => setCategory(value as StatusCategory)}
          />
        </SettingsField>

        <SettingsField
          label="Order"
          htmlFor="status-order"
          hint="Lower numbers appear first."
        >
          <Input
            id="status-order"
            type="number"
            min={0}
            value={order}
            onChange={(event) => setOrder(event.target.value)}
          />
        </SettingsField>
      </div>

      <SettingsField label="Color" htmlFor="status-color">
        <div>
          <ColorPicker
            id="status-color"
            aria-label="Status color"
            value={color}
            onChange={setColor}
          />
        </div>
      </SettingsField>

      <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Default status</span>
          <span className="text-xs text-muted-foreground">
            New tasks start here. Setting this clears the current default.
          </span>
        </div>
        <Switch
          checked={isDefault}
          onCheckedChange={setIsDefault}
          aria-label="Default status"
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
