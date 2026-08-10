"use client";

import {
  FileText,
  Loader2,
  Lock,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";

import { PageContainer } from "@/components/layout/page-container";
import { MultiSelectField } from "@/components/shared/multi-select-field";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  RichTextEditor,
  finalizeStagedImages,
  richTextToPlainText,
  sanitizeRichText,
} from "@/components/shared/rich-text-editor";
import {
  SelectField,
  type SelectOption,
} from "@/components/shared/select-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHubs } from "@/lib/api/hooks/use-hubs";
import { useWorkspaceMembers } from "@/lib/api/hooks/use-members";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { useModulesForPlans, usePlans } from "@/lib/api/hooks/use-plans";
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENT_BYTES,
  formatBytes,
  isAllowedAttachmentFile,
  uploadProjectAttachment,
} from "@/lib/api/hooks/use-project-attachments";
import { useProjectTypes } from "@/lib/api/hooks/use-project-types";
import {
  updateProject,
  useCreateProject,
} from "@/lib/api/hooks/use-projects";
import { PERMISSIONS } from "@/lib/api/permissions";
import type {
  CreateProjectDto,
  ModuleSelectionDto,
  ProjectEngagementType,
} from "@/lib/api/types";
import { todayDateInput } from "@/lib/format";
import { toast } from "@/lib/toast/toast-store";
import { getFullname } from "@/lib/utils";

/**
 * One row in the New Project form's "Default Modules" checklist — either an
 * existing catalog module (`moduleId` set) or a brand-new one the user typed
 * in on the spot (`moduleId` unset; created under `planId` on submit). The
 * task count is always editable per-project, independent of the module's
 * own catalog default.
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
 * Full-page project creation flow. Previously a slide-in panel; broken out
 * to its own route since the form (plan/hub/module provisioning, staged
 * attachments) outgrew a sheet.
 */
export default function NewProjectPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const { can, isResolved } = usePermissions(workspace);

  if (isResolved && !can(PERMISSIONS.PROJECT_CREATE)) {
    return (
      <PageContainer className="flex flex-col gap-6">
        <PageHeader
          title="New project"
          description="Create and track a new project in this workspace."
        />
        <EmptyState
          icon={Lock}
          title="You don't have permission to create projects"
          description="Ask a workspace owner or admin to grant you project.create access."
        />
      </PageContainer>
    );
  }

  return <NewProjectForm workspaceSlug={workspace} />;
}

function NewProjectForm({ workspaceSlug }: { workspaceSlug: string }) {
  const router = useRouter();
  const createProject = useCreateProject(workspaceSlug);
  const { data: typeData } = useProjectTypes(workspaceSlug);
  const { data: memberData } = useWorkspaceMembers(workspaceSlug);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [startDate, setStartDate] = React.useState(todayDateInput);
  const [endDate, setEndDate] = React.useState("");
  const [salesRepId, setSalesRepId] = React.useState<string>();
  const [projectManagerId, setProjectManagerId] = React.useState<string>();
  const [engagementType, setEngagementType] =
    React.useState<ProjectEngagementType>();
  const [estimatedHours, setEstimatedHours] = React.useState("");
  const [estimatedDate, setEstimatedDate] = React.useState("");
  const [projectTypeId, setProjectTypeId] = React.useState<string>();
  const [hubIds, setHubIds] = React.useState<string[]>([]);
  const [planIds, setPlanIds] = React.useState<string[]>([]);
  const [moduleRows, setModuleRows] = React.useState<ModuleRow[]>([]);
  const [newModulePlanId, setNewModulePlanId] = React.useState<string>();
  const [newModuleName, setNewModuleName] = React.useState("");
  const [newModuleTaskLimit, setNewModuleTaskLimit] = React.useState("5");
  const [error, setError] = React.useState<string | null>(null);
  // Staged locally — there's no project id to upload against until the
  // create call below succeeds, so files are held here and uploaded
  // immediately afterward, before navigating into the new project.
  const [files, setFiles] = React.useState<File[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = React.useState(false);
  // Keyed by index into `files` — stable for the upload phase since files
  // can only be removed before submitting, not while uploads are in flight.
  const [fileProgress, setFileProgress] = React.useState<Record<number, number>>(
    {},
  );
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // Images embedded in the description via the editor's image button/paste —
  // same "no project id yet" problem, tracked separately by staging id so
  // `finalizeStagedImages` can splice the real attachment ids back in after
  // upload. A ref (not state): populated imperatively by the editor and only
  // ever read at submit time, so it doesn't need to drive a re-render.
  const stagedImagesRef = React.useRef<Map<string, File>>(new Map());

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const accepted: File[] = [];
    for (const file of Array.from(list)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(
          "File too large",
          `${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_ATTACHMENT_BYTES)}.`,
        );
        continue;
      }
      if (!isAllowedAttachmentFile(file)) {
        toast.error(
          "Unsupported file type",
          `${file.name} — allowed: images, PDF, Word, Excel, CSV.`,
        );
        continue;
      }
      accepted.push(file);
    }
    setFiles((current) => [...current, ...accepted]);
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, i) => i !== index));
  }

  const typeOptions: SelectOption[] = (typeData ?? []).map((type) => ({
    label: type.name,
    value: String(type.id),
  }));

  const memberOptions: SelectOption[] = (memberData ?? [])
    .filter((m) => m.user?.id)
    .map((m) => ({
      label: getFullname(m.user) ?? m.user?.email ?? "Unknown",
      value: String(m.user!.id),
    }));

  const engagementTypeOptions: SelectOption[] = [
    { label: "Fixed Budget", value: "fixed_budget" },
    { label: "Time and Material", value: "time_and_material" },
    { label: "Retainer", value: "retainer" },
  ];

  // Project types with `isPlanAdd` provision plan-scoped modules — the API
  // requires at least one explicit plan for those (it does not fall back to
  // the workspace's active plan despite what the docs imply). For HubSpot
  // that plan choice is now a two-step cascade: pick Hubs, then pick each
  // selected Hub's tier.
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
  // Only hub-scoped tiers, limited to whichever Hubs are currently selected —
  // picking a Hub is what makes its tiers choosable.
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

  // Every module under each selected plan (not just its isDefault set), so
  // the checklist below can offer modules that aren't auto-included too.
  const { data: allModules, isLoading: modulesLoading } = useModulesForPlans(
    workspaceSlug,
    requiresPlan ? planIds : [],
  );
  const planIdsKey = planIds.join(",");

  // Rebuilds the checklist from the catalog whenever the selected plans
  // change — mirrors handleHubsChange/handleTypeChange below, which also
  // reset dependent picks rather than trying to merge them. Deliberately
  // excludes `allModules` from the deps: it's a fresh array every render,
  // and re-seeding on a background refetch would silently wipe in-progress
  // edits (e.g. after a tab refocus).
  React.useEffect(() => {
    if (!requiresPlan || planIds.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModuleRows([]);
      return;
    }
    if (modulesLoading) return;

    setModuleRows(
      (allModules ?? []).map((module) => ({
        key: String(module.id),
        moduleId: String(module.id),
        planId: String(module.planId),
        name: module.name,
        taskLimit: module.defaultTaskLimit ?? 1,
        checked: Boolean(module.isDefault),
        isNew: false,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planIdsKey, modulesLoading, requiresPlan]);

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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Enter a project name.");
    if (!projectTypeId) return setError("Select a project type.");
    if (requiresPlan && hubIds.length === 0) {
      return setError("Select at least one hub.");
    }
    if (requiresPlan && planIds.length === 0) {
      return setError("Select at least one plan.");
    }
    if (!startDate) return setError("Choose a start date.");
    if (!endDate) return setError("Choose an end date.");
    if (endDate < startDate) {
      return setError("End date can't be before the start date.");
    }

    const sanitizedDescription = sanitizeRichText(description).trim();
    // Staged images (see `stageImage`/`onStageImage` below) have no
    // attachment id yet — the project doesn't exist to upload against until
    // the create call below succeeds — so they're stripped from what's sent
    // now and spliced back in with real ids once uploaded, in onSuccess.
    const hasStagedImages = stagedImagesRef.current.size > 0;
    const initialDescription = hasStagedImages
      ? finalizeStagedImages(sanitizedDescription, new Map())
      : sanitizedDescription;
    const descriptionText = richTextToPlainText(initialDescription).trim();

    const moduleSelections: ModuleSelectionDto[] | undefined = requiresPlan
      ? moduleRows
          .filter((row) => row.checked)
          .map((row) =>
            row.moduleId
              ? { moduleId: row.moduleId, taskLimit: row.taskLimit }
              : { planId: row.planId, name: row.name, taskLimit: row.taskLimit },
          )
      : undefined;

    const dto: CreateProjectDto = {
      name: name.trim(),
      projectTypeId,
      startDate,
      endDate,
      description: descriptionText ? initialDescription : undefined,
      // Always an array — the backend validates with @IsArray, so a bare
      // string is rejected outright.
      planId: requiresPlan ? planIds : undefined,
      hubId: requiresPlan ? hubIds : undefined,
      salesRepId: salesRepId || undefined,
      projectManagerId: projectManagerId || undefined,
      engagementType,
      estimatedHours:
        engagementType === "time_and_material" && estimatedHours
          ? Number(estimatedHours)
          : undefined,
      estimatedDate:
        (engagementType === "fixed_budget" || engagementType === "retainer") &&
        estimatedDate
          ? estimatedDate
          : undefined,
      moduleSelections,
    };

    // API errors surface via the global error toast; success drops the user
    // straight into the new project's overview — which is also where the
    // project-overview tour offers itself for the first time.
    createProject.mutate(dto, {
      onSuccess: async (project) => {
        if (project?.id && files.length > 0) {
          setIsUploadingFiles(true);
          // Best-effort: apiUpload already toasts on a failed upload, so a
          // rejected file just doesn't hold up the rest or the navigation.
          await Promise.all(
            files.map((file, index) =>
              uploadProjectAttachment(
                workspaceSlug,
                project.id,
                file,
                undefined,
                false,
                (progress) =>
                  setFileProgress((current) => ({
                    ...current,
                    [index]: progress,
                  })),
              )
                .then((attachment) => {
                  toast.success("Uploaded successfully", attachment.fileName);
                })
                .catch(() => undefined),
            ),
          );
          setIsUploadingFiles(false);
        }

        if (project?.id && hasStagedImages) {
          setIsUploadingFiles(true);
          const idMap = new Map<string, string>();
          // Best-effort, same as the attachments above — an image that
          // fails to upload is dropped from the description (by
          // finalizeStagedImages) rather than holding up the rest.
          await Promise.all(
            Array.from(stagedImagesRef.current.entries()).map(
              async ([stagingId, file]) => {
                try {
                  // isInline: false — a description's image is a real
                  // project asset, so (unlike a comment's) it also shows in
                  // Attachments.
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
          setIsUploadingFiles(false);

          const finalDescription = finalizeStagedImages(
            sanitizedDescription,
            idMap,
          );
          if (finalDescription !== initialDescription) {
            await updateProject(workspaceSlug, project.id, {
              description: finalDescription,
            }).catch(() => undefined);
          }
        }

        if (project?.id)
          router.push(`/${workspaceSlug}/projects/${project.id}`);
      },
    });
  }

  return (
    <PageContainer className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="New project"
          description="Add a project and choose its project type."
        />
        <Button variant="outline" className="w-full sm:w-auto" asChild>
          <Link href={`/${workspaceSlug}/projects`}>Cancel</Link>
        </Button>
      </div>

      <Card className="mx-auto w-full max-w-2xl">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input
                id="project-name"
                placeholder="Website Redesign"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="project-start">Start date</Label>
                <Input
                  id="project-start"
                  type="date"
                  value={startDate}
                  min={todayDateInput()}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="project-end">End date</Label>
                <Input
                  id="project-end"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="project-sales-rep">Sales Rep</Label>
              <SelectField
                id="project-sales-rep"
                aria-label="Sales Rep"
                options={memberOptions}
                value={salesRepId}
                onValueChange={setSalesRepId}
                placeholder="Select a sales rep"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="project-manager">Project Manager</Label>
              <SelectField
                id="project-manager"
                aria-label="Project Manager"
                options={memberOptions}
                value={projectManagerId}
                onValueChange={setProjectManagerId}
                placeholder="Select a project manager"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="project-engagement-type">Engagement Type</Label>
              <SelectField
                id="project-engagement-type"
                aria-label="Engagement Type"
                options={engagementTypeOptions}
                value={engagementType}
                onValueChange={(value) =>
                  setEngagementType(value as ProjectEngagementType)
                }
                placeholder="Select an engagement type"
              />
            </div>

            {engagementType === "time_and_material" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="project-estimated-hours">
                  Estimated Hours
                </Label>
                <Input
                  id="project-estimated-hours"
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
                <Label htmlFor="project-estimated-date">Estimated Date</Label>
                <Input
                  id="project-estimated-date"
                  type="date"
                  min={startDate || undefined}
                  value={estimatedDate}
                  onChange={(event) => setEstimatedDate(event.target.value)}
                />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="project-type">Project type</Label>
              <SelectField
                id="project-type"
                aria-label="Project type"
                options={typeOptions}
                value={projectTypeId}
                onValueChange={handleTypeChange}
                placeholder="Select a project type"
              />
            </div>

            {requiresPlan && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="project-hubs">Select Hubs</Label>
                <MultiSelectField
                  id="project-hubs"
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
                <Label htmlFor="project-plans">Plans</Label>
                <MultiSelectField
                  id="project-plans"
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
                <p className="text-xs text-muted-foreground">
                  Each selected plan contributes its modules and a starter
                  task per module.
                </p>
              </div>
            )}

            {requiresPlan && planIds.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label>Default Modules</Label>
                <p className="text-xs text-muted-foreground">
                  Toggle which modules this project starts with, and how many
                  starter tasks each one seeds — just for this project.
                </p>

                {modulesLoading ? (
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
                    <Label htmlFor="new-module-name" className="text-xs">
                      New module
                    </Label>
                    <Input
                      id="new-module-name"
                      placeholder="e.g. Client Workshops"
                      value={newModuleName}
                      onChange={(event) => setNewModuleName(event.target.value)}
                      className="h-8"
                    />
                  </div>
                  {planIds.length > 1 && (
                    <div className="flex w-40 flex-col gap-1">
                      <Label htmlFor="new-module-plan" className="text-xs">
                        Plan
                      </Label>
                      <SelectField
                        id="new-module-plan"
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
                    <Label htmlFor="new-module-tasks" className="text-xs">
                      Tasks
                    </Label>
                    <Input
                      id="new-module-tasks"
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

            <div className="flex flex-col gap-2">
              <Label htmlFor="project-description">Description</Label>
              <RichTextEditor
                id="project-description"
                value={description}
                onChange={setDescription}
                placeholder="Optional summary"
                aria-label="Description"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="project-attachments">Attachments</Label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed border-border px-3 py-4 text-center transition-colors hover:border-foreground/30 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Click to attach files</span>
                <span className="text-xs text-muted-foreground">
                  Images, PDF, Word, Excel, or CSV — up to{" "}
                  {formatBytes(MAX_ATTACHMENT_BYTES)} per file, uploaded once
                  the project is created
                </span>
              </button>
              <input
                ref={fileInputRef}
                id="project-attachments"
                type="file"
                multiple
                accept={ATTACHMENT_ACCEPT}
                className="hidden"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              {files.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {files.map((file, index) => {
                    const progress = fileProgress[index];
                    const isUploadingThis =
                      isUploadingFiles && progress !== undefined;
                    return (
                      <li
                        key={`${file.name}-${index}`}
                        className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5"
                      >
                        {isUploadingThis ? (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                        ) : (
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="truncate text-sm">
                            {file.name}
                          </span>
                          {isUploadingThis && (
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary transition-[width]"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {isUploadingThis
                            ? `${progress}%`
                            : formatBytes(file.size)}
                        </span>
                        {!isUploadingFiles && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            aria-label={`Remove ${file.name}`}
                            onClick={() => removeFile(index)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" type="button" asChild>
                <Link href={`/${workspaceSlug}/projects`}>Cancel</Link>
              </Button>
              <Button
                type="submit"
                disabled={createProject.isPending || isUploadingFiles}
              >
                {createProject.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : isUploadingFiles ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading files…
                  </>
                ) : (
                  "Create project"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
