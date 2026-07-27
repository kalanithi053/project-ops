"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QueryState } from "@/components/shared/query-state";
import { CardsSkeleton } from "@/components/shared/skeletons";
import {
  SettingsField,
  SettingsFormCard,
  SettingsSection,
} from "@/components/settings/settings-section";
import {
  useUpdateWorkspace,
  useWorkspaceSettings,
} from "@/lib/api/hooks/use-settings";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/api/permissions";
import type { WorkspaceSettings } from "@/lib/api/types";

const WORKSPACE_DOMAIN = "projectops.app";
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Coerces free typing into the lowercase hyphenated form the API accepts. */
function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-");
}

export default function WorkspaceSettingsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const settings = useWorkspaceSettings(workspace);
  const { can } = usePermissions(workspace);

  const saved = settings.data?.workspace;

  return (
    <SettingsSection
      title="Workspace"
      description="Update your workspace identity and URL."
    >
      <QueryState
        isLoading={settings.isLoading}
        isError={settings.isError}
        error={settings.error}
        onRetry={() => settings.refetch()}
        skeleton={<CardsSkeleton count={1} />}
      >
        <div className="flex flex-col gap-4">
          {saved && (
            // Keyed on the saved values so a successful save remounts the
            // form against fresh server state — no effect syncing required.
            <WorkspaceIdentityForm
              key={`${saved.id}:${saved.name}:${saved.slug}`}
              workspaceSlug={workspace}
              saved={saved}
              canManage={can(PERMISSIONS.WORKSPACE_MANAGE)}
            />
          )}

          <WorkspaceIdCard workspaceId={saved?.id} />
        </div>
      </QueryState>
    </SettingsSection>
  );
}

function WorkspaceIdentityForm({
  workspaceSlug,
  saved,
  canManage,
}: {
  workspaceSlug: string;
  saved: WorkspaceSettings["workspace"];
  canManage: boolean;
}) {
  const router = useRouter();
  const update = useUpdateWorkspace(workspaceSlug);

  const [name, setName] = React.useState(saved.name);
  const [slug, setSlug] = React.useState(saved.slug);
  const [error, setError] = React.useState<string | null>(null);

  const dirty = name !== saved.name || slug !== saved.slug;

  function discard() {
    setName(saved.name);
    setSlug(saved.slug);
    setError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const nextName = name.trim();
    const nextSlug = slug.trim();

    if (nextName.length < 2) {
      return setError("Workspace name must be at least 2 characters.");
    }
    if (!SLUG_PATTERN.test(nextSlug)) {
      return setError(
        "URL can only contain lowercase letters, numbers and single hyphens.",
      );
    }

    update.mutate(
      {
        ...(nextName !== saved.name ? { name: nextName } : {}),
        ...(nextSlug !== saved.slug ? { slug: nextSlug } : {}),
      },
      {
        onSuccess: (updated) => {
          // The slug is both the URL segment and the tenant header, so the
          // current route no longer resolves once it changes.
          if (updated.slug !== workspaceSlug) {
            router.replace(`/${updated.slug}/settings/workspace`);
          }
        },
      },
    );
  }

  return (
    <SettingsFormCard
      onSubmit={handleSubmit}
      dirty={dirty}
      pending={update.isPending}
      onDiscard={discard}
      error={error}
      disabled={!canManage}
      footerNote={dirty ? "You have unsaved changes." : "Everything is up to date."}
    >
      <SettingsField label="Name" htmlFor="workspace-name">
        <Input
          id="workspace-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Amwhiz"
          maxLength={80}
        />
      </SettingsField>

      <SettingsField
        label="URL"
        htmlFor="workspace-slug"
        hint="Changing this changes every link to this workspace. Existing bookmarks will stop working."
      >
        <div className="flex w-full items-stretch">
          <span className="inline-flex shrink-0 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
            {WORKSPACE_DOMAIN}/
          </span>
          <Input
            id="workspace-slug"
            value={slug}
            onChange={(event) => setSlug(normalizeSlug(event.target.value))}
            placeholder="amwhiz"
            maxLength={80}
            className="rounded-l-none"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </SettingsField>
    </SettingsFormCard>
  );
}

/** Read-only workspace identifier, for support tickets and API calls. */
function WorkspaceIdCard({ workspaceId }: { workspaceId?: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    if (!workspaceId) return;
    await navigator.clipboard.writeText(workspaceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">Workspace ID</p>
        <p className="font-mono text-xs text-muted-foreground">
          {workspaceId ?? "—"}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={copy}
        disabled={!workspaceId}
        className="w-full sm:w-auto"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copy
          </>
        )}
      </Button>
    </div>
  );
}
