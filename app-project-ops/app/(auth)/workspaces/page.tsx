"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Boxes, ChevronRight, Plus, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { WorkspaceForm } from "@/components/auth/workspace-form";
import { setActiveWorkspace } from "@/lib/tenant/active-workspace";

interface AccessibleWorkspace {
  id: string;
  name: string;
  slug: string;
  role: string;
  members: number;
}

/**
 * Workspaces the signed-in user already has access to. Mock for now —
 * replace with a call that lists the tenants the authenticated session
 * is a member of (see TenantProvider).
 */
const myWorkspaces: AccessibleWorkspace[] = [
  { id: "tn_1", name: "Acme Engineering", slug: "acme-engineering", role: "Engineering Manager", members: 56 },
  { id: "tn_2", name: "Internal Platform", slug: "internal-platform", role: "Admin", members: 24 },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Post-login workspace hub. The user can enter a workspace they already
 * belong to, or create a new one. Both paths lead to the dashboard.
 * Entering a workspace is a UI convenience only — the backend must still
 * authorize the session against the selected tenant on every request.
 */
export default function WorkspacesPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"select" | "create">("select");

  function openWorkspace(workspace: AccessibleWorkspace) {
    // Persist the choice, then enter its workspace-scoped dashboard.
    setActiveWorkspace({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
    });
    router.push(`/${workspace.slug}/dashboard`);
  }

  if (mode === "create") {
    return (
      <div className="flex w-full max-w-md flex-col gap-8">
        <BrandMark />
        <button
          type="button"
          onClick={() => setMode("select")}
          className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to workspaces
        </button>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Create your workspace
          </h1>
          <p className="text-sm text-muted-foreground">
            Set up a shared space for your team. You can change any of this
            later in tenant settings.
          </p>
        </div>

        <WorkspaceForm />
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-8">
      <BrandMark />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Choose a workspace
        </h1>
        <p className="text-sm text-muted-foreground">
          {myWorkspaces.length > 0
            ? "Pick up where you left off, or spin up a new workspace."
            : "You don't belong to any workspaces yet. Create one to get started."}
        </p>
      </div>

      {myWorkspaces.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
            Your workspaces
          </p>
          <ul className="flex flex-col gap-2">
            {myWorkspaces.map((workspace) => (
              <li key={workspace.id}>
                <button
                  type="button"
                  onClick={() => openWorkspace(workspace)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors",
                    "hover:border-foreground/20 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                    {initials(workspace.name)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {workspace.name}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {workspace.role}
                      <span aria-hidden>·</span>
                      <Users className="h-3 w-3" />
                      {workspace.members}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => setMode("create")}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg border border-dashed border-border p-3 text-left transition-colors",
          "hover:border-foreground/30 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <Plus className="h-5 w-5" />
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-medium">Create a new workspace</span>
          <span className="text-xs text-muted-foreground">
            Start fresh for another team or organization
          </span>
        </span>
      </button>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5 lg:hidden">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Boxes className="h-5 w-5" />
      </div>
      <span className="text-lg font-semibold tracking-tight">ProjectOps</span>
    </div>
  );
}
