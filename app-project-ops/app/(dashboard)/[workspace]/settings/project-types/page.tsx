"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Layers, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ColorPicker, isValidHex } from "@/components/shared/color-picker";
import { FormPanel } from "@/components/shared/form-panel";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { QueryState } from "@/components/shared/query-state";
import { ListSkeleton } from "@/components/shared/skeletons";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { OwnerOnlyNotice } from "@/components/settings/owner-only-notice";
import { SettingsField, SettingsSection } from "@/components/settings/settings-section";
import { useWorkspaceSettings } from "@/lib/api/hooks/use-settings";
import {
  useCreateProjectType,
  useDeleteProjectType,
  useUpdateProjectType,
} from "@/lib/api/hooks/use-project-types";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { useIsWorkspaceOwner } from "@/lib/api/hooks/use-workspace-owner";
import { PERMISSIONS } from "@/lib/api/permissions";
import type { ProjectType } from "@/lib/api/types";

export default function ProjectTypesPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const settings = useWorkspaceSettings(workspace);
  const remove = useDeleteProjectType(workspace);
  const { can } = usePermissions(workspace);
  const { isOwner, isResolved } = useIsWorkspaceOwner(workspace);

  const canManage = can(PERMISSIONS.PROJECTTYPE_MANAGE);
  const projectTypes = settings.data?.projectTypes ?? [];

  const [editing, setEditing] = React.useState<ProjectType | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<ProjectType | null>(null);

  const addButton = canManage ? (
    <Button size="sm" onClick={() => setCreating(true)}>
      <Plus className="h-4 w-4" />
      Add New Project Type
    </Button>
  ) : null;

  if (isResolved && !isOwner) {
    return (
      <SettingsSection
        title="Project Type"
        description="Configure plans and modules per project category."
      >
        <OwnerOnlyNotice />
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="Project Type"
      description="Configure plans and modules per project category."
      action={addButton}
    >
      <QueryState
        isLoading={settings.isLoading}
        isError={settings.isError}
        error={settings.error}
        onRetry={() => settings.refetch()}
        skeleton={<ListSkeleton rows={2} />}
      >
        {projectTypes.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No project types"
            description="Project types decide which plans and modules a new project is provisioned with."
            action={addButton}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {projectTypes.map((projectType) => (
              <ProjectTypeCard
                key={projectType.id}
                workspaceSlug={workspace}
                projectType={projectType}
                canManage={canManage}
                onEdit={() => setEditing(projectType)}
                onDelete={() => setDeleting(projectType)}
              />
            ))}
          </div>
        )}
      </QueryState>

      {(creating || editing) && (
        <ProjectTypeDialog
          workspaceSlug={workspace}
          projectType={editing}
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
        description="Its plans and modules go with it. Projects still using this type must be reassigned first — the server will refuse the delete otherwise."
        confirmLabel="Delete project type"
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

function ProjectTypeCard({
  workspaceSlug,
  projectType,
  canManage,
  onEdit,
  onDelete,
}: {
  workspaceSlug: string;
  projectType: ProjectType;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const plans = projectType.plans ?? [];

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted"
            style={
              projectType.color
                ? { backgroundColor: `${projectType.color}1a`, color: projectType.color }
                : undefined
            }
          >
            <Layers className="h-4 w-4 text-muted-foreground" style={projectType.color ? { color: projectType.color } : undefined} />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{projectType.name}</span>
              {projectType.isPlanAdd ? (
                <Badge variant="info">Plan-driven</Badge>
              ) : (
                <Badge variant="neutral">Blank</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {projectType.description ||
                (projectType.isPlanAdd
                  ? "Provisions the selected plan's modules and seed tasks."
                  : "Creates an empty project with no modules or seed tasks.")}
            </p>
          </div>
        </div>

        {canManage && (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={`Edit ${projectType.name}`}
              onClick={onEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              aria-label={`Delete ${projectType.name}`}
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {plans.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Plans
          </span>
          {plans.map((plan) => (
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

/** Create/edit form for a project type. */
function ProjectTypeDialog({
  workspaceSlug,
  projectType,
  onClose,
}: {
  workspaceSlug: string;
  projectType: ProjectType | null;
  onClose: () => void;
}) {
  const create = useCreateProjectType(workspaceSlug);
  const update = useUpdateProjectType(workspaceSlug);
  const isEdit = Boolean(projectType);
  const pending = create.isPending || update.isPending;

  const [name, setName] = React.useState(projectType?.name ?? "");
  const [description, setDescription] = React.useState(
    projectType?.description ?? "",
  );
  const [color, setColor] = React.useState(projectType?.color ?? "#6366f1");
  const [isPlanAdd, setIsPlanAdd] = React.useState(
    projectType?.isPlanAdd ?? true,
  );
  const [error, setError] = React.useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      return setError("Project type name must be at least 2 characters.");
    }
    if (color && !isValidHex(color)) {
      return setError("Color must be a hex value like #6366f1.");
    }

    const dto = {
      name: trimmed,
      description: description.trim(),
      color,
      isPlanAdd,
    };

    if (projectType) {
      update.mutate({ id: projectType.id, dto }, { onSuccess: onClose });
    } else {
      create.mutate(dto, { onSuccess: onClose });
    }
  }

  return (
    <FormPanel
      title={isEdit ? `Edit ${projectType?.name}` : "Add project type"}
      description="A project type decides what a new project of that category is provisioned with."
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
                <Layers className="h-4 w-4" />
                Create project type
              </>
            )}
          </Button>
        </>
      }
    >
      <SettingsField label="Name" htmlFor="type-name">
        <Input
          id="type-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Development"
          maxLength={60}
          autoFocus
        />
      </SettingsField>

      <SettingsField label="Description" htmlFor="type-description">
        <Textarea
          id="type-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Software engineering and technical projects"
          maxLength={500}
          rows={3}
        />
      </SettingsField>

      <SettingsField
        label="Color"
        htmlFor="type-color"
        hint="Sets the title accent bar on this type's work items."
      >
        <div>
          <ColorPicker
            id="type-color"
            aria-label="Project type color"
            value={color}
            onChange={setColor}
          />
        </div>
      </SettingsField>

      <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Provision plans</span>
          <span className="text-xs text-muted-foreground">
            {isEdit
              ? "Controls whether new projects of this type attach plan modules and seed tasks."
              : "Creates the Professional, Ultimate and Enterprise plan templates with their default modules."}
          </span>
        </div>
        <Switch
          checked={isPlanAdd}
          onCheckedChange={setIsPlanAdd}
          aria-label="Provision plans"
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
