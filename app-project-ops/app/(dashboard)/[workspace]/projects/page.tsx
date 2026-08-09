"use client";

import {
  Eye,
  FileText,
  FolderKanban,
  ListChecks,
  Loader2,
  Plus,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";

import { PageContainer } from "@/components/layout/page-container";
import { DataTable } from "@/components/shared/data-table";
import { MultiSelectField } from "@/components/shared/multi-select-field";
import { PageHeader } from "@/components/shared/page-header";
import { QueryState } from "@/components/shared/query-state";
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
import { TableSkeleton } from "@/components/shared/skeletons";
import { StatsGrid } from "@/components/shared/stats-grid";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useHubs } from "@/lib/api/hooks/use-hubs";
import { useWorkspaceMembers } from "@/lib/api/hooks/use-members";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { usePlans } from "@/lib/api/hooks/use-plans";
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
  useProjects,
} from "@/lib/api/hooks/use-projects";
import { useMe } from "@/lib/api/hooks/use-users";
import { PERMISSIONS } from "@/lib/api/permissions";
import type {
  CreateProjectDto,
  Me,
  Project,
  ProjectEngagementType,
  ProjectType,
  WorkspaceMember,
} from "@/lib/api/types";
import { formatDate, todayDateInput } from "@/lib/format";
import { toast } from "@/lib/toast/toast-store";
import { getFullname } from "@/lib/utils";
import type { ColumnDef, RowAction, Tone } from "@/types/module";

/** Small rotating palette so distinct (dynamic) project types read apart. */
const TONE_CYCLE: Tone[] = ["info", "warning", "success", "neutral"];

function toneForType(typeId: string | undefined, types: ProjectType[]): Tone {
  if (!typeId) return "neutral";
  const index = types.findIndex((t) => String(t.id) === typeId);
  return TONE_CYCLE[index % TONE_CYCLE.length] ?? "neutral";
}

function daysBetween(start?: string, end?: string): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.round(ms / 86_400_000));
}

function fullName(person: { firstName?: string; lastName?: string }): string {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
}

/** Resolve a username to a first + last name using members + the current user. */
function resolveName(
  username: string,
  members: WorkspaceMember[],
  me: Me | undefined,
): string {
  if (me?.username === username) return fullName(me) || username;
  const match = members.find(
    (m) => (m.user?.username ?? m.username) === username,
  );
  const user = match?.user ?? match;
  return (user && fullName(user)) || username;
}

/**
 * Best-effort display of a project's owner/creator as a full name. Reads
 * whichever owner-ish field the API returns, mapping a username to first
 * + last name; returns null when no owner info is present.
 */
function ownerName(
  project: Project,
  members: WorkspaceMember[],
  me: Me | undefined,
): string | null {
  const candidates = [
    project.createdBy,
    project.owner,
    project.ownerUsername,
    project.createdByUsername,
    project.user,
    project.author,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    if (typeof raw === "string") return resolveName(raw, members, me);
    if (typeof raw === "object") {
      const record = raw as Record<string, unknown>;
      const full = fullName({
        firstName: record.firstName as string | undefined,
        lastName: record.lastName as string | undefined,
      });
      if (full) return full;
      if (typeof record.username === "string") {
        return resolveName(record.username, members, me);
      }
    }
  }
  return null;
}

export default function ProjectsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const { data, isLoading, isError, error, refetch } = useProjects(workspace);
  const { data: memberData } = useWorkspaceMembers(workspace);
  const { data: typeData } = useProjectTypes(workspace);
  const { data: me } = useMe();
  const { can } = usePermissions(workspace);
  const [open, setOpen] = React.useState(false);

  const projects = React.useMemo(() => data ?? [], [data]);
  const members = React.useMemo(() => memberData ?? [], [memberData]);
  const projectTypes = React.useMemo(() => typeData ?? [], [typeData]);

  const baseColumns = React.useMemo<ColumnDef<Project>[]>(
    () => [
      {
        key: "name",
        header: "Project",
        sortable: true,
        sortAccessor: (p) => p.name,
        cell: (p) => (
          <div className="flex flex-col">
            {/* The name is the primary way into a project — the row menu's
                View action is the discoverable duplicate, not the only path. */}
            <Link
              href={`/${workspace}/projects/${p.id}`}
              className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
            >
              {p.name}
            </Link>
          </div>
        ),
      },
      {
        key: "type",
        header: "Type",
        sortable: true,
        sortAccessor: (p) => p.projectType?.name ?? "",
        cell: (p) =>
          p.projectType ? (
            <StatusBadge
              label={p.projectType.name}
              tone={toneForType(p.projectType.id, projectTypes)}
            />
          ) : (
            "—"
          ),
      },
      {
        key: "startDate",
        header: "Start",
        hideBelow: "sm",
        sortable: true,
        sortAccessor: (p) => p.startDate ?? "",
        cell: (p) => (
          <span className="text-muted-foreground">
            {formatDate(p.startDate)}
          </span>
        ),
      },
      {
        key: "endDate",
        header: "End",
        hideBelow: "sm",
        sortable: true,
        sortAccessor: (p) => p.endDate ?? "",
        cell: (p) => (
          <span className="text-muted-foreground">{formatDate(p.endDate)}</span>
        ),
      },
      {
        key: "duration",
        header: "Duration",
        align: "right",
        hideBelow: "md",
        cell: (p) => {
          const days = daysBetween(p.startDate, p.endDate);
          return days === null ? "—" : `${days}d`;
        },
      },
    ],
    [projectTypes, workspace],
  );

  const rowActions = React.useMemo<RowAction<Project>[]>(
    () => [
      {
        label: "View project",
        icon: Eye,
        href: (p) => `/${workspace}/projects/${p.id}`,
      },
      {
        label: "Open work items",
        icon: ListChecks,
        href: (p) => `/${workspace}/projects/${p.id}/work-items`,
      },
    ],
    [workspace],
  );

  // Only show the "Created by" column when the API actually returns owner info.
  const columns = React.useMemo<ColumnDef<Project>[]>(() => {
    const hasOwner = projects.some((p) => ownerName(p, members, me));
    if (!hasOwner) return baseColumns;
    return [
      ...baseColumns,
      {
        key: "owner",
        header: "Created by",
        hideBelow: "lg",
        cell: (p) => ownerName(p, members, me) ?? "—",
      },
    ];
  }, [baseColumns, projects, members, me]);

  const stats = [
    { label: "Total Projects", value: projects.length, icon: FolderKanban },
    ...projectTypes.slice(0, 3).map((type) => ({
      label: type.name,
      value: projects.filter((p) => p.projectType?.id === type.id).length,
    })),
  ];

  return (
    <PageContainer className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Projects"
          description="Create and track projects in this workspace."
        />
        {can(PERMISSIONS.PROJECT_CREATE) && (
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                className="w-full sm:w-auto"
                data-tour="new-project-button"
              >
                <Plus className="h-4 w-4" />
                New project
              </Button>
            </SheetTrigger>
            <NewProjectPanel
              workspaceSlug={workspace}
              onDone={() => setOpen(false)}
            />
          </Sheet>
        )}
      </div>

      <StatsGrid stats={stats} />

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={<TableSkeleton columns={7} rows={10} />}
      >
        <DataTable
          columns={columns}
          data={projects}
          getRowId={(p) => String(p.id)}
          rowActions={rowActions}
          searchAccessors={[(p) => p.name, (p) => p.projectType?.name ?? ""]}
          searchPlaceholder="Search projects…"
          emptyMessage="No projects yet. Create your first project to get started."
        />
      </QueryState>
    </PageContainer>
  );
}

/**
 * New-project creation side panel. Slides in from the right; the form
 * scrolls independently of a sticky footer action.
 */
function NewProjectPanel({
  workspaceSlug,
  onDone,
}: {
  workspaceSlug: string;
  onDone: () => void;
}) {
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
  const [error, setError] = React.useState<string | null>(null);
  // Staged locally — there's no project id to upload against until the
  // create call below succeeds, so files are held here and uploaded
  // immediately afterward, before navigating into the new project.
  const [files, setFiles] = React.useState<File[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // Images embedded in the description via the editor's image button/paste —
  // same "no project id yet" problem, tracked separately by staging id so
  // `finalizeStagedImages` can splice the real attachment ids back in after
  // upload. A ref (not state): populated imperatively by the editor and only
  // ever read at submit time, so it doesn't need to drive a re-render.
  const stagedImagesRef = React.useRef<Map<string, File>>(new Map());
  const stagingIdCounter = React.useRef(0);

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
    };

    // API errors surface via the global error toast; success closes the panel
    // and drops the user straight into the new project's overview — which is
    // also where the project-overview tour offers itself for the first time.
    createProject.mutate(dto, {
      onSuccess: async (project) => {
        if (project?.id && files.length > 0) {
          setIsUploadingFiles(true);
          // Best-effort: apiFetch already toasts on a failed upload, so a
          // rejected file just doesn't hold up the rest or the navigation.
          await Promise.all(
            files.map((file) =>
              uploadProjectAttachment(workspaceSlug, project.id, file).catch(
                () => undefined,
              ),
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

        onDone();
        if (project?.id)
          router.push(`/${workspaceSlug}/projects/${project.id}`);
      },
    });
  }

  return (
    <SheetContent
      side="right"
      className="flex w-full flex-col gap-0 sm:max-w-md"
    >
      <SheetHeader>
        <SheetTitle className="text-base">New project</SheetTitle>
        <SheetDescription>
          Add a project and choose its project type.
        </SheetDescription>
      </SheetHeader>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
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
              <Label htmlFor="project-estimated-hours">Estimated Hours</Label>
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
                Each selected plan contributes its modules and a starter task
                per module.
              </p>
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
                {formatBytes(MAX_ATTACHMENT_BYTES)} per file, uploaded once the
                project is created
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
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {file.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatBytes(file.size)}
                    </span>
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
                  </li>
                ))}
              </ul>
            )}
          </div>

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
    </SheetContent>
  );
}
