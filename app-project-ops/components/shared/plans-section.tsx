"use client";

import { Boxes, Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { QueryState } from "@/components/shared/query-state";
import { CardsSkeleton } from "@/components/shared/skeletons";
import {
  useActivatePlan,
  useModules,
  usePlans,
} from "@/lib/api/hooks/use-plans";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/api/permissions";
import type { WorkspaceModule } from "@/lib/api/types";

function limit(value: number | undefined) {
  return value === undefined ? "—" : String(value);
}

/**
 * Workspace plans (tiers) and the modules each one provisions. The active
 * plan is highlighted; a user with `plan.manage` can switch the active
 * tier. Modules are read from GET /modules and grouped by their planId.
 */
export function PlansSection({ workspaceSlug }: { workspaceSlug: string }) {
  const plansQuery = usePlans(workspaceSlug);
  const { data: moduleData } = useModules(workspaceSlug);
  const activate = useActivatePlan(workspaceSlug);
  const { can } = usePermissions(workspaceSlug);

  const plans = plansQuery.data ?? [];
  const modules = moduleData ?? [];
  const canManage = can(PERMISSIONS.PLAN_MANAGE);

  const modulesByPlan = (planId: string): WorkspaceModule[] =>
    modules.filter((m) => m.planId === planId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-medium">Plans</h2>
        <p className="text-sm text-muted-foreground">
          Each plan provisions its own set of modules. One plan is active at a
          time.
        </p>
      </div>

      <QueryState
        isLoading={plansQuery.isLoading}
        isError={plansQuery.isError}
        error={plansQuery.error}
        onRetry={() => plansQuery.refetch()}
        skeleton={<CardsSkeleton count={3} />}
      >
        {plans.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            No plans found for this workspace.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => {
              const planModules = modulesByPlan(String(plan.id));
              const isActivating =
                activate.isPending && activate.variables === plan.id;
              return (
                <Card
                  key={String(plan.id)}
                  className={cn(plan.isActive && "border-foreground/30")}
                >
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    {plan.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : canManage ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={activate.isPending}
                        onClick={() => activate.mutate(String(plan.id))}
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
                    <dl className="grid grid-cols-3 gap-2 text-center">
                      <Stat label="Projects" value={limit(plan.maxProjects)} />
                      <Stat label="Members" value={limit(plan.maxMembers)} />
                      <Stat label="Tasks/mod" value={limit(plan.maxTasksPerModule)} />
                    </dl>

                    <Separator />

                    <div className="flex flex-col gap-2">
                      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <Boxes className="h-3.5 w-3.5" />
                        Modules ({planModules.length})
                      </p>
                      {planModules.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No modules on this plan.
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {planModules.map((module) => (
                            <li
                              key={String(module.id)}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <span className="flex items-center gap-2">
                                <Check className="h-3.5 w-3.5 text-status-success" />
                                {module.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {module.defaultTaskLimit ?? "—"} tasks
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </QueryState>
    </div>
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
