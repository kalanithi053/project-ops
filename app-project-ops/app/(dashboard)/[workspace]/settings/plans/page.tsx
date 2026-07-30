"use client";

import {
  Boxes,
  ChevronRight,
  Loader2,
  Package,
  Pencil,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import {
  SettingsField,
  SettingsSection,
} from "@/components/settings/settings-section";
import { EmptyState } from "@/components/shared/empty-state";
import { FormPanel } from "@/components/shared/form-panel";
import { QueryState } from "@/components/shared/query-state";
import {
  SelectField,
  type SelectOption,
} from "@/components/shared/select-field";
import { CardsSkeleton } from "@/components/shared/skeletons";
import { OwnerOnlyNotice } from "@/components/settings/owner-only-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import {
  useActivatePlan,
  useCreatePlan,
  useUpdatePlan,
} from "@/lib/api/hooks/use-plans";
import { useWorkspaceSettings } from "@/lib/api/hooks/use-settings";
import { useIsWorkspaceOwner } from "@/lib/api/hooks/use-workspace-owner";
import { PERMISSIONS } from "@/lib/api/permissions";
import type { PlanWithModules, ProjectType } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export default function PlansPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const settings = useWorkspaceSettings(workspace);
  const activate = useActivatePlan(workspace);
  const { can } = usePermissions(workspace);
  const { isOwner, isResolved } = useIsWorkspaceOwner(workspace);

  const canManage = can(PERMISSIONS.PLAN_MANAGE);
  // Memoized so the `?? []` fallbacks keep a stable identity across renders
  // and don't invalidate the grouping below on every pass.
  const plans = React.useMemo(
    () => settings.data?.plans ?? [],
    [settings.data],
  );
  const projectTypes = React.useMemo(
    () => settings.data?.projectTypes ?? [],
    [settings.data],
  );

  const [creating, setCreating] = React.useState(false);
  const [renaming, setRenaming] = React.useState<PlanWithModules | null>(null);

  // Only set once the user explicitly picks a type; until then the first
  // loaded type is used, derived rather than stored so there's no
  // effect-driven render cascade.
  const [projectTypeId, setProjectTypeId] = React.useState<string>();
  const selectedTypeId = projectTypeId ?? projectTypes[0]?.id;
  const selectedType = projectTypes.find((type) => type.id === selectedTypeId);

  const typeOptions: SelectOption[] = projectTypes
    ?.filter((type) => type.isPlanAdd)
    .map((type) => ({
      label: type.name,
      value: type.id,
    }));

  // A plan only means something inside its project type — project creation
  // picks a type first, then plans from it — so the type acts as the filter
  // rather than showing every plan in the workspace at once.
  const visiblePlans = plans.filter(
    (plan) => plan.projectTypeId === selectedTypeId,
  );

  const addButton =
    canManage && selectedType?.isPlanAdd ? (
      <Button
        size="sm"
        onClick={() => setCreating(true)}
        disabled={projectTypes.length === 0}
      >
        <Plus className="h-4 w-4" />
        Add Plan
      </Button>
    ) : null;
  React.useEffect(() => {
    setProjectTypeId(typeOptions[0]?.value);
  }, [typeOptions]);

  if (isResolved && !isOwner) {
    return (
      <SettingsSection
        title="Plans"
        description="Plan tiers per project type, and the modules each one provisions."
      >
        <OwnerOnlyNotice />
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="Plans"
      description="Plan tiers per project type, and the modules each one provisions."
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
            <label htmlFor="plans-project-type" className="text-sm font-medium">
              Project type
            </label>
            <SelectField
              id="plans-project-type"
              aria-label="Project type"
              options={typeOptions}
              value={selectedTypeId}
              onValueChange={setProjectTypeId}
              placeholder={
                projectTypes.length === 0
                  ? "No project types yet"
                  : "Select a project type"
              }
              disabled={projectTypes.length === 0}
            />
            {selectedType && (
              <p className="text-xs text-muted-foreground">
                {visiblePlans.length} plan
                {visiblePlans.length === 1 ? "" : "s"} under {selectedType.name}
                .
              </p>
            )}
          </div>

          {visiblePlans.length === 0 ? (
            <EmptyState
              icon={Package}
              title={
                selectedType
                  ? `No plans under ${selectedType.name}`
                  : "No plans"
              }
              description="Plans bundle the modules a project starts with. Add one to this project type to get started."
              action={addButton}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {visiblePlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  workspaceSlug={workspace}
                  plan={plan}
                  canManage={canManage}
                  isActivating={
                    activate.isPending && activate.variables === plan.id
                  }
                  activatePending={activate.isPending}
                  onActivate={() => activate.mutate(plan.id)}
                  onRename={() => setRenaming(plan)}
                />
              ))}
            </div>
          )}
        </div>
      </QueryState>

      {renaming && (
        <RenamePlanPanel
          workspaceSlug={workspace}
          plan={renaming}
          onClose={() => setRenaming(null)}
        />
      )}

      {creating && (
        <CreatePlanDialog
          workspaceSlug={workspace}
          projectTypes={projectTypes}
          defaultProjectTypeId={selectedTypeId}
          onClose={() => setCreating(false)}
        />
      )}
    </SettingsSection>
  );
}

function PlanCard({
  workspaceSlug,
  plan,
  canManage,
  isActivating,
  activatePending,
  onActivate,
  onRename,
}: {
  workspaceSlug: string;
  plan: PlanWithModules;
  canManage: boolean;
  isActivating: boolean;
  activatePending: boolean;
  onActivate: () => void;
  onRename: () => void;
}) {
  const modules = plan.modules ?? [];
  const activeModules = modules.filter((module) => module.isActive).length;

  return (
    <Card
      className={cn(
        "flex flex-col gap-3 p-4",
        plan.isActive && "border-foreground/25",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{plan.name}</span>
          {plan.isActive ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="neutral">Inactive</Badge>
          )}
        </div>

        {canManage && (
          <div className="flex shrink-0 items-center gap-1">
            {!plan.isActive && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={activatePending}
                onClick={onActivate}
              >
                {isActivating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Activating…
                  </>
                ) : (
                  "Activate"
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={`Rename ${plan.name}`}
              onClick={onRename}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Boxes className="h-3.5 w-3.5" />
        {activeModules} of {modules.length} module
        {modules.length === 1 ? "" : "s"} enabled
      </p>

      <Button asChild variant="outline" size="sm" className="justify-between">
        <Link href={`/${workspaceSlug}/settings/plans/${plan.id}`}>
          Manage modules
          <ChevronRight className="h-4 w-4" />
        </Link>
      </Button>
    </Card>
  );
}

/**
 * Creates a plan under a project type. The backend seeds the nine default
 * modules into the new plan, so it's usable immediately.
 */
function CreatePlanDialog({
  workspaceSlug,
  projectTypes,
  defaultProjectTypeId,
  onClose,
}: {
  workspaceSlug: string;
  projectTypes: ProjectType[];
  /** Pre-selects the type currently being filtered on. */
  defaultProjectTypeId?: string;
  onClose: () => void;
}) {
  const create = useCreatePlan(workspaceSlug);

  const [name, setName] = React.useState("");
  const [projectTypeId, setProjectTypeId] = React.useState<string | undefined>(
    defaultProjectTypeId ?? projectTypes[0]?.id,
  );
  const [error, setError] = React.useState<string | null>(null);

  const typeOptions: any[] = projectTypes.map((type) => ({
    ...type,
    label: type.name,
    value: type.id,
  }));

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      return setError("Plan name must be at least 2 characters.");
    }
    if (!projectTypeId) return setError("Choose a project type.");

    create.mutate(
      { name: trimmed, projectTypeId, isActive: false },
      { onSuccess: onClose },
    );
  }

  return (
    <FormPanel
      title="Add plan"
      description="A new plan is seeded with the default module set, which you can tailor afterwards."
      onClose={onClose}
      onSubmit={handleSubmit}
      busy={create.isPending}
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <Package className="h-4 w-4" />
                Create plan
              </>
            )}
          </Button>
        </>
      }
    >
      <SettingsField label="Plan name" htmlFor="plan-name">
        <Input
          id="plan-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Standard Plan"
          maxLength={50}
          autoFocus
        />
      </SettingsField>

      <SettingsField
        label="Project type"
        htmlFor="plan-project-type"
        hint="Plans belong to exactly one project type."
      >
        <SelectField
          id="plan-project-type"
          aria-label="Project type"
          options={typeOptions?.filter((type) => type.isPlanAdd)}
          value={projectTypeId}
          onValueChange={setProjectTypeId}
          placeholder="Select a project type"
        />
      </SettingsField>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </FormPanel>
  );
}

/** Renames a plan. Names are unique per project type, so a clash 409s. */
function RenamePlanPanel({
  workspaceSlug,
  plan,
  onClose,
}: {
  workspaceSlug: string;
  plan: PlanWithModules;
  onClose: () => void;
}) {
  const update = useUpdatePlan(workspaceSlug);
  const [name, setName] = React.useState(plan.name);
  const [error, setError] = React.useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      return setError("Plan name must be at least 2 characters.");
    }
    if (trimmed === plan.name) return onClose();

    update.mutate(
      { id: plan.id, dto: { name: trimmed } },
      { onSuccess: onClose },
    );
  }

  return (
    <FormPanel
      title="Rename plan"
      description="Plan names are unique within a project type."
      onClose={onClose}
      onSubmit={handleSubmit}
      busy={update.isPending}
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={update.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </>
      }
    >
      <SettingsField label="Plan name" htmlFor="rename-plan">
        <Input
          id="rename-plan"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={50}
          autoFocus
        />
      </SettingsField>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </FormPanel>
  );
}
