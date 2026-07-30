"use client";

import {
  Check,
  ChevronDown,
  FolderKanban,
  ListChecks,
  Loader2,
  Save,
} from "lucide-react";
import * as React from "react";

import { TaskActivity } from "@/components/projects/task-activity";
import { TaskComments } from "@/components/projects/task-comments";
import { SettingsField } from "@/components/settings/settings-section";
import {
  RichTextEditor,
  sanitizeRichText,
} from "@/components/shared/rich-text-editor";
import {
  SelectField,
  type SelectOption,
} from "@/components/shared/select-field";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { CopyWorkItemLink } from "@/components/projects/copy-work-item-link";
import { TimeLogPanel } from "@/components/projects/time-log-panel";
import { TimeLogTimerButton } from "@/components/projects/time-log-timer-button";
import { usePriorities } from "@/lib/api/hooks/use-priorities";
import { useProjectMembers } from "@/lib/api/hooks/use-project-members";
import { useProject, useProjectModules } from "@/lib/api/hooks/use-projects";
import {
  useCreateTask,
  useUpdateTask,
} from "@/lib/api/hooks/use-tasks";
import { useTicketStatuses } from "@/lib/api/hooks/use-ticket-statuses";
import { useMe } from "@/lib/api/hooks/use-users";
import { useWorkTypes } from "@/lib/api/hooks/use-work-types";
import type { CreateTaskDto, Task, UpdateMeDto } from "@/lib/api/types";
import { todayDateInput } from "@/lib/format";
import { getFullname } from "@/lib/utils";

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
  canComment: boolean;
  onDone: () => void;
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
  canComment,
  onDone,
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
  const requiresModule = Boolean(project?.projectType?.isPlanAdd);

  const isEdit = Boolean(task);
  const pending = create.isPending || update.isPending;

  const [name, setName] = React.useState(task?.name ?? "");
  const [description, setDescription] = React.useState(task?.description ?? "");
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
    "details" | "activity" | "timeLogs"
  >("details");
  const canLogTime = Boolean(task && me?.id && me.id === task.assigneeId);

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
  const selectedPriority = (priorities ?? []).find(
    (priority) => priority.id === priorityId,
  );
  const assigneeLabel =
    assigneeOptions.find((option) => option.value === assigneeIds)?.label ??
    "Unassigned";
  const selectedModule = moduleOptions.find(
    (option) => option.value === moduleInstanceId,
  );
  const taskIdentifier =
    task?.prefix ?? (task ? task.id.slice(0, 8).toUpperCase() : "NEW");
  const workItemTypeLabel =
    (workTypes ?? []).find((type) => type.id === workItemTypeId)?.name ??
    "Task";
  const headerAccent =
    selectedStatus?.color ?? selectedPriority?.color ?? "var(--status-info)";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    const descriptionText = new DOMParser()
      .parseFromString(sanitizedDescription, "text/html")
      .body.textContent?.trim();
    if ((descriptionText?.length ?? 0) > 4000) {
      return setError("Description must be 4,000 characters or fewer.");
    }

    const dto: CreateTaskDto = {
      name: trimmed,
      ...(descriptionText ? { description: sanitizedDescription } : {}),
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
      update.mutate({ id: task.id, dto }, { onSuccess: onDone });
    } else {
      create.mutate(dto, { onSuccess: onDone });
    }
  }

  return (
    <Card className="mx-auto w-full max-w-6xl">
      <form onSubmit={handleSubmit} noValidate>
        <CardHeader className="sticky top-14 z-30 rounded-t-lg border-b border-border bg-card p-0 shadow-sm">
          <span
            className="absolute inset-y-0 left-0 w-1.5"
            style={{ backgroundColor: headerAccent }}
            aria-hidden
          />

          <div className="flex flex-col gap-3 p-4 pl-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-status-info">
                  <ListChecks className="h-3.5 w-3.5" />
                  <span className="uppercase tracking-wide">
                    {workItemTypeLabel} {taskIdentifier}
                  </span>
                </div>
                <div className="group/title relative">
                  <Input
                    id="task-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={isEdit ? "Untitled task" : "Task name"}
                    maxLength={200}
                    autoFocus={!isEdit}
                    disabled={!canSave}
                    aria-label="Task name"
                    className="h-auto rounded-md border border-transparent bg-transparent px-3 py-1 pr-10 text-2xl font-semibold tracking-tight shadow-none transition-colors hover:border-dashed hover:border-input focus-visible:border-dashed focus-visible:border-primary focus-visible:ring-0 placeholder:text-muted-foreground/70"
                  />
                  {isEdit && task && (
                    <CopyWorkItemLink
                      prefix={`Task ${task.prefix ?? task.id}`}
                      title={name}
                      url={`/${workspaceSlug}/projects/${projectId}/work-items/${task.id}`}
                      className="absolute right-2 top-1/2 -translate-y-1/2 group-focus-within/title:opacity-100"
                    />
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onDone}
                  disabled={pending}
                >
                  Back to work items
                </Button>
                {canLogTime && task && (
                  <TimeLogTimerButton
                    workspaceSlug={workspaceSlug}
                    projectId={projectId}
                    workItemId={task.id}
                  />
                )}
                {canSave && (
                  <Button type="submit" disabled={pending}>
                    {pending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {pending
                      ? "Saving…"
                      : isEdit
                        ? "Save changes"
                        : "Create task"}
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 rounded-lg bg-muted/40 p-2 text-sm sm:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-1 rounded-md bg-background/70 px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Assignee
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={!canSave || assigneeOptions.length === 0}
                    className="inline-flex h-8 min-w-0 items-center gap-2 rounded-md px-1.5 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                    aria-label="Change assignee"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarFallback>
                        {assigneeIds ? initials(assigneeLabel) : "—"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate font-medium">{assigneeLabel}</span>
                    {canSave && assigneeOptions.length > 0 && (
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

              <div className="flex min-w-0 flex-col gap-1 rounded-md bg-background/70 px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Module
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={isEdit || !canSave || moduleOptions.length === 0}
                    className="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-md px-2 text-muted-foreground outline-none transition-colors enabled:hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Change module"
                  >
                    <FolderKanban className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {selectedModule?.label ?? "Select module"}
                    </span>
                    {!isEdit && canSave && moduleOptions.length > 0 && (
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

              <div className="flex min-w-0 flex-col gap-1 rounded-md bg-background/70 px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Stage
                </span>
                <div className="flex h-8 items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      disabled={!canSave || statusOptions.length === 0}
                      className="inline-flex h-7 min-w-0 items-center gap-1.5 rounded-md border border-transparent bg-status-info-bg px-2 text-xs font-medium text-status-info outline-none transition-colors enabled:hover:bg-status-info-bg/70 focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Change status"
                    >
                      <span className="truncate">
                        {selectedStatus?.name ?? "Select status"}
                      </span>
                      {canSave && statusOptions.length > 0 && (
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
                  {selectedPriority && (
                    <Badge variant="outline">{selectedPriority.name}</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Task editor sections"
            className="flex border-t border-border px-4"
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
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 p-4">
          {activeTab === "details" ? (
            <>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="flex flex-col gap-5">
                  <fieldset
                    disabled={!canSave}
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
                        disabled={!canSave}
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
                  disabled={!canSave}
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
          ) : null}
        </CardContent>
      </form>
    </Card>
  );
}
