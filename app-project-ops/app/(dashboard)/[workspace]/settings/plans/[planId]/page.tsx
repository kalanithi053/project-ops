"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Boxes, Loader2, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormPanel } from "@/components/shared/form-panel";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QueryState } from "@/components/shared/query-state";
import { TableSkeleton } from "@/components/shared/skeletons";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { SettingsField } from "@/components/settings/settings-section";
import { useWorkspaceSettings } from "@/lib/api/hooks/use-settings";
import {
  useCreateModule,
  useDeleteModule,
  useUpdateModules,
} from "@/lib/api/hooks/use-plans";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/api/permissions";
import type { PlanModule } from "@/lib/api/types";

/** Local, uncommitted edits for one module row. */
interface ModuleDraft {
  isActive: boolean;
  defaultTaskLimit: number;
}

export default function PlanModulesPage() {
  const { workspace, planId } = useParams<{
    workspace: string;
    planId: string;
  }>();
  const settings = useWorkspaceSettings(workspace);
  const updateModules = useUpdateModules(workspace);
  const removeModule = useDeleteModule(workspace);
  const { can } = usePermissions(workspace);

  const canManage = can(PERMISSIONS.MODULE_MANAGE);

  const plan = settings.data?.plans.find((item) => item.id === planId);
  const projectType = settings.data?.projectTypes.find(
    (type) => type.id === plan?.projectTypeId,
  );
  const modules = React.useMemo(() => plan?.modules ?? [], [plan]);

  // Drafts are compared against live server values rather than cleared on
  // refetch, so an edit that already landed stops counting as a change on its
  // own and an in-flight edit isn't discarded by a background refetch.
  const [drafts, setDrafts] = React.useState<Record<string, ModuleDraft>>({});
  const [adding, setAdding] = React.useState(false);
  const [deleting, setDeleting] = React.useState<PlanModule | null>(null);

  function draftFor(module: PlanModule): ModuleDraft {
    return (
      drafts[module.id] ?? {
        isActive: module.isActive,
        defaultTaskLimit: module.defaultTaskLimit,
      }
    );
  }

  function setDraft(module: PlanModule, patch: Partial<ModuleDraft>) {
    setDrafts((current) => ({
      ...current,
      [module.id]: { ...draftFor(module), ...patch },
    }));
  }

  const changed = modules.filter((module) => {
    const draft = drafts[module.id];
    if (!draft) return false;
    return (
      draft.isActive !== module.isActive ||
      draft.defaultTaskLimit !== module.defaultTaskLimit
    );
  });

  const dirty = changed.length > 0;

  function apply() {
    if (!dirty) return;
    updateModules.mutate(
      changed.map((module) => {
        const draft = draftFor(module);
        return {
          id: module.id,
          dto: {
            isActive: draft.isActive,
            defaultTaskLimit: draft.defaultTaskLimit,
          },
        };
      }),
      { onSuccess: () => setDrafts({}) },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground"
      >
        <Link href={`/${workspace}/settings/plans`}>
          <ArrowLeft className="h-4 w-4" />
          All plans
        </Link>
      </Button>

      <QueryState
        isLoading={settings.isLoading}
        isError={settings.isError}
        error={settings.error}
        onRetry={() => settings.refetch()}
        skeleton={<TableSkeleton columns={4} rows={9} />}
      >
        {!plan ? (
          <EmptyState
            icon={Boxes}
            title="Plan not found"
            description="This plan may have been deleted, or it belongs to another workspace."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href={`/${workspace}/settings/plans`}>Back to plans</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {plan.name}
                  </h2>
                  {plan.isActive ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="neutral">Inactive</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {projectType
                    ? `Modules provisioned for ${projectType.name} projects on this plan.`
                    : "Modules provisioned for projects on this plan."}
                </p>
              </div>

              {canManage && (
                <Button size="sm" onClick={() => setAdding(true)}>
                  <Plus className="h-4 w-4" />
                  Add Module
                </Button>
              )}
            </div>

            <Card className="overflow-hidden">
              <div className="flex flex-col gap-0.5 border-b border-border p-4">
                <h3 className="text-sm font-medium">Assigned Modules</h3>
                <p className="text-sm text-muted-foreground">
                  Turn modules on or off and set how many tasks each one
                  provisions per project.
                </p>
              </div>

              {modules.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No modules on this plan yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Module Name</TableHead>
                        <TableHead className="w-28">Status</TableHead>
                        <TableHead className="w-32">Task Limit</TableHead>
                        {canManage && <TableHead className="w-16" />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modules.map((module) => {
                        const draft = draftFor(module);
                        return (
                          <TableRow key={module.id}>
                            <TableCell>
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {module.name}
                                  </span>
                                  {module.isDefault && (
                                    <Badge
                                      variant="secondary"
                                      className="font-normal"
                                    >
                                      Default
                                    </Badge>
                                  )}
                                </div>
                                <span className="font-mono text-xs text-muted-foreground">
                                  {module.key}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={draft.isActive}
                                  onCheckedChange={(isActive) =>
                                    setDraft(module, { isActive })
                                  }
                                  disabled={!canManage}
                                  aria-label={`${module.name} enabled`}
                                />
                                <span className="text-xs text-muted-foreground">
                                  {draft.isActive ? "On" : "Off"}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                value={String(draft.defaultTaskLimit)}
                                onChange={(event) =>
                                  setDraft(module, {
                                    defaultTaskLimit: Math.max(
                                      0,
                                      Number(event.target.value) || 0,
                                    ),
                                  })
                                }
                                disabled={!canManage}
                                className="h-8 w-24"
                                aria-label={`${module.name} task limit`}
                              />
                            </TableCell>

                            {canManage && (
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  aria-label={`Remove ${module.name}`}
                                  onClick={() => setDeleting(module)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {canManage && modules.length > 0 && (
                <div className="flex flex-col-reverse gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    {dirty
                      ? `${changed.length} module${changed.length === 1 ? "" : "s"} changed — not saved yet.`
                      : "All changes saved."}
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDrafts({})}
                      disabled={!dirty || updateModules.isPending}
                    >
                      Discard Changes
                    </Button>
                    <Button
                      size="sm"
                      onClick={apply}
                      disabled={!dirty || updateModules.isPending}
                    >
                      {updateModules.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Applying…
                        </>
                      ) : (
                        "Apply"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </>
        )}
      </QueryState>

      {adding && plan && (
        <AddModuleDialog
          workspaceSlug={workspace}
          planId={plan.id}
          existingKeys={modules.map((module) => module.key)}
          onClose={() => setAdding(false)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Remove "${deleting?.name}" from this plan?`}
        description="Projects that already have this module attached must detach it first — the server will refuse otherwise."
        confirmLabel="Remove module"
        destructive
        pending={removeModule.isPending}
        onConfirm={() =>
          deleting &&
          removeModule.mutate(deleting.id, {
            onSuccess: () => setDeleting(null),
          })
        }
      />
    </div>
  );
}

/** Adds a module to this plan. `key` is immutable once created. */
function AddModuleDialog({
  workspaceSlug,
  planId,
  existingKeys,
  onClose,
}: {
  workspaceSlug: string;
  planId: string;
  existingKeys: string[];
  onClose: () => void;
}) {
  const create = useCreateModule(workspaceSlug);

  const [name, setName] = React.useState("");
  const [key, setKey] = React.useState("");
  const [keyTouched, setKeyTouched] = React.useState(false);
  const [taskLimit, setTaskLimit] = React.useState("10");
  const [error, setError] = React.useState<string | null>(null);

  // The key mirrors the name until the user edits it directly.
  const effectiveKey = keyTouched ? key : toModuleKey(name);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) return setError("Enter a module name.");
    if (!/^[a-z0-9_]+$/.test(effectiveKey)) {
      return setError("Key can only contain lowercase letters, numbers and underscores.");
    }
    if (existingKeys.includes(effectiveKey)) {
      return setError(`A module with the key "${effectiveKey}" is already on this plan.`);
    }

    const limit = Number(taskLimit);
    if (!Number.isInteger(limit) || limit < 0) {
      return setError("Task limit must be a whole number of 0 or more.");
    }

    create.mutate(
      {
        planId,
        key: effectiveKey,
        name: trimmedName,
        defaultTaskLimit: limit,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <FormPanel
      title="Add module"
      description="Modules group a project's tasks. The quantity is how many tasks each project is seeded with when the module is attached."
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
                Adding…
              </>
            ) : (
              <>
                <Boxes className="h-4 w-4" />
                Add module
              </>
            )}
          </Button>
        </>
      }
    >
      <SettingsField label="Module name" htmlFor="module-name">
        <Input
          id="module-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Task Management"
          maxLength={80}
          autoFocus
        />
      </SettingsField>

      <SettingsField
        label="Key"
        htmlFor="module-key"
        hint="Used in APIs and can't be changed later."
      >
        <Input
          id="module-key"
          value={effectiveKey}
          onChange={(event) => {
            setKeyTouched(true);
            setKey(toModuleKey(event.target.value));
          }}
          placeholder="task_management"
          maxLength={50}
          className="font-mono text-xs"
          spellCheck={false}
        />
      </SettingsField>

      <SettingsField
        label="Task quantity"
        htmlFor="module-limit"
        hint="How many tasks each project is seeded with. Tasks beyond this are still allowed, counted as add-ons."
      >
        <Input
          id="module-limit"
          type="number"
          min={0}
          value={taskLimit}
          onChange={(event) => setTaskLimit(event.target.value)}
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

/** Coerces a label into the lowercase snake_case form the API requires. */
function toModuleKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
