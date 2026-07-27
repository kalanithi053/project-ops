"use client";

import { useParams } from "next/navigation";
import * as React from "react";

import {
  SettingsField,
  SettingsFormCard,
  SettingsSection,
} from "@/components/settings/settings-section";
import { QueryState } from "@/components/shared/query-state";
import { CardsSkeleton } from "@/components/shared/skeletons";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { useMe, useUpdateMe } from "@/lib/api/hooks/use-users";
import type { Me } from "@/lib/api/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AccountSettingsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const me = useMe();
  const { roleName } = usePermissions(workspace);

  const saved = me.data;

  return (
    <SettingsSection
      title="Account"
      description="Manage your personal profile details."
    >
      <QueryState
        isLoading={me.isLoading}
        isError={me.isError}
        error={me.error}
        onRetry={() => me.refetch()}
        skeleton={<CardsSkeleton count={1} />}
      >
        {saved && (
          // Keyed on the saved values so a successful save remounts the form
          // against fresh server state — no effect syncing required.
          <ProfileForm
            key={`${saved.username}:${saved.firstName}:${saved.lastName}:${saved.email}`}
            saved={saved}
            roleName={roleName}
          />
        )}
      </QueryState>
    </SettingsSection>
  );
}

function ProfileForm({ saved, roleName }: { saved: Me; roleName?: string }) {
  const update = useUpdateMe();

  const [firstName, setFirstName] = React.useState(saved.firstName ?? "");
  const [lastName, setLastName] = React.useState(saved.lastName ?? "");
  const [email, setEmail] = React.useState(saved.email ?? "");
  const [error, setError] = React.useState<string | null>(null);

  const dirty =
    firstName !== (saved.firstName ?? "") ||
    lastName !== (saved.lastName ?? "") ||
    email !== (saved.email ?? "");

  function discard() {
    setFirstName(saved.firstName ?? "");
    setLastName(saved.lastName ?? "");
    setEmail(saved.email ?? "");
    setError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const nextFirst = firstName.trim();
    const nextEmail = email.trim();

    if (!nextFirst) return setError("First name is required.");
    if (nextEmail && !EMAIL_PATTERN.test(nextEmail)) {
      return setError("Enter a valid email address.");
    }

    update.mutate({
      firstName: nextFirst,
      lastName: lastName.trim(),
      ...(nextEmail ? { email: nextEmail } : {}),
    });
  }

  return (
    <SettingsFormCard
      onSubmit={handleSubmit}
      dirty={dirty}
      pending={update.isPending}
      onDiscard={discard}
      error={error}
      footerNote={
        dirty
          ? "You have unsaved changes."
          : "This profile is shared across every workspace you belong to."
      }
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <SettingsField label="First Name" htmlFor="user-first-name">
          <Input
            id="user-first-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder="Kevin"
            maxLength={80}
            autoComplete="given-name"
          />
        </SettingsField>

        <SettingsField label="Last Name" htmlFor="user-last-name">
          <Input
            id="user-last-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            placeholder="Baker"
            maxLength={80}
            autoComplete="family-name"
          />
        </SettingsField>

        <SettingsField label="Email" htmlFor="user-email">
          <Input
            id="user-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="kevin.baker@amwhiz.com"
            autoComplete="email"
          />
        </SettingsField>
      </div>

      {roleName && (
        <div className="flex items-center gap-2 border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">
            Your role in this workspace
          </span>
          <Badge variant="secondary">{roleName}</Badge>
        </div>
      )}
    </SettingsFormCard>
  );
}
