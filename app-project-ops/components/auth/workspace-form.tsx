"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateWorkspace } from "@/lib/api/hooks/use-workspaces";

const WORKSPACE_DOMAIN = "projectops.app";

/** Turn a workspace name into a URL-safe slug. */
function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/**
 * New-workspace creation form. POST /workspaces only needs `name` (and an
 * optional `slug`); on success we hand the created workspace's slug back
 * to the caller to route into `/{slug}/projects`.
 */
export function WorkspaceForm({
  onCreated,
}: {
  onCreated: (slug: string) => void;
}) {
  const createWorkspace = useCreateWorkspace();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const finalSlug = slug || slugify(trimmedName);
    if (!trimmedName) return setError("Give your workspace a name.");
    if (!finalSlug) return setError("Choose a workspace URL.");

    // API errors surface via the global error toast.
    createWorkspace.mutate(
      { name: trimmedName, slug: finalSlug },
      { onSuccess: (created) => onCreated(created?.slug ?? finalSlug) },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Workspace name</Label>
        <Input
          id="name"
          name="name"
          placeholder="Acme Engineering"
          value={name}
          onChange={(event) => handleNameChange(event.target.value)}
          aria-invalid={Boolean(error && !name.trim()) || undefined}
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="slug">Workspace URL</Label>
        <div className="flex h-9 w-full items-center rounded-md border border-input bg-background shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          <span className="shrink-0 border-r border-input px-3 text-sm text-muted-foreground">
            {WORKSPACE_DOMAIN}/
          </span>
          <input
            id="slug"
            name="slug"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugify(event.target.value));
            }}
            placeholder="acme-engineering"
            className="h-full w-full rounded-r-md bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Lowercase letters, numbers, and hyphens only.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={createWorkspace.isPending}>
        {createWorkspace.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating workspace…
          </>
        ) : (
          "Create workspace"
        )}
      </Button>
    </form>
  );
}
