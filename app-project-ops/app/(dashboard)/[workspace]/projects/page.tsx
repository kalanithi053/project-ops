"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { FolderKanban, Loader2, Plus } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { StatsGrid } from "@/components/shared/stats-grid";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SelectField, type SelectOption } from "@/components/shared/select-field";
import {
  TEAMS,
  useWorkspaceData,
  type Project,
  type TeamName,
} from "@/lib/workspace/data";
import type { ColumnDef, Tone } from "@/types/module";

const TEAM_OPTIONS: SelectOption[] = TEAMS.map((team) => ({
  label: team,
  value: team,
}));

const TEAM_TONE: Record<TeamName, Tone> = {
  HubSpot: "warning",
  "Dev Team": "info",
};

function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

const columns: ColumnDef<Project>[] = [
  {
    key: "name",
    header: "Project",
    sortable: true,
    sortAccessor: (p) => p.name,
    cell: (p) => <span className="font-medium">{p.name}</span>,
  },
  {
    key: "team",
    header: "Team",
    sortable: true,
    sortAccessor: (p) => p.team,
    cell: (p) => <StatusBadge label={p.team} tone={TEAM_TONE[p.team]} />,
  },
  {
    key: "startDate",
    header: "Start",
    hideBelow: "sm",
    sortable: true,
    sortAccessor: (p) => p.startDate,
    cell: (p) => <span className="text-muted-foreground">{p.startDate}</span>,
  },
  {
    key: "endDate",
    header: "End",
    hideBelow: "sm",
    sortable: true,
    sortAccessor: (p) => p.endDate,
    cell: (p) => <span className="text-muted-foreground">{p.endDate}</span>,
  },
  {
    key: "duration",
    header: "Duration",
    align: "right",
    hideBelow: "md",
    sortable: true,
    sortAccessor: (p) => daysBetween(p.startDate, p.endDate),
    cell: (p) => `${daysBetween(p.startDate, p.endDate)}d`,
  },
];

export default function ProjectsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const { projects, addProject } = useWorkspaceData(workspace);
  const [open, setOpen] = React.useState(false);

  const stats = [
    { label: "Total Projects", value: projects.length, icon: FolderKanban },
    { label: "HubSpot", value: projects.filter((p) => p.team === "HubSpot").length },
    { label: "Dev Team", value: projects.filter((p) => p.team === "Dev Team").length },
  ];

  return (
    <PageContainer className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Projects"
          description="Create and track projects in this workspace."
        />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              New project
            </Button>
          </DialogTrigger>
          <NewProjectDialog onCreate={addProject} onDone={() => setOpen(false)} />
        </Dialog>
      </div>

      <StatsGrid stats={stats} />

      <DataTable
        columns={columns}
        data={projects}
        getRowId={(p) => p.id}
        searchAccessors={[(p) => p.name, (p) => p.team]}
        searchPlaceholder="Search projects…"
        emptyMessage="No projects yet. Create your first project to get started."
      />
    </PageContainer>
  );
}

function NewProjectDialog({
  onCreate,
  onDone,
}: {
  onCreate: (input: {
    name: string;
    startDate: string;
    endDate: string;
    team: TeamName;
  }) => void;
  onDone: () => void;
}) {
  const [name, setName] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [team, setTeam] = React.useState<TeamName>();
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Enter a project name.");
    if (!startDate) return setError("Choose a start date.");
    if (!endDate) return setError("Choose an end date.");
    if (endDate < startDate) return setError("End date can't be before the start date.");
    if (!team) return setError("Select a team.");

    setSubmitting(true);
    onCreate({ name: name.trim(), startDate, endDate, team });
    onDone();
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New project</DialogTitle>
        <DialogDescription>
          Add a project and assign it to a team.
        </DialogDescription>
      </DialogHeader>

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
          <Label htmlFor="project-team">Team</Label>
          <SelectField
            id="project-team"
            aria-label="Team"
            options={TEAM_OPTIONS}
            value={team}
            onValueChange={(value) => setTeam(value as TeamName)}
            placeholder="Select a team"
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create project"
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
