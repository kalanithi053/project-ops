"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";

import { MultiSelectField } from "@/components/shared/multi-select-field";
import {
  RichTextEditor,
  finalizeStagedImages,
  hasRichTextContent,
  richTextToPlainText,
  sanitizeRichText,
} from "@/components/shared/rich-text-editor";
import {
  SelectField,
  type SelectOption,
} from "@/components/shared/select-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useHubs } from "@/lib/api/hooks/use-hubs";
import { useWorkspaceMembers } from "@/lib/api/hooks/use-members";
import { useModulesForPlans, usePlans } from "@/lib/api/hooks/use-plans";
import { uploadProjectAttachment } from "@/lib/api/hooks/use-project-attachments";
import { useProjectTypes } from "@/lib/api/hooks/use-project-types";
import {
  useProjectModules,
  useUpdateProject,
} from "@/lib/api/hooks/use-projects";
import { todayDateInput } from "@/lib/format";
import { getFullname } from "@/lib/utils";
import type {
  ModuleSelectionDto,
  Project,
  ProjectEngagementType,
} from "@/lib/api/types";

const MAX_DESCRIPTION_CHARS = 20000;

/** Sentinel for "no sales rep / PM / engagement type" — SelectField has no native clear affordance. */
const NONE = "__none__";

/**
 * One row in the "Default Modules" checklist — either an existing catalog
 * module (`moduleId` set) or a brand-new one typed in on the spot
 * (`moduleId` unset; created under `planId` on save). `checked` reflects
 * whether the project currently has a ModuleInstance for it, not the
 * module's own catalog isDefault flag.
 */
interface ModuleRow {
  key: string;
  moduleId?: string;
  planId: string;
  name: string;
  taskLimit: number;
  checked: boolean;
  isNew: boolean;
}

/**
 * Edit panel for a project's full detail set — name, description, dates,
 * sales rep, project manager, engagement type/estimate, and project
 * type/hubs/plans/modules. Changing project type re-provisions the project
 * the same way picking one does on create; the module checklist reconciles
 * against whatever's already attached (existing tasks are never deleted,
 * only detached from a module that's no longer selected).
 */
export function EditProjectPanel({
  open,
  onOpenChange,
  workspaceSlug,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
  project: Project;
}) {
  const updateProject = useUpdateProject(workspaceSlug, project.id);
  const { data: memberData } = useWorkspaceMembers(workspaceSlug);
  const { data: typeData } = useProjectTypes(workspaceSlug);
  const { data: existingInstances, isLoading: instancesLoading } =
    useProjectModules(workspaceSlug, project.id);
  const [name, setName] = React.useState(project.name);
  const [description, setDescription] = React.useState(
    project.description ?? "",
  );
  const [startDate, setStartDate] = React.useState(
    project.startDate?.slice(0, 10) ?? "",
  );
  const [endDate, setEndDate] = React.useState(
    project.endDate?.slice(0, 10) ?? "",
  );
  const [salesRepId, setSalesRepId] = React.useState(
    project.salesRepId ?? NONE,
  );
  const [projectManagerId, setProjectManagerId] = React.useState(
    project.projectManagerId ?? NONE,
  );
  const [engagementType, setEngagementType] = React.useState(
    project.engagementType ?? NONE,
  );
  const [estimatedHours, setEstimatedHours] = React.useState(
    project.estimatedHours != null ? String(project.estimatedHours) : "",
  );
  const [estimatedDate, setEstimatedDate] = React.useState(
    project.estimatedDate?.slice(0, 10) ?? "",
  );
  const [projectTypeId, setProjectTypeId] = React.useState<string | undefined>(
    project.projectTypeId,
  );
  const [hubIds, setHubIds] = React.useState<string[]>(project.hubId ?? []);
  const [planIds, setPlanIds] = React.useState<string[]>(project.planId ?? []);
  const [moduleRows, setModuleRows] = React.useState<ModuleRow[]>([]);
  const [newModulePlanId, setNewModulePlanId] = React.useState<string>();
  const [newModuleName, setNewModuleName] = React.useState("");
  const [newModuleTaskLimit, setNewModuleTaskLimit] = React.useState("5");
  const [error, setError] = React.useState<string | null>(null);
  const [isUploadingImages, setIsUploadingImages] = React.useState(false);
  // Images inserted via the editor's image button, staged locally (a blob
  // preview only) until "Save changes" — see RichTextEditor's `onStageImage`.
  const stagedImagesRef = React.useRef<Map<string, File>>(new Map());
  const stagingIdCounter = React.useRef(0);

  function stageImage(file: File): string {
    const stagingId = `staging-${stagingIdCounter.current++}`;
    stagedImagesRef.current.set(stagingId, file);
    return stagingId;
  }

  const memberOptions: SelectOption[] = [
    { label: "Unassigned", value: NONE },
    ...(memberData ?? [])
      .filter((m) => m.user?.id)
      .map((m) => ({
        label: getFullname(m.user) ?? m.user?.email ?? "Unknown",
        value: String(m.user!.id),
      })),
  ];

  const engagementTypeOptions: SelectOption[] = [
    { label: "None", value: NONE },
    { label: "Fixed Budget", value: "fixed_budget" },
    { label: "Time and Material", value: "time_and_material" },
    { label: "Retainer", value: "retainer" },
  ];

  const typeOptions: SelectOption[] = (typeData ?? []).map((type) => ({
    label: type.name,
    value: String(type.id),
  }));

  // Project types with `isPlanAdd` provision plan-scoped modules — same
  // cascade as the New Project form: pick Hubs, then pick each Hub's tier.
  const selectedType = typeData?.find((t) => String(t.id) === projectTypeId);
  const requiresPlan = Boolean(selectedType?.isPlanAdd);
  const { data: hubData } = useHubs(
    workspaceSlug,
    requiresPlan ? projectTypeId : undefined,
  );
  const hubOptions: SelectOption[] = (hubData ?? []).map((hub) => ({
    label: hub.name,
    value: String(hub.id),
  }));
  const { data: planData } = usePlans(
    workspaceSlug,
    requiresPlan ? projectTypeId : undefined,
  );
  const planOptions: SelectOption[] = (planData ?? [])
    .filter((plan) => plan.hubId && hubIds.includes(plan.hubId))
    .map((plan) => ({
      label: `${plan.hub?.name ?? ""} ${plan.name}`.trim(),
      value: String(plan.id),
    }));

  function planLabel(planId: string): string {
    const plan = (planData ?? []).find((p) => String(p.id) === planId);
    return plan ? `${plan.hub?.name ?? ""} ${plan.name}`.trim() : "";
  }

  const { data: allModules, isLoading: modulesLoading } = useModulesForPlans(
    workspaceSlug,
    requiresPlan ? planIds : [],
  );
  const planIdsKey = planIds.join(",");

  // Seeds the checklist from the catalog whenever the selected plans
  // change, checking exactly what the project already has a ModuleInstance
  // for (not the module's own isDefault flag — that's only a hint on
  // create, and would otherwise wrongly resurrect a module the owner had
  // deliberately removed). Deliberately excludes `allModules`/
  // `existingInstances` from the deps, same reasoning as the New Project
  // form: they're fresh arrays every render, and re-seeding on a
  // background refetch would silently wipe in-progress edits.
  React.useEffect(() => {
    if (!requiresPlan || planIds.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModuleRows([]);
      return;
    }
    if (modulesLoading || instancesLoading) return;

    const existingByModuleId = new Map(
      (existingInstances ?? []).map((instance) => [instance.moduleId, instance]),
    );
    setModuleRows(
      (allModules ?? []).map((module) => {
        const existingInstance = existingByModuleId.get(String(module.id));
        return {
          key: String(module.id),
          moduleId: String(module.id),
          planId: String(module.planId),
          name: module.name,
          taskLimit: existingInstance
            ? existingInstance.taskLimit
            : module.defaultTaskLimit ?? 1,
          checked: Boolean(existingInstance),
          isNew: false,
        };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planIdsKey, modulesLoading, instancesLoading, requiresPlan]);

  function toggleModuleRow(key: string, checked: boolean) {
    setModuleRows((rows) =>
      rows.map((row) => (row.key === key ? { ...row, checked } : row)),
    );
  }

  function updateModuleTaskLimit(key: string, taskLimit: number) {
    setModuleRows((rows) =>
      rows.map((row) => (row.key === key ? { ...row, taskLimit } : row)),
    );
  }

  function addCustomModuleRow() {
    const name = newModuleName.trim();
    const targetPlanId = newModulePlanId ?? planIds[0];
    if (!name || !targetPlanId) return;
    const taskLimit = Math.max(0, Number(newModuleTaskLimit) || 0);
    setModuleRows((rows) => [
      ...rows,
      {
        key: `new-${rows.length}-${name}`,
        planId: targetPlanId,
        name,
        taskLimit,
        checked: true,
        isNew: true,
      },
    ]);
    setNewModuleName("");
    setNewModuleTaskLimit("5");
  }

  function handleTypeChange(value: string) {
    setProjectTypeId(value);
    // Hubs/Plans belong to a single type, so the previous picks can't carry over.
    setHubIds([]);
    setPlanIds([]);
  }

  function handleHubsChange(values: string[]) {
    setHubIds(values);
    // Drop any picked tier whose Hub just got deselected.
    setPlanIds((current) =>
      current.filter((id) => {
        const plan = (planData ?? []).find((p) => String(p.id) === id);
        return plan?.hubId && values.includes(plan.hubId);
      }),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Enter a project name.");
    if (!startDate) return setError("Choose a start date.");
    if (!endDate) return setError("Choose an end date.");
    if (endDate < startDate) {
      return setError("End date can't be before the start date.");
    }
    if (!projectTypeId) return setError("Select a project type.");
    // `requiresPlan` depends on typeData having loaded — submitting before
    // it has would default requiresPlan to false and wipe the project's
    // existing plans/hubs/modules below, so block until it's in.
    if (!typeData) {
      return setError("Still loading project types — try again in a moment.");
    }
    if (requiresPlan && hubIds.length === 0) {
      return setError("Select at least one hub.");
    }
    if (requiresPlan && planIds.length === 0) {
      return setError("Select at least one plan.");
    }

    const sanitizedDescription = sanitizeRichText(description).trim();
    // Finalizing only touches img tag attributes, never visible text, so the
    // length check is valid pre-upload — no point uploading images just to
    // reject the save afterward.
    const descriptionText = richTextToPlainText(sanitizedDescription).trim();
    if (descriptionText.length > MAX_DESCRIPTION_CHARS) {
      return setError(
        `Description must be ${MAX_DESCRIPTION_CHARS.toLocaleString()} characters or fewer.`,
      );
    }

    let finalDescription = sanitizedDescription;
    if (stagedImagesRef.current.size > 0) {
      setIsUploadingImages(true);
      const idMap = new Map<string, string>();
      // Best-effort: an image that fails to upload is dropped from the
      // description (by finalizeStagedImages) rather than holding up the rest.
      await Promise.all(
        Array.from(stagedImagesRef.current.entries()).map(
          async ([stagingId, file]) => {
            try {
              // isInline: false — a description's image is a real project
              // asset, so (unlike a comment's) it also shows in Attachments.
              const attachment = await uploadProjectAttachment(
                workspaceSlug,
                project.id,
                file,
                undefined,
                false,
              );
              idMap.set(stagingId, attachment.id);
            } catch {
              // Dropped below by finalizeStagedImages.
            }
          },
        ),
      );
      finalDescription = finalizeStagedImages(sanitizedDescription, idMap);
      setIsUploadingImages(false);
    }

    const moduleSelections: ModuleSelectionDto[] = requiresPlan
      ? moduleRows
          .filter((row) => row.checked)
          .map((row) =>
            row.moduleId
              ? { moduleId: row.moduleId, taskLimit: row.taskLimit }
              : { planId: row.planId, name: row.name, taskLimit: row.taskLimit },
          )
      : [];

    updateProject.mutate(
      {
        name: name.trim(),
        startDate,
        endDate,
        description: hasRichTextContent(finalDescription)
          ? finalDescription
          : undefined,
        projectTypeId,
        planId: requiresPlan ? planIds : [],
        hubId: requiresPlan ? hubIds : [],
        moduleSelections,
        salesRepId: salesRepId === NONE ? null : salesRepId,
        projectManagerId: projectManagerId === NONE ? null : projectManagerId,
        engagementType:
          engagementType === NONE
            ? null
            : (engagementType as ProjectEngagementType),
        estimatedHours:
          engagementType === "time_and_material"
            ? estimatedHours
              ? Number(estimatedHours)
              : null
            : null,
        estimatedDate:
          engagementType === "fixed_budget" || engagementType === "retainer"
            ? estimatedDate || null
            : null,
      },
      {
        onSuccess: () => {
          stagedImagesRef.current.clear();
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle className="text-base">Edit project</SheetTitle>
          <SheetDescription>
            Update the project&apos;s details.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-project-name">Project name</Label>
              <Input
                id="edit-project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-project-description">Description</Label>
              <RichTextEditor
                id="edit-project-description"
                value={description}
                onChange={setDescription}
                placeholder="Add a description…"
                aria-label="Description"
                disabled={isUploadingImages}
                imageContext={{ workspaceSlug, projectId: project.id }}
                onStageImage={stageImage}
                onRemoveStagedImage={(stagingId) =>
                  stagedImagesRef.current.delete(stagingId)
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-project-start">Start date</Label>
                <Input
                  id="edit-project-start"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-project-end">End date</Label>
                <Input
                  id="edit-project-end"
                  type="date"
                  value={endDate}
                  min={startDate || todayDateInput()}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-project-sales-rep">Sales Rep</Label>
              <SelectField
                id="edit-project-sales-rep"
                aria-label="Sales Rep"
                options={memberOptions}
                value={salesRepId}
                onValueChange={setSalesRepId}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-project-manager">Project Manager</Label>
              <SelectField
                id="edit-project-manager"
                aria-label="Project Manager"
                options={memberOptions}
                value={projectManagerId}
                onValueChange={setProjectManagerId}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-project-engagement-type">
                Engagement Type
              </Label>
              <SelectField
                id="edit-project-engagement-type"
                aria-label="Engagement Type"
                options={engagementTypeOptions}
                value={engagementType}
                onValueChange={setEngagementType}
              />
            </div>

            {engagementType === "time_and_material" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-project-estimated-hours">
                  Estimated Hours
                </Label>
                <Input
                  id="edit-project-estimated-hours"
                  type="number"
                  min={0}
                  placeholder="e.g. 120"
                  value={estimatedHours}
                  onChange={(event) => setEstimatedHours(event.target.value)}
                />
              </div>
            )}

            {(engagementType === "fixed_budget" ||
              engagementType === "retainer") && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-project-estimated-date">
                  Estimated Date
                </Label>
                <Input
                  id="edit-project-estimated-date"
                  type="date"
                  value={estimatedDate}
                  onChange={(event) => setEstimatedDate(event.target.value)}
                />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-project-type">Project type</Label>
              <SelectField
                id="edit-project-type"
                aria-label="Project type"
                options={typeOptions}
                value={projectTypeId}
                onValueChange={handleTypeChange}
                placeholder="Select a project type"
              />
              {projectTypeId !== project.projectTypeId && (
                <p className="text-xs text-status-warning">
                  Changing the project type resets Hubs, Plans, and Modules
                  below — pick them fresh before saving.
                </p>
              )}
            </div>

            {requiresPlan && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-project-hubs">Select Hubs</Label>
                <MultiSelectField
                  id="edit-project-hubs"
                  aria-label="Select Hubs"
                  options={hubOptions}
                  values={hubIds}
                  onValuesChange={handleHubsChange}
                  placeholder={
                    hubOptions.length === 0
                      ? "No hubs on this project type"
                      : "Select one or more hubs"
                  }
                  disabled={hubOptions.length === 0}
                />
              </div>
            )}

            {requiresPlan && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-project-plans">Plans</Label>
                <MultiSelectField
                  id="edit-project-plans"
                  aria-label="Plans"
                  options={planOptions}
                  values={planIds}
                  onValuesChange={setPlanIds}
                  placeholder={
                    hubIds.length === 0
                      ? "Select a hub first"
                      : planOptions.length === 0
                        ? "No plans on the selected hubs"
                        : "Select one or more plans"
                  }
                  disabled={planOptions.length === 0}
                />
              </div>
            )}

            {requiresPlan && planIds.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label>Default Modules</Label>
                <p className="text-xs text-muted-foreground">
                  Toggle which modules this project has, and how many tasks
                  each one allows. Unchecking a module detaches it — its
                  existing tasks stay, just no longer filed under it.
                </p>

                {modulesLoading || instancesLoading ? (
                  <div className="flex items-center gap-2 rounded-md border border-border p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading modules…
                  </div>
                ) : moduleRows.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                    No modules on the selected plans yet — add one below.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {planIds.map((planId) => {
                      const rows = moduleRows.filter(
                        (row) => row.planId === planId,
                      );
                      if (rows.length === 0) return null;
                      return (
                        <div key={planId} className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {planLabel(planId)}
                          </span>
                          {rows.map((row) => (
                            <div
                              key={row.key}
                              className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5"
                            >
                              <Checkbox
                                checked={row.checked}
                                onChange={(event) =>
                                  toggleModuleRow(
                                    row.key,
                                    event.target.checked,
                                  )
                                }
                                aria-label={`Include ${row.name}`}
                              />
                              <span className="min-w-0 flex-1 truncate text-sm">
                                {row.name}
                              </span>
                              {row.isNew && (
                                <Badge variant="outline" className="shrink-0">
                                  New
                                </Badge>
                              )}
                              <Input
                                type="number"
                                min={0}
                                value={row.taskLimit}
                                disabled={!row.checked}
                                onChange={(event) =>
                                  updateModuleTaskLimit(
                                    row.key,
                                    Math.max(0, Number(event.target.value) || 0),
                                  )
                                }
                                className="h-7 w-16 shrink-0 px-2 text-right text-sm"
                                aria-label={`${row.name} task count`}
                              />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-end gap-2 rounded-md border border-dashed border-border p-2.5">
                  <div className="flex flex-1 flex-col gap-1">
                    <Label htmlFor="edit-new-module-name" className="text-xs">
                      New module
                    </Label>
                    <Input
                      id="edit-new-module-name"
                      placeholder="e.g. Client Workshops"
                      value={newModuleName}
                      onChange={(event) => setNewModuleName(event.target.value)}
                      className="h-8"
                    />
                  </div>
                  {planIds.length > 1 && (
                    <div className="flex w-40 flex-col gap-1">
                      <Label htmlFor="edit-new-module-plan" className="text-xs">
                        Plan
                      </Label>
                      <SelectField
                        id="edit-new-module-plan"
                        aria-label="Plan for new module"
                        options={planIds.map((id) => ({
                          label: planLabel(id),
                          value: id,
                        }))}
                        value={newModulePlanId ?? planIds[0]}
                        onValueChange={setNewModulePlanId}
                        className="h-8"
                      />
                    </div>
                  )}
                  <div className="flex w-16 flex-col gap-1">
                    <Label htmlFor="edit-new-module-tasks" className="text-xs">
                      Tasks
                    </Label>
                    <Input
                      id="edit-new-module-tasks"
                      type="number"
                      min={0}
                      value={newModuleTaskLimit}
                      onChange={(event) =>
                        setNewModuleTaskLimit(event.target.value)
                      }
                      className="h-8 px-2"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 gap-1"
                    onClick={addCustomModuleRow}
                    disabled={!newModuleName.trim()}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
              </div>
            )}

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <div className="border-t border-border p-4">
            <Button
              type="submit"
              className="w-full"
              disabled={updateProject.isPending || isUploadingImages || !typeData}
            >
              {updateProject.isPending || isUploadingImages ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
