"use client";

import {
  Check,
  ChevronDown,
  FolderKanban,
  ListChecks,
  Loader2,
  Save,
  Undo2,
} from "lucide-react";
import * as React from "react";

import { CopyWorkItemLink } from "@/components/projects/copy-work-item-link";
import { ProjectAttachments } from "@/components/projects/project-attachments";
import { TaskActivity } from "@/components/projects/task-activity";
import { TaskComments } from "@/components/projects/task-comments";
import { TimeLogPanel } from "@/components/projects/time-log-panel";
import { TimeLogTimerButton } from "@/components/projects/time-log-timer-button";
import { SettingsField } from "@/components/settings/settings-section";
import {
  RichTextEditor,
  finalizeStagedImages,
  hasRichTextContent,
  sanitizeRichText,
} from "@/components/shared/rich-text-editor";
import {
  SelectField,
  type SelectOption,
} from "@/components/shared/select-field";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { usePriorities } from "@/lib/api/hooks/use-priorities";
import { useProjectMembers } from "@/lib/api/hooks/use-project-members";
import { uploadProjectAttachment } from "@/lib/api/hooks/use-project-attachments";
import { useProject, useProjectModules } from "@/lib/api/hooks/use-projects";
import { useCreateTask, useUpdateTask } from "@/lib/api/hooks/use-tasks";
import { useTicketStatuses } from "@/lib/api/hooks/use-ticket-statuses";
import { useMe } from "@/lib/api/hooks/use-users";
import { useWorkTypes } from "@/lib/api/hooks/use-work-types";
import type { CreateTaskDto, Task, UpdateMeDto } from "@/lib/api/types";
import { todayDateInput } from "@/lib/format";
import { cn, getFullname } from "@/lib/utils";

/** ISO timestamp -> the `YYYY-MM-DD` an <input type="date"> expects. */
function toDateInput(value?: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

interface TaskEditorProps {
  workspaceSlug: string;
  projectId: string;
  /** null creates a new task. */
  task: Task | null;
  defaultStatusId?: string;
  /** WorkType chosen in the create-flow picker (task/incident/bug/…). */
  defaultWorkItemTypeId?: string;
  canSave: boolean;
  /**
   * The caller's workspace role name. A Client holds WORKITEM_UPDATE (so
   * `canSave` is true) but the backend only lets them change `statusId`, and
   * only on a task where they're the assignee or QA assignee — see
   * WorkItemsService.assertClientCanUpdate. Narrows the UI to match: every
   * other field stays read-only, and the status control only lights up on
   * their own task. Undefined (role not resolved yet) behaves like any
   * non-Client role, matching usePermissions' fail-open default.
   */
  roleName?: string;
  canComment: boolean;
  canCreateAttachment: boolean;
  canDeleteAttachment: boolean;
  onDone: () => void;
  /** Fired after a successful create/update with the saved work item's id. */
  onSaved: (workItemId: string) => void;
}

/**
 * Dedicated create/edit form for a task. It is rendered by task routes that
 * the board opens in a separate browser tab.
 *
 * Every select omits a "None" choice on purpose: the API applies updates as
 * `field ?? undefined`, so a null is silently ignored — a value can be
 * changed but never cleared. Offering "None" would look like it worked.
 */
export function TaskEditor({
  workspaceSlug,
  projectId,
  task,
  defaultStatusId,
  defaultWorkItemTypeId,
  canSave,
  roleName,
  canComment,
  canCreateAttachment,
  canDeleteAttachment,
  onDone,
  onSaved,
}: TaskEditorProps) {
  const create = useCreateTask(workspaceSlug, projectId);
  const update = useUpdateTask(workspaceSlug, projectId);
  const { data: workTypes } = useWorkTypes(workspaceSlug);
  const { data: me } = useMe();

  const { data: modules } = useProjectModules(workspaceSlug, projectId);
  const { data: project } = useProject(workspaceSlug, projectId);
  const { data: members } = useProjectMembers(workspaceSlug, projectId);
  const { data: statuses } = useTicketStatuses(workspaceSlug);
  const { data: priorities } = usePriorities(workspaceSlug);

  // A task can't be scheduled outside its project's window — the API enforces
  // this too, so the inputs are clamped rather than letting the user pick a
  // date that will only fail on save.
  const projectStart = toDateInput(project?.startDate);
  const projectEnd = toDateInput(project?.endDate);

  const isEdit = Boolean(task);

  const [name, setName] = React.useState(task?.name ?? "");
  const [description, setDescription] = React.useState(task?.description ?? "");
  const [isUploadingImages, setIsUploadingImages] = React.useState(false);
  const pending = create.isPending || update.isPending || isUploadingImages;
  // Images inserted via the description editor's image button, staged
  // locally (a blob preview only) until "Save changes" — see
  // RichTextEditor's `onStageImage`.
  const stagedImagesRef = React.useRef<Map<string, File>>(new Map());
  const stagingIdCounter = React.useRef(0);

  function stageImage(file: File): string {
    const stagingId = `staging-${stagingIdCounter.current++}`;
    stagedImagesRef.current.set(stagingId, file);
    return stagingId;
  }
  const [moduleInstanceId, setModuleInstanceId] = React.useState<
    string | undefined
  >(task?.moduleInstanceId ?? undefined);
  const [workItemTypeId] = React.useState<string | undefined>(
    task?.workItemTypeId ?? defaultWorkItemTypeId,
  );
  const [statusId, setStatusId] = React.useState<string | undefined>(
    task?.statusId ?? defaultStatusId,
  );
  const [priorityId, setPriorityId] = React.useState<string | undefined>(
    task?.priorityId ?? undefined,
  );
  const [assigneeIds, setAssigneeIds] = React.useState<string>(
    task?.assigneeId ?? "",
  );
  // New work items default to the creator as assignee — still fully
  // editable before saving. Only fires once (there's no "None" option to
  // clear back to, per this file's own comment below), and only on create;
  // `me` loads asynchronously so this can't be a plain useState initializer.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isEdit && !assigneeIds && me?.id) setAssigneeIds(me.id);
  }, [isEdit, me, assigneeIds]);
  const [qaAssigneeId, setQaAssigneeId] = React.useState<string>(
    task?.qaAssigneeId ?? "",
  );
  const [etaHours, setEtaHours] = React.useState(
    task?.estimateHours != null
      ? String(task.estimateHours)
      : task?.etaHours != null
        ? String(task.etaHours)
        : "",
  );
  const [completedHours, setCompletedHours] = React.useState(
    task?.completedHours != null ? String(task.completedHours) : "",
  );
  const [startDate, setStartDate] = React.useState(
    task ? toDateInput(task.startDate) : todayDateInput(),
  );
  const [dueDate, setDueDate] = React.useState(toDateInput(task?.dueDate));
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<
    "details" | "activity" | "timeLogs" | "attachments"
  >("details");
  const canLogTime = Boolean(task && me?.id && me.id === task.assigneeId);
  // See the `roleName` prop doc: a Client can only flip status, and only on
  // a task they're the assignee or QA assignee of.
  const isClientRole = roleName === "Client";
  const isAssigneeOrQa = Boolean(
    task && me?.id && (task.assigneeId === me.id || task.qaAssigneeId === me.id),
  );
  const canFullEdit = canSave && !isClientRole;
  const canChangeStatus = canSave && (!isClientRole || isAssigneeOrQa);

  // Captured once from the task being edited, so "Save changes" can stay
  // disabled until the user actually changes something rather than just
  // whenever a name is present (every existing task already has one).
  // `useState` (never written to again) rather than a ref — refs aren't
  // meant to be read during render, only `.current`-mutated outside it.
  const [initialSnapshot] = React.useState(() => ({
    name: task?.name ?? "",
    description: task?.description ?? "",
    moduleInstanceId: task?.moduleInstanceId ?? undefined,
    statusId: task?.statusId ?? defaultStatusId,
    priorityId: task?.priorityId ?? undefined,
    assigneeIds: task?.assigneeId ?? "",
    qaAssigneeId: task?.qaAssigneeId ?? "",
    etaHours:
      task?.estimateHours != null
        ? String(task.estimateHours)
        : task?.etaHours != null
          ? String(task.etaHours)
          : "",
    completedHours:
      task?.completedHours != null ? String(task.completedHours) : "",
    startDate: task ? toDateInput(task.startDate) : todayDateInput(),
    dueDate: toDateInput(task?.dueDate),
  }));

  const moduleOptions: SelectOption[] = (modules ?? []).map((instance) => ({
    label: instance.module.name,
    value: instance.id,
  }));
  const statusOptions: SelectOption[] = [...(statuses ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((status) => ({ label: status.name, value: status.id }));
  const priorityOptions: SelectOption[] = [...(priorities ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((priority) => ({ label: priority.name, value: priority.id }));
  // Assignees come from the project's own members, not the whole workspace —
  // you can only hand work to someone who has access to the project.
  const assigneeOptions: SelectOption[] = (members ?? [])
    .filter((member) => member.status !== "removed" && member.user?.id)
    .map((member) => ({
      label: getFullname(member?.user as UpdateMeDto) ?? "Unknown",
      value: String(member.user?.id),
    }));
  const selectedStatus = (statuses ?? []).find(
    (status) => status.id === statusId,
  );
  const assigneeLabel =
    assigneeOptions.find((option) => option.value === assigneeIds)?.label ??
    "Unassigned";
  const selectedModule = moduleOptions.find(
    (option) => option.value === moduleInstanceId,
  );
  const taskIdentifier =
    task?.prefix ?? (task ? task.id.slice(0, 8).toUpperCase() : "NEW");
  const workItemType = (workTypes ?? []).find(
    (type) => type.id === workItemTypeId,
  );
  const workItemTypeLabel = workItemType?.name ?? "Task";
  // Module only applies to task-category work items on a plan-provisioned
  // project type — a "Blank" project type has no modules to pick from at
  // all, and bugs/incidents never carry one.
  const showModuleField =
    Boolean(project?.projectType?.isPlanAdd) &&
    workItemType?.category === "task";
  const requiresModule = showModuleField;
  // Creating is always "dirty" (there's nothing to compare against yet);
  // editing only counts as dirty once a field diverges from what loaded.
  const snapshot = initialSnapshot;
  const isDirty =
    !isEdit ||
    name !== snapshot.name ||
    description !== snapshot.description ||
    moduleInstanceId !== snapshot.moduleInstanceId ||
    statusId !== snapshot.statusId ||
    priorityId !== snapshot.priorityId ||
    assigneeIds !== snapshot.assigneeIds ||
    qaAssigneeId !== snapshot.qaAssigneeId ||
    etaHours !== snapshot.etaHours ||
    completedHours !== snapshot.completedHours ||
    startDate !== snapshot.startDate ||
    dueDate !== snapshot.dueDate;

  async function handleSubmit() {
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) return setError("Enter a task name.");
    if (requiresModule && !moduleInstanceId) {
      return setError("Choose the module this task belongs to.");
    }
    if (startDate && dueDate && dueDate < startDate) {
      return setError("Due date can't be before the start date.");
    }
    if (projectStart && startDate && startDate < projectStart) {
      return setError(
        `Start date can't be before the project starts (${projectStart}).`,
      );
    }
    if (projectEnd && dueDate && dueDate > projectEnd) {
      return setError(
        `Due date can't be after the project ends (${projectEnd}).`,
      );
    }

    const eta = etaHours.trim();
    if (eta && (!Number.isInteger(Number(eta)) || Number(eta) < 0)) {
      return setError("ETA must be a whole number of hours.");
    }
    const completed = completedHours.trim();
    if (
      completed &&
      (!Number.isFinite(Number(completed)) || Number(completed) < 0)
    ) {
      return setError("Completed hours must be zero or greater.");
    }
    const sanitizedDescription = sanitizeRichText(description).trim();
    // Finalizing only touches img tag attributes, never visible text, so
    // this length check is valid pre-upload — no point uploading images
    // just to reject the save afterward.
    const descriptionText = new DOMParser()
      .parseFromString(sanitizedDescription, "text/html")
      .body.textContent?.trim();
    if ((descriptionText?.length ?? 0) > 4000) {
      return setError("Description must be 4,000 characters or fewer.");
    }

    let finalDescription = sanitizedDescription;
    if (task && stagedImagesRef.current.size > 0) {
      setIsUploadingImages(true);
      const idMap = new Map<string, string>();
      // Best-effort: an image that fails to upload is dropped from the
      // description (by finalizeStagedImages) rather than holding up the rest.
      await Promise.all(
        Array.from(stagedImagesRef.current.entries()).map(
          async ([stagingId, file]) => {
            try {
              // isInline: false — a description's image is a real work item
              // asset, so (unlike a comment's) it also shows in Attachments.
              const attachment = await uploadProjectAttachment(
                workspaceSlug,
                projectId,
                file,
                task.id,
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

    const dto: CreateTaskDto = {
      name: trimmed,
      ...(hasRichTextContent(finalDescription)
        ? { description: finalDescription }
        : {}),
      ...(moduleInstanceId ? { moduleInstanceId } : {}),
      ...(workItemTypeId ? { workItemTypeId } : {}),
      ...(statusId ? { statusId } : {}),
      ...(priorityId ? { priorityId } : {}),
      ...(eta ? { estimateHours: Number(eta) } : {}),
      ...(completed ? { completedHours: Number(completed) } : {}),
      ...(startDate ? { startDate } : {}),
      ...(dueDate ? { dueDate } : {}),
      ...(assigneeIds ? { assigneeId: assigneeIds } : {}),
      ...(qaAssigneeId ? { qaAssigneeId } : {}),
    };

    if (task) {
      update.mutate(
        { id: task.id, dto },
        {
          onSuccess: (updated) => {
            stagedImagesRef.current.clear();
            onSaved(updated.id);
          },
        },
      );
    } else {
      create.mutate(dto, { onSuccess: (created) => onSaved(created.id) });
    }
  }
  const headerAccent = workItemType?.color ?? "var(--status-info)";
  return (
    <Card className="mx-auto w-full max-w-6xl">
      <form onSubmit={handleSubmit} noValidate>
        <CardHeader
          className="sticky top-0 z-30 rounded-t-lg border-b border-border bg-card p-0 shadow-sm"
          style={{ gap: 0 }}
        >
          <div
            className="flex flex-col gap-3 p-4 pl-6 border-l-4 border-solid rounded-tl"
            style={{ borderLeftColor: headerAccent }}
          >
            <div className="header -ml-6 min-w-0 pl-6">
              <div
                className={`mb-1 flex items-center gap-1.5 text-xs font-medium text-status-info `}
              >
                <ListChecks className="h-3.5 w-3.5" />
                <span className="uppercase tracking-wide">
                  {workItemTypeLabel} {taskIdentifier}
                </span>
              </div>
              <div className="group/title relative min-w-0">
                <Input
                  id="task-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={
                    isEdit
                      ? `Untitled ${workItemTypeLabel.toLowerCase()}`
                      : `${workItemTypeLabel} name`
                  }
                  maxLength={200}
                  autoFocus={!isEdit}
                  disabled={!canFullEdit}
                  aria-label="Task name"
                  title={name}
                  className="h-auto min-w-0 truncate rounded-md border border-transparent bg-transparent px-3 py-1 pr-10 text-2xl font-semibold tracking-tight shadow-none transition-colors hover:border-dashed hover:border-input focus-visible:border-dashed focus-visible:border-primary focus-visible:ring-0 placeholder:text-muted-foreground/70"
                />
                <CopyWorkItemLink
                  prefix={`${workItemTypeLabel} ${taskIdentifier}`}
                  title={name}
                  url={
                    isEdit && task
                      ? `/${workspaceSlug}/projects/${projectId}/work-items/${task.id}`
                      : `/${workspaceSlug}/projects/${projectId}/work-items/new${
                          workItemTypeId
                            ? `?workItemTypeId=${workItemTypeId}`
                            : ""
                        }`
                  }
                  disabled={isEdit ? !isDirty : !name.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-100"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-lg rounded-tl-none border-t border-border bg-muted/40 p-2 px-4 lg:flex-row lg:items-center lg:justify-between">
            <div
              className={cn(
                "grid flex-1 grid-cols-1 gap-2 text-sm",
                showModuleField ? "sm:grid-cols-3" : "sm:grid-cols-2",
              )}
            >
              <div className="flex min-w-0 flex-col gap-1 rounded-md  px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Assignee
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={!canFullEdit || assigneeOptions.length === 0}
                    className="inline-flex h-8 min-w-0 items-center gap-2 rounded-md px-1.5 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                    aria-label="Change assignee"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarFallback>
                        {assigneeIds ? initials(assigneeLabel) : "—"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate font-medium">
                      {assigneeLabel}
                    </span>
                    {canFullEdit && assigneeOptions.length > 0 && (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-56">
                    {assigneeOptions.map((option) => (
                      <DropdownMenuItem
                        key={option.value}
                        onSelect={() => setAssigneeIds(option.value)}
                        className="justify-between"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback>
                              {initials(option.label)}
                            </AvatarFallback>
                          </Avatar>
                          {option.label}
                        </span>
                        {option.value === assigneeIds && (
                          <Check className="h-4 w-4" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {showModuleField && (
                <div className="flex min-w-0 flex-col gap-1 rounded-md px-3 py-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Module
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      disabled={
                        isEdit || !canFullEdit || moduleOptions.length === 0
                      }
                      className="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-md px-2 text-muted-foreground outline-none transition-colors enabled:hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Change module"
                    >
                      <FolderKanban className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {selectedModule?.label ?? "Select module"}
                      </span>
                      {!isEdit && canFullEdit && moduleOptions.length > 0 && (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-56">
                      {moduleOptions.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          onSelect={() => setModuleInstanceId(option.value)}
                          className="justify-between"
                        >
                          {option.label}
                          {option.value === moduleInstanceId && (
                            <Check className="h-4 w-4" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              <div className="flex min-w-0 flex-col gap-1 rounded-md  px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Status
                </span>
                <div className="flex h-8 items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      disabled={!canChangeStatus || statusOptions.length === 0}
                      className="inline-flex h-7 min-w-0 items-center gap-1.5 rounded-md border border-transparent bg-status-info-bg px-2 text-xs font-medium text-status-info outline-none transition-colors enabled:hover:bg-status-info-bg/70 focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Change status"
                    >
                      <span className="truncate">
                        {selectedStatus?.name ?? "Select status"}
                      </span>
                      {canChangeStatus && statusOptions.length > 0 && (
                        <ChevronDown className="h-3 w-3 shrink-0" />
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-48">
                      {(statuses ?? [])
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map((status) => (
                          <DropdownMenuItem
                            key={status.id}
                            onSelect={() => setStatusId(status.id)}
                            className="justify-between"
                          >
                            <span className="inline-flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{
                                  backgroundColor:
                                    status.color ?? "var(--status-info)",
                                }}
                                aria-hidden
                              />
                              {status.name}
                            </span>
                            {status.id === statusId && (
                              <Check className="h-4 w-4" />
                            )}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onDone}
                disabled={pending}
              >
                <Undo2 className="h-4 w-4" />
                Back to work items
              </Button>
              {canLogTime && task && (
                <TimeLogTimerButton
                  workspaceSlug={workspaceSlug}
                  projectId={projectId}
                  workItemId={task.id}
                />
              )}
              {(canFullEdit || canChangeStatus) && (
                <Button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={pending || !name.trim() || (isEdit && !isDirty)}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {pending
                    ? "Saving…"
                    : isEdit
                      ? "Save changes"
                      : `Create ${workItemTypeLabel ?? ""}`}
                </Button>
              )}
            </div>
          </div>
          <div
            role="tablist"
            aria-label="Task editor sections"
            className="flex px-4"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "details"}
              onClick={() => setActiveTab("details")}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === "details"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Details
            </button>
            {task && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "activity"}
                onClick={() => setActiveTab("activity")}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-col ${
                  activeTab === "activity"
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Activity
              </button>
            )}
            {task && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "timeLogs"}
                onClick={() => setActiveTab("timeLogs")}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === "timeLogs"
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Time Logs
              </button>
            )}
            {task && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "attachments"}
                onClick={() => setActiveTab("attachments")}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === "attachments"
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Attachments
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 p-4">
          {activeTab === "details" ? (
            <>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="flex flex-col gap-5">
                  <fieldset
                    disabled={!canFullEdit}
                    className="min-w-0 border-0 p-0"
                  >
                    <SettingsField
                      label="Description"
                      htmlFor="task-description"
                    >
                      <RichTextEditor
                        id="task-description"
                        value={description}
                        onChange={setDescription}
                        placeholder="Add a description…"
                        aria-label="Description"
                        disabled={!canFullEdit || isUploadingImages}
                        imageContext={
                          task ? { workspaceSlug, projectId } : undefined
                        }
                        onStageImage={task ? stageImage : undefined}
                        onRemoveStagedImage={
                          task
                            ? (stagingId) =>
                                stagedImagesRef.current.delete(stagingId)
                            : undefined
                        }
                      />
                    </SettingsField>
                  </fieldset>

                  {task && (
                    <TaskComments
                      workspaceSlug={workspaceSlug}
                      projectId={projectId}
                      taskId={task.id}
                      canComment={canComment}
                    />
                  )}
                </div>

                <fieldset
                  disabled={!canFullEdit}
                  className="flex min-w-0 flex-col gap-4 border-0 p-0 lg:border-l lg:border-border lg:pl-5"
                >
                  <SettingsField label="QA assignee" htmlFor="task-qa-assignee">
                    <SelectField
                      id="task-qa-assignee"
                      aria-label="QA assignee"
                      options={assigneeOptions}
                      value={qaAssigneeId}
                      onValueChange={setQaAssigneeId}
                      placeholder="Assign QA"
                    />
                  </SettingsField>

                  <SettingsField label="Priority" htmlFor="task-priority">
                    <SelectField
                      id="task-priority"
                      aria-label="Priority"
                      options={priorityOptions}
                      value={priorityId}
                      onValueChange={setPriorityId}
                      placeholder="Select a priority"
                    />
                  </SettingsField>

                  <SettingsField
                    label="ETA (hours)"
                    htmlFor="task-eta"
                    hint="Estimated effort."
                  >
                    <Input
                      id="task-eta"
                      type="number"
                      min={0}
                      max={10000}
                      value={etaHours}
                      onChange={(event) => setEtaHours(event.target.value)}
                      placeholder="8"
                    />
                  </SettingsField>

                  <SettingsField
                    label="Completed hours"
                    htmlFor="task-completed-hours"
                    hint="Work logged so far."
                  >
                    <Input
                      id="task-completed-hours"
                      type="number"
                      min={0}
                      step="0.25"
                      value={completedHours}
                      onChange={(event) =>
                        setCompletedHours(event.target.value)
                      }
                      placeholder="0"
                    />
                  </SettingsField>

                  <SettingsField label="Start date" htmlFor="task-start">
                    <Input
                      id="task-start"
                      type="date"
                      value={startDate}
                      min={projectStart || undefined}
                      max={dueDate || projectEnd || undefined}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                  </SettingsField>

                  <SettingsField label="Due date" htmlFor="task-due">
                    <Input
                      id="task-due"
                      type="date"
                      value={dueDate}
                      min={startDate || projectStart || undefined}
                      max={projectEnd || undefined}
                      onChange={(event) => setDueDate(event.target.value)}
                    />
                  </SettingsField>

                  {(projectStart || projectEnd) && (
                    <p className="text-xs leading-5 text-muted-foreground">
                      Project dates: {projectStart || "—"} to{" "}
                      {projectEnd || "—"}.
                    </p>
                  )}
                </fieldset>
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </>
          ) : activeTab === "activity" && task ? (
            <TaskActivity
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              taskId={task.id}
            />
          ) : activeTab === "timeLogs" && task ? (
            <TimeLogPanel
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              workItemId={task.id}
              canLog={canLogTime}
            />
          ) : activeTab === "attachments" && task ? (
            <ProjectAttachments
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              workItemId={task.id}
              canCreate={canCreateAttachment}
              canDelete={canDeleteAttachment}
            />
          ) : null}
        </CardContent>
      </form>
    </Card>
  );
}
