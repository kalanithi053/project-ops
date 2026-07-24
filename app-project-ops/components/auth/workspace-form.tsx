"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField, type SelectOption } from "@/components/shared/select-field";
import { setActiveWorkspace } from "@/lib/tenant/active-workspace";

const WORKSPACE_DOMAIN = "projectops.app";

const INDUSTRIES: SelectOption[] = [
  { label: "Software & Technology", value: "software" },
  { label: "Financial Services", value: "finance" },
  { label: "Healthcare", value: "healthcare" },
  { label: "E-commerce & Retail", value: "retail" },
  { label: "Manufacturing", value: "manufacturing" },
  { label: "Education", value: "education" },
  { label: "Other", value: "other" },
];

const TEAM_SIZES: SelectOption[] = [
  { label: "1–10 people", value: "1-10" },
  { label: "11–50 people", value: "11-50" },
  { label: "51–200 people", value: "51-200" },
  { label: "201–500 people", value: "201-500" },
  { label: "500+ people", value: "500+" },
];

const REGIONS: SelectOption[] = [
  { label: "United States (us-east)", value: "us-east" },
  { label: "European Union (eu-west)", value: "eu-west" },
  { label: "United Kingdom (uk-south)", value: "uk-south" },
  { label: "Asia Pacific (ap-south)", value: "ap-south" },
];

/** Turn a workspace name into a URL-safe slug. */
function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

/**
 * The new-workspace (tenant) creation form. Extracted so it can be used
 * both as a standalone step and inline in the workspace picker. Tenant
 * provisioning isn't wired to a backend yet — this validates client-side
 * and, on success, enters the dashboard. Replace `handleSubmit` with the
 * real provisioning call once the tenant API exists.
 */
export function WorkspaceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [industry, setIndustry] = useState<string>();
  const [teamSize, setTeamSize] = useState<string>();
  const [region, setRegion] = useState<string>("us-east");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Give your workspace a name.");
      return;
    }
    if (!slug) {
      setError("Choose a workspace URL.");
      return;
    }
    if (!industry || !teamSize) {
      setError("Select your industry and team size.");
      return;
    }

    setSubmitting(true);
    // Remember the new workspace (for the tenant switcher) and enter its
    // workspace-scoped dashboard.
    setActiveWorkspace(
      { id: `tn_${slug}`, name: name.trim(), slug },
      { created: true },
    );
    router.push(`/${slug}/dashboard`);
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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="industry">Industry</Label>
          <SelectField
            id="industry"
            aria-label="Industry"
            options={INDUSTRIES}
            value={industry}
            onValueChange={setIndustry}
            placeholder="Select industry"
            invalid={Boolean(error && !industry)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="teamSize">Team size</Label>
          <SelectField
            id="teamSize"
            aria-label="Team size"
            options={TEAM_SIZES}
            value={teamSize}
            onValueChange={setTeamSize}
            placeholder="Select size"
            invalid={Boolean(error && !teamSize)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="region">Data region</Label>
        <SelectField
          id="region"
          aria-label="Data region"
          options={REGIONS}
          value={region}
          onValueChange={setRegion}
        />
        <p className="text-xs text-muted-foreground">
          Where your workspace data is stored. This can&apos;t be changed after
          creation.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? (
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
