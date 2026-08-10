"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Boxes, ChevronRight, Plus, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { AuthGuard } from "@/components/auth/auth-guard";
import { WorkspaceForm } from "@/components/auth/workspace-form";
import { ListSkeleton } from "@/components/shared/skeletons";
import {
  useMyWorkspaces,
  useSetDefaultWorkspace,
} from "@/lib/api/hooks/use-workspaces";
import type { Workspace } from "@/lib/api/types";

function initials(name: string) {
  return name
    .split(/[\s-]+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Post-login workspace hub. Lists the workspaces the user belongs to
 * (GET /workspaces/me) and lets them create a new one. Both paths route
 * into `/{slug}/projects`.
 */
export default function WorkspacesPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<ListSkeleton rows={2} />}>
        <WorkspacesHub />
      </Suspense>
    </AuthGuard>
  );
}

function WorkspacesHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Deep-link to the create form via /workspaces?new=1.
  const [mode, setMode] = useState<"select" | "create">(
    searchParams.get("new") ? "create" : "select",
  );
  const { data, isLoading, isError } = useMyWorkspaces();
  const setDefaultWorkspace = useSetDefaultWorkspace();
  const workspaces = data ?? [];

  /**
   * With exactly one workspace this screen is a list of one — so we skip it
   * and open that workspace directly. `?manage=1` (the header's Manage
   * workspace entry) opts out, otherwise a single-workspace user could never
   * reach the hub to create a second one.
   */
  const autoOpen =
    mode === "select" &&
    !isLoading &&
    !isError &&
    (workspaces.some((workspace) => workspace.isDefault) ||
      workspaces.length === 1) &&
    !searchParams.get("manage");

  const defaultWorkspace = workspaces.find((workspace) => workspace.isDefault);
  const autoOpenWorkspace = defaultWorkspace ?? workspaces[0];
  const autoOpenSlug = autoOpen ? autoOpenWorkspace?.slug : undefined;

  useEffect(() => {
    // `replace`, not `push` — otherwise Back lands here and forwards again.
    if (autoOpenSlug) router.replace(`/${autoOpenSlug}/dashboard`);
  }, [autoOpenSlug, router]);

  function openWorkspace(workspace: Workspace) {
    router.push(`/${workspace.slug}/dashboard`);
  }

  function setAsDefault(workspace: Workspace) {
    setDefaultWorkspace.mutate(workspace.id);
  }

  // Hold the skeleton through the redirect so the picker never flashes.
  if (autoOpen) {
    return (
      <div className="flex w-full max-w-md flex-col gap-8">
        <BrandMark />
        <ListSkeleton rows={1} />
      </div>
    );
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
            Set up a shared space for your team.
          </p>
        </div>

        <WorkspaceForm
          onCreated={(slug) => router.push(`/${slug}/projects`)}
        />
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
          {workspaces.length > 0
            ? "Pick up where you left off, or spin up a new workspace."
            : "You don't belong to any workspaces yet. Create one to get started."}
        </p>
      </div>

      {isLoading ? (
        <ListSkeleton rows={2} />
      ) : isError ? (
        <p className="text-sm text-destructive">
          Couldn&apos;t load your workspaces. Please try again.
        </p>
      ) : (
        workspaces.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
              Your workspaces
            </p>
            <ul className="flex flex-col gap-2">
              {workspaces.map((workspace) => (
                <li key={String(workspace.id ?? workspace.slug)}>
                  <div
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors",
                      "hover:border-foreground/20 hover:bg-accent",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => openWorkspace(workspace)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                        {initials(workspace.name ?? workspace.slug)}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">
                          {workspace.name ?? workspace.slug}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          projectops.app/{workspace.slug}
                        </span>
                      </span>
                      {workspace.isDefault ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          Default
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAsDefault(workspace)}
                          disabled={setDefaultWorkspace.isPending}
                          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Star className="h-3.5 w-3.5" />
                          Set as default
                        </button>
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
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
