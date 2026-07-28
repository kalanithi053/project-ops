"use client";

import { Loader2, Trash2 } from "lucide-react";
import * as React from "react";

import { TaskAttachments } from "@/components/projects/task-attachments";
import { SettingsField } from "@/components/settings/settings-section";
import { FormPanel } from "@/components/shared/form-panel";
import {
  SelectField,
  type SelectOption,
} from "@/components/shared/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePriorities } from "@/lib/api/hooks/use-priorities";
import { useProjectMembers } from "@/lib/api/hooks/use-project-members";
import { useProject, useProjectModules } from "@/lib/api/hooks/use-projects";
import {
  useCreateTask,
  useDeleteTask,
  useUpdateTask,
} from "@/lib/api/hooks/use-tasks";
import { useTicketStatuses } from "@/lib/api/hooks/use-ticket-statuses";
import type { CreateTaskDto, Task } from "@/lib/api/types";

/** ISO timestamp -> the `YYYY-MM-DD` an <input type="date"> expects. */
function toDateInput(value?: string | null): string {
  return value ? value.slice(0, 10) : "";
}

interface TaskPanelProps {
  workspaceSlug: string;
  projectId: string;
  /** null creates a new task. */
  task: Task | null;
  defaultStatusId?: string;
  requiresModule: boolean;
  canUpdate: boolean;
  onClose: () => void;
}

/**
 * Create/edit form for a task. One panel serves both modes.
 *
 * Every select omits a "None" choice on purpose: the API applies updates as
 * `field ?? undefined`, so a null is silently ignored — a value can be
 * changed but never cleared. Offering "None" would look like it worked.
 */
export function TaskPanel({
  workspaceSlug,
  projectId,
  task,
  defaultStatusId,
  requiresModule,
  canUpdate,
  onClose,
}: TaskPanelProps) {
  const create = useCreateTask(workspaceSlug, projectId);
  const update = useUpdateTask(workspaceSlug, projectId);
  const remove = useDeleteTask(workspaceSlug, projectId);

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
  const pending = create.isPending || update.isPending;

  const [name, setName] = React.useState(task?.name ?? "");
  const [description, setDescription] = React.useState(task?.description ?? "");
  const [moduleInstanceId, setModuleInstanceId] = React.useState<
    string | undefined
  >(task?.moduleInstanceId ?? undefined);
  const [statusId, setStatusId] = React.useState<string | undefined>(
    task?.statusId ?? defaultStatusId,
  );
  const [priorityId, setPriorityId] = React.useState<string | undefined>(
    task?.priorityId ?? undefined,
  );
  const [assigneeIds, setAssigneeIds] = React.useState<string>(
    task?.assigneeId ?? "",
  );
  const [etaHours, setEtaHours] = React.useState(
    task?.etaHours != null ? String(task.etaHours) : "",
  );
  const [startDate, setStartDate] = React.useState(
    toDateInput(task?.startDate),
  );
  const [dueDate, setDueDate] = React.useState(toDateInput(task?.dueDate));
  const [error, setError] = React.useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);

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
      label:
        ([member?.user?.firstName, member?.user?.lastName].join(" ")?.trim() ||
          member?.user?.email?.split("@")[0]) ??
        "Unknown",
      value: String(member.user?.id),
    }));

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

    const dto: CreateTaskDto = {
      name: trimmed,
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(moduleInstanceId ? { moduleInstanceId } : {}),
      ...(statusId ? { statusId } : {}),
      ...(priorityId ? { priorityId } : {}),
      ...(eta ? { etaHours: Number(eta) } : {}),
      ...(startDate ? { startDate } : {}),
      ...(dueDate ? { dueDate } : {}),
      // Always sent so clearing every assignee actually takes effect.
      assigneeId: assigneeIds,
    };

    if (task) {
      update.mutate({ id: task.id, dto }, { onSuccess: onClose });
    } else {
      create.mutate(dto, { onSuccess: onClose });
    }
  }

  return (
    <FormPanel
      title={isEdit ? "Edit task" : "New task"}
      description={
        requiresModule
          ? "Tasks in this project are filed under a module from its plans."
          : "Give the task a name and, optionally, a status and owner."
      }
      onClose={onClose}
      onSubmit={handleSubmit}
      busy={pending}
      footer={
        <>
          {/* Inline confirmation rather than a nested dialog on top of a panel. */}
          {isEdit && canUpdate ? (
            confirmingDelete ? (
              <div className="mr-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Delete?</span>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={remove.isPending}
                  onClick={() =>
                    task && remove.mutate(task.id, { onSuccess: onClose })
                  }
                >
                  {remove.isPending && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  Yes, delete
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmingDelete(false)}
                >
                  No
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mr-auto text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            )
          ) : null}

          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={pending}
          >
            {canUpdate ? "Cancel" : "Close"}
          </Button>
          {canUpdate && (
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : isEdit ? (
                "Save changes"
              ) : (
                "Create task"
              )}
            </Button>
          )}
        </>
      }
    >
      {task?.prefix && (
        <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {task.prefix}
        </span>
      )}

      <fieldset disabled={!canUpdate} className="flex flex-col gap-4">
        <SettingsField label="Task name" htmlFor="task-name">
          <Input
            id="task-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Design the landing page"
            maxLength={200}
            autoFocus
          />
        </SettingsField>

        <SettingsField label="Description" htmlFor="task-description">
          <Textarea
            id="task-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Optional detail"
            maxLength={4000}
            rows={3}
          />
        </SettingsField>

        {moduleOptions.length > 0 &&
          (isEdit ? (
            /* Read-only after creation: the module decides a task's prefix
               numbering and which quota it consumes, so reassigning it would
               leave the prefix lying about where the task lives. */
            <SettingsField
              label="Module"
              htmlFor="task-module"
              hint="A task stays in the module it was created under."
            >
              <Input
                id="task-module"
                value={
                  moduleOptions.find(
                    (option) => option.value === moduleInstanceId,
                  )?.label ?? "—"
                }
                readOnly
                disabled
                className="bg-muted"
              />
            </SettingsField>
          ) : (
            <SettingsField
              label={requiresModule ? "Module" : "Module (optional)"}
              htmlFor="task-module"
              hint="Tasks past a module's included quantity are still created, counted as add-ons."
            >
              <SelectField
                id="task-module"
                aria-label="Module"
                options={moduleOptions}
                value={moduleInstanceId}
                onValueChange={setModuleInstanceId}
                placeholder="Select a module"
              />
            </SettingsField>
          ))}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SettingsField label="Status" htmlFor="task-status">
            <SelectField
              id="task-status"
              aria-label="Status"
              options={statusOptions}
              value={statusId}
              onValueChange={setStatusId}
              placeholder="Select a status"
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
        </div>

        <SettingsField
          label="Assignees"
          htmlFor="task-assignees"
          hint={
            assigneeOptions.length === 0
              ? "Add people to this project before assigning work."
              : "Only members of this project can be assigned."
          }
        >
          <SelectField
            id="task-assignees"
            aria-label="Assignees"
            options={assigneeOptions}
            value={assigneeIds ?? ""}
            onValueChange={setAssigneeIds}
            placeholder="Unassigned"
            disabled={assigneeOptions.length === 0}
          />
        </SettingsField>

        <SettingsField
          label="ETA (hours)"
          htmlFor="task-eta"
          hint="Estimated effort. Leave blank if not estimated yet."
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        </div>
      </fieldset>

      {isEdit && task && (
        <TaskAttachments
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          taskId={task.id}
          canUpdate={canUpdate}
        />
      )}

      {(projectStart || projectEnd) && (
        <p className="text-xs text-muted-foreground">
          This project runs {projectStart || "—"} to {projectEnd || "—"}; task
          dates must fall inside that window.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </FormPanel>
  );
}
