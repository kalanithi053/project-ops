"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Boxes, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ColorPicker, isValidHex } from "@/components/shared/color-picker";
import { FormPanel } from "@/components/shared/form-panel";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { QueryState } from "@/components/shared/query-state";
import { CardsSkeleton } from "@/components/shared/skeletons";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  SelectField,
  type SelectOption,
} from "@/components/shared/select-field";
import { OwnerOnlyNotice } from "@/components/settings/owner-only-notice";
import {
  SettingsField,
  SettingsSection,
} from "@/components/settings/settings-section";
import { useWorkspaceSettings } from "@/lib/api/hooks/use-settings";
import {
  useCreateHub,
  useDeleteHub,
  useUpdateHub,
} from "@/lib/api/hooks/use-hubs";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { useIsWorkspaceOwner } from "@/lib/api/hooks/use-workspace-owner";
import { PERMISSIONS } from "@/lib/api/permissions";
import type { Hub, PlanWithModules } from "@/lib/api/types";

export default function HubsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const searchParams = useSearchParams();
  const settings = useWorkspaceSettings(workspace);
  const remove = useDeleteHub(workspace);
  const { can } = usePermissions(workspace);
  const { isOwner, isResolved } = useIsWorkspaceOwner(workspace);

  const canManage = can(PERMISSIONS.HUB_MANAGE);
  const hubs = React.useMemo(() => settings.data?.hubs ?? [], [settings.data]);
  const plans = React.useMemo(
    () => settings.data?.plans ?? [],
    [settings.data],
  );
  const projectTypes = React.useMemo(
    () => (settings.data?.projectTypes ?? []).filter((type) => type.isPlanAdd),
    [settings.data],
  );

  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<Hub | null>(null);
  const [deleting, setDeleting] = React.useState<Hub | null>(null);

  const [projectTypeId, setProjectTypeId] = React.useState<string>();
  const requestedTypeId = searchParams.get("projectTypeId") ?? undefined;
  const selectedTypeId =
    projectTypeId ?? requestedTypeId ?? projectTypes[0]?.id;
  const selectedType = projectTypes.find((type) => type.id === selectedTypeId);

  const typeOptions: SelectOption[] = projectTypes.map((type) => ({
    label: type.name,
    value: type.id,
  }));

  const visibleHubs = hubs.filter((hub) => hub.projectTypeId === selectedTypeId);

  const addButton =
    canManage && selectedType ? (
      <Button
        size="sm"
        onClick={() => setCreating(true)}
        disabled={projectTypes.length === 0}
      >
        <Plus className="h-4 w-4" />
        Add Hub
      </Button>
    ) : null;

  if (isResolved && !isOwner) {
    return (
      <SettingsSection
        title="Hubs"
        description="HubSpot Hubs (Marketing, Sales, Service, ...) and their tier plans."
      >
        <OwnerOnlyNotice />
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="Hubs"
      description="HubSpot Hubs (Marketing, Sales, Service, ...) and their tier plans."
      action={addButton}
    >
      <QueryState
        isLoading={settings.isLoading}
        isError={settings.isError}
        error={settings.error}
        onRetry={() => settings.refetch()}
        skeleton={<CardsSkeleton count={3} />}
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 sm:max-w-xs">
            <label htmlFor="hubs-project-type" className="text-sm font-medium">
              Project type
            </label>
            <SelectField
              id="hubs-project-type"
              aria-label="Project type"
              options={typeOptions}
              value={selectedTypeId}
              onValueChange={setProjectTypeId}
              placeholder={
                projectTypes.length === 0
                  ? "No plan-driven project types yet"
                  : "Select a project type"
              }
              disabled={projectTypes.length === 0}
            />
            {selectedType && (
              <p className="text-xs text-muted-foreground">
                {visibleHubs.length} hub{visibleHubs.length === 1 ? "" : "s"}{" "}
                under {selectedType.name}.
              </p>
            )}
          </div>

          {visibleHubs.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title={selectedType ? `No hubs under ${selectedType.name}` : "No hubs"}
              description="A Hub gets its Starter, Professional and Enterprise tier plans seeded automatically."
              action={addButton}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {visibleHubs.map((hub) => (
                <HubCard
                  key={hub.id}
                  workspaceSlug={workspace}
                  hub={hub}
                  tiers={plans.filter((plan) => plan.hub?.id === hub.id)}
                  canManage={canManage}
                  onEdit={() => setEditing(hub)}
                  onDelete={() => setDeleting(hub)}
                />
              ))}
            </div>
          )}
        </div>
      </QueryState>

      {(creating || editing) && (
        <HubDialog
          workspaceSlug={workspace}
          hub={editing}
          projectTypes={projectTypes}
          defaultProjectTypeId={selectedTypeId}
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
        description="Its Starter/Professional/Enterprise tier plans go with it. Projects still referencing this hub must be reassigned first — the server will refuse the delete otherwise."
        confirmLabel="Delete hub"
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

function HubCard({
  workspaceSlug,
  hub,
  tiers,
  canManage,
  onEdit,
  onDelete,
}: {
  workspaceSlug: string;
  hub: Hub;
  tiers: PlanWithModules[];
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted"
            style={
              hub.color
                ? { backgroundColor: `${hub.color}1a`, color: hub.color }
                : undefined
            }
          >
            <Boxes
              className="h-4 w-4 text-muted-foreground"
              style={hub.color ? { color: hub.color } : undefined}
            />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{hub.name}</span>
              {hub.isActive ? (
                <Badge variant="success">Active</Badge>
              ) : (
                <Badge variant="neutral">Inactive</Badge>
              )}
            </div>
          </div>
        </div>

        {canManage && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={`Edit ${hub.name}`}
              onClick={onEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              aria-label={`Delete ${hub.name}`}
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {tiers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tiers
          </span>
          {tiers.map((plan) => (
            <Button
              key={plan.id}
              asChild
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
            >
              <Link href={`/${workspaceSlug}/settings/plans/${plan.id}`}>
                {plan.name}
                {plan.isActive && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-status-success"
                    aria-label="Active"
                  />
                )}
              </Link>
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Create/edit form for a Hub. Project type is fixed at creation. */
function HubDialog({
  workspaceSlug,
  hub,
  projectTypes,
  defaultProjectTypeId,
  onClose,
}: {
  workspaceSlug: string;
  hub: Hub | null;
  projectTypes: Array<{ id: string; name: string }>;
  defaultProjectTypeId?: string;
  onClose: () => void;
}) {
  const create = useCreateHub(workspaceSlug);
  const update = useUpdateHub(workspaceSlug);
  const isEdit = Boolean(hub);
  const pending = create.isPending || update.isPending;

  const [name, setName] = React.useState(hub?.name ?? "");
  const [color, setColor] = React.useState(hub?.color ?? "#6366f1");
  const [isActive, setIsActive] = React.useState(hub?.isActive ?? true);
  const [projectTypeId, setProjectTypeId] = React.useState<string | undefined>(
    hub?.projectTypeId ?? defaultProjectTypeId ?? projectTypes[0]?.id,
  );
  const [error, setError] = React.useState<string | null>(null);

  const typeOptions: SelectOption[] = projectTypes.map((type) => ({
    label: type.name,
    value: type.id,
  }));

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      return setError("Hub name must be at least 2 characters.");
    }
    if (color && !isValidHex(color)) {
      return setError("Color must be a hex value like #6366f1.");
    }
    if (!projectTypeId) return setError("Choose a project type.");

    if (hub) {
      update.mutate(
        { id: hub.id, dto: { name: trimmed, color, isActive } },
        { onSuccess: onClose },
      );
    } else {
      create.mutate(
        { projectTypeId, name: trimmed, color, isActive },
        { onSuccess: onClose },
      );
    }
  }

  return (
    <FormPanel
      title={isEdit ? `Edit ${hub?.name}` : "Add hub"}
      description="A new hub is seeded with Starter, Professional and Enterprise tier plans — add modules to each afterwards."
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
                <Boxes className="h-4 w-4" />
                Create hub
              </>
            )}
          </Button>
        </>
      }
    >
      <SettingsField label="Name" htmlFor="hub-name">
        <Input
          id="hub-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Marketing Hub"
          maxLength={50}
          autoFocus
        />
      </SettingsField>

      <SettingsField
        label="Project type"
        htmlFor="hub-project-type"
        hint="Hubs belong to exactly one project type."
      >
        <SelectField
          id="hub-project-type"
          aria-label="Project type"
          options={typeOptions}
          value={projectTypeId}
          onValueChange={setProjectTypeId}
          placeholder="Select a project type"
          disabled={isEdit}
        />
      </SettingsField>

      <SettingsField label="Color" htmlFor="hub-color">
        <div>
          <ColorPicker
            id="hub-color"
            aria-label="Hub color"
            value={color}
            onChange={setColor}
          />
        </div>
      </SettingsField>

      <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Active</span>
          <span className="text-xs text-muted-foreground">
            Inactive hubs stay visible here but shouldn&apos;t be offered on
            new projects.
          </span>
        </div>
        <Switch
          checked={isActive}
          onCheckedChange={setIsActive}
          aria-label="Hub active"
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
