"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Loader2, UserPlus, Users } from "lucide-react";

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
  type Member,
  type TeamName,
} from "@/lib/workspace/data";
import type { ColumnDef, Tone } from "@/types/module";

const TEAM_OPTIONS: SelectOption[] = TEAMS.map((team) => ({
  label: team,
  value: team,
}));

const ROLE_OPTIONS: SelectOption[] = [
  { label: "Admin", value: "Admin" },
  { label: "Manager", value: "Manager" },
  { label: "Member", value: "Member" },
  { label: "Viewer", value: "Viewer" },
];

const TEAM_TONE: Record<TeamName, Tone> = {
  HubSpot: "warning",
  "Dev Team": "info",
};

const columns: ColumnDef<Member>[] = [
  {
    key: "name",
    header: "User",
    sortable: true,
    sortAccessor: (m) => m.name,
    cell: (m) => (
      <div className="flex flex-col">
        <span className="font-medium">{m.name}</span>
        <span className="text-xs text-muted-foreground">{m.email}</span>
      </div>
    ),
  },
  {
    key: "role",
    header: "Role",
    hideBelow: "sm",
    sortable: true,
    sortAccessor: (m) => m.role,
    cell: (m) => m.role,
  },
  {
    key: "team",
    header: "Team",
    sortable: true,
    sortAccessor: (m) => m.team,
    cell: (m) => <StatusBadge label={m.team} tone={TEAM_TONE[m.team]} />,
  },
];

export default function UsersPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const { members, addMember } = useWorkspaceData(workspace);
  const [open, setOpen] = React.useState(false);

  const stats = [
    { label: "Total Users", value: members.length, icon: Users },
    { label: "HubSpot", value: members.filter((m) => m.team === "HubSpot").length },
    { label: "Dev Team", value: members.filter((m) => m.team === "Dev Team").length },
  ];

  return (
    <PageContainer className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Users"
          description="Add people to this workspace and assign them to a team."
        />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <UserPlus className="h-4 w-4" />
              Add user
            </Button>
          </DialogTrigger>
          <AddUserDialog onCreate={addMember} onDone={() => setOpen(false)} />
        </Dialog>
      </div>

      <StatsGrid stats={stats} />

      <DataTable
        columns={columns}
        data={members}
        getRowId={(m) => m.id}
        searchAccessors={[(m) => m.name, (m) => m.email, (m) => m.role]}
        searchPlaceholder="Search users…"
        emptyMessage="No users yet. Add someone to this workspace to get started."
      />
    </PageContainer>
  );
}

function AddUserDialog({
  onCreate,
  onDone,
}: {
  onCreate: (input: {
    name: string;
    email: string;
    role: string;
    team: TeamName;
  }) => void;
  onDone: () => void;
}) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<string>("Member");
  const [team, setTeam] = React.useState<TeamName>();
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Enter the user's name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email address.");
    if (!team) return setError("Select a team.");

    setSubmitting(true);
    onCreate({ name: name.trim(), email: email.trim(), role, team });
    onDone();
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add user</DialogTitle>
        <DialogDescription>
          Invite someone to this workspace and place them on a team.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="user-name">Full name</Label>
          <Input
            id="user-name"
            placeholder="Jordan Rivera"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="user-email">Email</Label>
          <Input
            id="user-email"
            type="email"
            placeholder="jordan@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="user-role">Role</Label>
            <SelectField
              id="user-role"
              aria-label="Role"
              options={ROLE_OPTIONS}
              value={role}
              onValueChange={setRole}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="user-team">Team</Label>
            <SelectField
              id="user-team"
              aria-label="Team"
              options={TEAM_OPTIONS}
              value={team}
              onValueChange={(value) => setTeam(value as TeamName)}
              placeholder="Select a team"
            />
          </div>
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
                Adding…
              </>
            ) : (
              "Add user"
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
