"use client";

import {
  AlertTriangle,
  Check,
  ChevronDown,
  Loader2,
  Save,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { SettingsField } from "@/components/settings/settings-section";
import { CopyWorkItemLink } from "@/components/projects/copy-work-item-link";
import { IncidentActivity } from "@/components/projects/incident-activity";
import { TaskComments } from "@/components/projects/task-comments";
import { SelectField } from "@/components/shared/select-field";
import {
  RichTextEditor,
  sanitizeRichText,
} from "@/components/shared/rich-text-editor";
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
import { TimeLogPanel } from "@/components/projects/time-log-panel";
import { TimeLogTimerButton } from "@/components/projects/time-log-timer-button";
import {
  useCreateIncident,
  useUpdateIncident,
} from "@/lib/api/hooks/use-incidents";
import { useWorkspaceMembers } from "@/lib/api/hooks/use-members";
import { useTicketStatuses } from "@/lib/api/hooks/use-ticket-statuses";
import { useMe } from "@/lib/api/hooks/use-users";
import type { Incident, TicketStatus } from "@/lib/api/types";
import { getFullname } from "@/lib/utils";

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function IncidentEditor({
  workspaceSlug,
  projectId,
  incident = null,
  canComment = false,
}: {
  workspaceSlug: string;
  projectId: string;
  incident?: Incident | null;
  canComment?: boolean;
}) {
  const router = useRouter();
  const create = useCreateIncident(workspaceSlug, projectId);
  const update = useUpdateIncident(workspaceSlug, projectId);
  const { data: me } = useMe();
  const { data: members } = useWorkspaceMembers(workspaceSlug);
  const { data: ticketStatuses } = useTicketStatuses(workspaceSlug);
  const isEdit = Boolean(incident);
  const [title, setTitle] = React.useState(incident?.title ?? "");
  const [description, setDescription] = React.useState(
    incident?.description ?? "",
  );
  const [assigneeId, setAssigneeId] = React.useState(
    incident?.assigneeId ?? "",
  );
  const [qaAssigneeId, setQaAssigneeId] = React.useState(
    incident?.qaAssigneeId ?? "",
  );
  const [estimateHours, setEstimateHours] = React.useState(
    incident?.estimateHours != null ? String(incident.estimateHours) : "",
  );
  const [completedHours, setCompletedHours] = React.useState(
    incident?.completedHours != null ? String(incident.completedHours) : "",
  );
  const [statusId, setStatusId] = React.useState(incident?.statusId ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const savedTitle = React.useRef(incident?.title ?? "");
  const [activeTab, setActiveTab] = React.useState<
    "details" | "activity" | "timeLogs"
  >("details");
  const canLogTime = Boolean(
    incident && me?.id && me.id === incident.assigneeId,
  );

  const assigneeOptions = React.useMemo(
    () =>
      (members ?? [])
        .filter((member) => member.status !== "removed")
        .map((member) => {
          const user = member.user ?? member;
          return {
            value: user.id ?? "",
            label: getFullname(user) ?? "Unknown user",
          };
        })
        .filter((option) => Boolean(option.value)),
    [members],
  );
  const assigneeLabel =
    assigneeOptions.find((option) => option.value === assigneeId)?.label ??
    "Unassigned";
  const selectedStatus =
    ticketStatuses?.find((option) => option.id === statusId) ??
    incident?.status ??
    null;
  const pending = create.isPending || update.isPending;
  const incidentIdentifier = incident
    ? incident.id.slice(0, 8).toUpperCase()
    : "NEW";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3) {
      return setError("Enter an incident title with at least 3 characters.");
    }

    const estimate = estimateHours.trim();
    if (estimate && (!Number.isFinite(Number(estimate)) || Number(estimate) < 0)) {
      return setError("ETA must be zero or greater.");
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

    setError(null);
    const dto = {
      title: trimmedTitle,
      ...(descriptionText ? { description: sanitizedDescription } : {}),
      ...(assigneeId ? { assigneeId } : {}),
      ...(qaAssigneeId ? { qaAssigneeId } : {}),
      ...(estimate ? { estimateHours: Number(estimate) } : {}),
      ...(completed ? { completedHours: Number(completed) } : {}),
      ...(statusId ? { statusId } : {}),
    };
    const onSuccess = () =>
      router.replace(`/${workspaceSlug}/projects/${projectId}/work-items`);

    if (incident) {
      update.mutate({ id: incident.id, dto }, { onSuccess });
    } else {
      create.mutate(dto, { onSuccess });
    }
  }

  function saveTitleOnBlur() {
    const trimmed = title.trim();
    if (!incident || !trimmed || trimmed === savedTitle.current) return;

    setTitle(trimmed);
    update.mutate(
      { id: incident.id, dto: { title: trimmed } },
      { onSuccess: () => { savedTitle.current = trimmed; } },
    );
  }

  return (
    <Card className="mx-auto w-full max-w-6xl">
      <form onSubmit={submit} noValidate>
        <CardHeader className="sticky top-14 z-30 rounded-t-lg border-b border-border bg-card p-0 shadow-sm">
          <span
            className="absolute inset-y-0 left-0 w-1.5 bg-status-error"
            aria-hidden
          />
          <div className="flex flex-col gap-3 p-4 pl-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-status-error">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="uppercase tracking-wide">
                    Incident {incidentIdentifier}
                  </span>
                </div>
                <div className="group/title relative">
                  <Input
                    id="incident-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    onBlur={saveTitleOnBlur}
                    placeholder={isEdit ? "Untitled incident" : "Incident title"}
                    maxLength={200}
                    autoFocus={!isEdit}
                    aria-label="Incident title"
                    className="h-auto rounded-md border border-transparent bg-transparent px-3 py-1 pr-10 text-2xl font-semibold tracking-tight shadow-none transition-colors hover:border-input focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 placeholder:text-muted-foreground/70"
                  />
                  {isEdit && incident && (
                    <CopyWorkItemLink
                      prefix={`Incident ${incident.id}`}
                      title={title}
                      url={`/${workspaceSlug}/projects/${projectId}/incidents/${incident.id}`}
                      className="absolute right-2 top-1/2 -translate-y-1/2 group-focus-within/title:opacity-100"
                    />
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={pending}
                >
                  Cancel
                </Button>
                {canLogTime && incident && (
                  <TimeLogTimerButton
                    workspaceSlug={workspaceSlug}
                    projectId={projectId}
                    workItemId={incident.id}
                  />
                )}
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
                      : "Create incident"}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={assigneeOptions.length === 0}
                  className="inline-flex h-8 items-center gap-2 rounded-md px-1.5 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                  aria-label="Change assignee"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback>
                      {assigneeId ? initials(assigneeLabel) : "—"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{assigneeLabel}</span>
                  {assigneeOptions.length > 0 && (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-56">
                  {assigneeOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onSelect={() => setAssigneeId(option.value)}
                      className="justify-between"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback>{initials(option.label)}</AvatarFallback>
                        </Avatar>
                        {option.label}
                      </span>
                      {option.value === assigneeId && (
                        <Check className="h-4 w-4" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={pending || (ticketStatuses?.length ?? 0) === 0}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md border border-transparent bg-status-error-bg px-2 text-xs font-medium text-status-error outline-none transition-colors enabled:hover:bg-status-error-bg/70 focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Change incident status"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: selectedStatus?.color ?? "var(--status-error)" }}
                    aria-hidden
                  />
                  {selectedStatus?.name ?? "Select status"}
                  <ChevronDown className="h-3 w-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-48">
                  {(ticketStatuses ?? []).map((option: TicketStatus) => (
                    <DropdownMenuItem
                      key={option.id}
                      onSelect={() => setStatusId(option.id)}
                      className="justify-between"
                    >
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: option.color ?? "var(--status-neutral)" }}
                          aria-hidden
                        />
                        {option.name}
                      </span>
                      {option.id === statusId && <Check className="h-4 w-4" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Incident editor sections"
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
            {incident && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "activity"}
                onClick={() => setActiveTab("activity")}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === "activity"
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Activity
              </button>
            )}
            {incident && (
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

        <CardContent className="p-4">
          {activeTab === "details" ? (
            <>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="min-w-0">
                  <SettingsField
                    label="Description"
                    htmlFor="incident-description"
                  >
                    <RichTextEditor
                      id="incident-description"
                      value={description}
                      onChange={setDescription}
                      placeholder="Describe the issue and its impact…"
                      aria-label="Incident description"
                      disabled={pending}
                    />
                  </SettingsField>
                  {incident && (
                    <TaskComments
                      workspaceSlug={workspaceSlug}
                      projectId={projectId}
                      incidentId={incident.id}
                      canComment={canComment}
                    />
                  )}
                </div>

                <div className="flex min-w-0 flex-col gap-4 lg:border-l lg:border-border lg:pl-5">
                  <SettingsField
                    label="QA assignee"
                    htmlFor="incident-qa-assignee"
                  >
                    <SelectField
                      id="incident-qa-assignee"
                      aria-label="QA assignee"
                      options={assigneeOptions}
                      value={qaAssigneeId}
                      onValueChange={setQaAssigneeId}
                      placeholder="Assign QA"
                    />
                  </SettingsField>
                  <SettingsField
                    label="ETA (hours)"
                    htmlFor="incident-eta"
                    hint="Estimated effort."
                  >
                    <Input
                      id="incident-eta"
                      type="number"
                      min={0}
                      max={10000}
                      value={estimateHours}
                      onChange={(event) => setEstimateHours(event.target.value)}
                      placeholder="8"
                    />
                  </SettingsField>
                  <SettingsField
                    label="Completed hours"
                    htmlFor="incident-completed-hours"
                    hint="Work logged so far."
                  >
                    <Input
                      id="incident-completed-hours"
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
                </div>
              </div>
              {error && (
                <p role="alert" className="mt-4 text-sm text-destructive">
                  {error}
                </p>
              )}
            </>
          ) : activeTab === "activity" && incident ? (
            <IncidentActivity
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              incidentId={incident.id}
            />
          ) : activeTab === "timeLogs" && incident ? (
            <TimeLogPanel
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              workItemId={incident.id}
              canLog={canLogTime}
            />
          ) : null}
        </CardContent>
      </form>
    </Card>
  );
}
