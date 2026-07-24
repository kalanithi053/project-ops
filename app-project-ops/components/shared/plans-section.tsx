"use client";

import * as React from "react";
import { Boxes, Check, Loader2, Pencil, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { QueryState } from "@/components/shared/query-state";
import { CardsSkeleton } from "@/components/shared/skeletons";
import {
  useActivatePlan,
  useModules,
  usePlans,
  useUpdateActivePlan,
  useUpdateModule,
} from "@/lib/api/hooks/use-plans";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/api/permissions";
import type { Plan, WorkspaceModule } from "@/lib/api/types";

function limit(value: number | undefined) {
  return value === undefined ? "—" : String(value);
}

/**
 * Plans (tiers) for one project type, each with its modules. The active
 * plan's limits can be edited and saved (PATCH /plans/active — the API
 * only allows editing whichever plan is currently active); inactive plans
 * can only be switched on via Activate. Modules can be edited regardless
 * of which plan is active.
 */
export function PlansSection({
  workspaceSlug,
  projectTypeId,
}: {
  workspaceSlug: string;
  projectTypeId?: string;
}) {
  const plansQuery = usePlans(workspaceSlug, projectTypeId);
  const activate = useActivatePlan(workspaceSlug);
  const { can } = usePermissions(workspaceSlug);

  const plans = plansQuery.data ?? [];
  const canManagePlan = can(PERMISSIONS.PLAN_MANAGE);

  if (!projectTypeId) {
    return (
      <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
        Select a project type to see its plans.
      </p>
    );
  }

  return (
    <QueryState
      isLoading={plansQuery.isLoading}
      isError={plansQuery.isError}
      error={plansQuery.error}
      onRetry={() => plansQuery.refetch()}
      skeleton={<CardsSkeleton count={3} />}
    >
      {plans.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No plans found for this project type.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={String(plan.id)}
              workspaceSlug={workspaceSlug}
              plan={plan}
              canManagePlan={canManagePlan}
              isActivating={activate.isPending && activate.variables === plan.id}
              onActivate={() => activate.mutate(String(plan.id))}
              activatePending={activate.isPending}
            />
          ))}
        </div>
      )}
    </QueryState>
  );
}

function PlanCard({
  workspaceSlug,
  plan,
  canManagePlan,
  isActivating,
  activatePending,
  onActivate,
}: {
  workspaceSlug: string;
  plan: Plan;
  canManagePlan: boolean;
  isActivating: boolean;
  activatePending: boolean;
  onActivate: () => void;
}) {
  const modulesQuery = useModules(workspaceSlug, String(plan.id));
  const updatePlan = useUpdateActivePlan(workspaceSlug);
  const { can } = usePermissions(workspaceSlug);
  const canManageModule = can(PERMISSIONS.MODULE_MANAGE);

  const [editing, setEditing] = React.useState(false);
  const [maxProjects, setMaxProjects] = React.useState(String(plan.maxProjects ?? 0));
  const [maxMembers, setMaxMembers] = React.useState(String(plan.maxMembers ?? 0));
  const [maxTasksPerModule, setMaxTasksPerModule] = React.useState(
    String(plan.maxTasksPerModule ?? 0),
  );

  function startEditing() {
    setMaxProjects(String(plan.maxProjects ?? 0));
    setMaxMembers(String(plan.maxMembers ?? 0));
    setMaxTasksPerModule(String(plan.maxTasksPerModule ?? 0));
    setEditing(true);
  }

  function save() {
    updatePlan.mutate(
      {
        maxProjects: Number(maxProjects) || 0,
        maxMembers: Number(maxMembers) || 0,
        maxTasksPerModule: Number(maxTasksPerModule) || 0,
      },
      { onSuccess: () => setEditing(false) },
    );
  }

  const modules = modulesQuery.data ?? [];

  return (
    <Card className={cn(plan.isActive && "border-foreground/30")}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{plan.name}</CardTitle>
        {plan.isActive ? (
          <div className="flex items-center gap-1.5">
            <Badge variant="success">Active</Badge>
            {canManagePlan && !editing && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Edit plan limits"
                onClick={startEditing}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ) : canManagePlan ? (
          <Button
            variant="outline"
            size="sm"
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
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {editing ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${plan.id}-projects`} className="text-[11px] text-muted-foreground">
                  Projects
                </Label>
                <Input
                  id={`${plan.id}-projects`}
                  type="number"
                  min={0}
                  value={maxProjects}
                  onChange={(e) => setMaxProjects(e.target.value)}
                  className="h-8 text-center"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${plan.id}-members`} className="text-[11px] text-muted-foreground">
                  Members
                </Label>
                <Input
                  id={`${plan.id}-members`}
                  type="number"
                  min={0}
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(e.target.value)}
                  className="h-8 text-center"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`${plan.id}-tasks`} className="text-[11px] text-muted-foreground">
                  Tasks/mod
                </Label>
                <Input
                  id={`${plan.id}-tasks`}
                  type="number"
                  min={0}
                  value={maxTasksPerModule}
                  onChange={(e) => setMaxTasksPerModule(e.target.value)}
                  className="h-8 text-center"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
                disabled={updatePlan.isPending}
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={updatePlan.isPending}>
                {updatePlan.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Projects" value={limit(plan.maxProjects)} />
            <Stat label="Members" value={limit(plan.maxMembers)} />
            <Stat label="Tasks/mod" value={limit(plan.maxTasksPerModule)} />
          </dl>
        )}

        <Separator />

        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Boxes className="h-3.5 w-3.5" />
            Modules ({modules.length})
          </p>
          {modulesQuery.isLoading ? (
            <div className="flex flex-col gap-1.5">
              <div className="h-5 animate-pulse rounded bg-muted" />
              <div className="h-5 animate-pulse rounded bg-muted" />
            </div>
          ) : modules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No modules on this plan.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {modules.map((module) => (
                <ModuleRow
                  key={String(module.id)}
                  workspaceSlug={workspaceSlug}
                  module={module}
                  canManage={canManageModule}
                />
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ModuleRow({
  workspaceSlug,
  module,
  canManage,
}: {
  workspaceSlug: string;
  module: WorkspaceModule;
  canManage: boolean;
}) {
  const updateModule = useUpdateModule(workspaceSlug);
  const [taskLimit, setTaskLimit] = React.useState(
    String(module.defaultTaskLimit ?? 0),
  );
  const [isActive, setIsActive] = React.useState(module.isActive ?? true);
  const dirty =
    Number(taskLimit) !== (module.defaultTaskLimit ?? 0) ||
    isActive !== (module.isActive ?? true);

  function save() {
    updateModule.mutate({
      id: String(module.id),
      dto: { defaultTaskLimit: Number(taskLimit) || 0, isActive },
    });
  }

  if (!canManage) {
    return (
      <li className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2">
          <Check className="h-3.5 w-3.5 text-status-success" />
          {module.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {module.defaultTaskLimit ?? "—"} tasks
        </span>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5 text-sm">
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <Checkbox
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        <span className="truncate">{module.name}</span>
      </label>
      <div className="flex shrink-0 items-center gap-1.5">
        <Input
          type="number"
          min={0}
          value={taskLimit}
          onChange={(e) => setTaskLimit(e.target.value)}
          className="h-7 w-16 text-center text-xs"
          aria-label={`${module.name} task limit`}
        />
        {dirty && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={`Save ${module.name}`}
            onClick={save}
            disabled={updateModule.isPending}
          >
            {updateModule.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5 text-status-success" />
            )}
          </Button>
        )}
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-md border border-border py-2">
      <dd className="text-sm font-semibold">{value}</dd>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
    </div>
  );
}
