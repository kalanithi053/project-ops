"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import {
  RichTextEditor,
  richTextToPlainText,
  sanitizeRichText,
} from "@/components/shared/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useUpdateProject } from "@/lib/api/hooks/use-projects";
import { todayDateInput } from "@/lib/format";
import type { Project } from "@/lib/api/types";

const MAX_DESCRIPTION_CHARS = 20000;

/** Edit panel for a project's name, description (rich text + images), and dates. */
export function EditProjectPanel({
  open,
  onOpenChange,
  workspaceSlug,
  project,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
  project: Project;
}) {
  const updateProject = useUpdateProject(workspaceSlug, project.id);
  const [name, setName] = React.useState(project.name);
  const [description, setDescription] = React.useState(
    project.description ?? "",
  );
  const [startDate, setStartDate] = React.useState(
    project.startDate?.slice(0, 10) ?? "",
  );
  const [endDate, setEndDate] = React.useState(
    project.endDate?.slice(0, 10) ?? "",
  );
  const [error, setError] = React.useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Enter a project name.");
    if (!startDate) return setError("Choose a start date.");
    if (!endDate) return setError("Choose an end date.");
    if (endDate < startDate) {
      return setError("End date can't be before the start date.");
    }

    const sanitizedDescription = sanitizeRichText(description).trim();
    const descriptionText = richTextToPlainText(sanitizedDescription).trim();
    if (descriptionText.length > MAX_DESCRIPTION_CHARS) {
      return setError(
        `Description must be ${MAX_DESCRIPTION_CHARS.toLocaleString()} characters or fewer.`,
      );
    }

    updateProject.mutate(
      {
        name: name.trim(),
        startDate,
        endDate,
        description: descriptionText ? sanitizedDescription : undefined,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle className="text-base">Edit project</SheetTitle>
          <SheetDescription>
            Update the name, description, and dates.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-project-name">Project name</Label>
              <Input
                id="edit-project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-project-description">Description</Label>
              <RichTextEditor
                id="edit-project-description"
                value={description}
                onChange={setDescription}
                placeholder="Add a description…"
                aria-label="Description"
                imageContext={{ workspaceSlug, projectId: project.id }}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-project-start">Start date</Label>
                <Input
                  id="edit-project-start"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-project-end">End date</Label>
                <Input
                  id="edit-project-end"
                  type="date"
                  value={endDate}
                  min={startDate || todayDateInput()}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </div>

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <div className="border-t border-border p-4">
            <Button
              type="submit"
              className="w-full"
              disabled={updateProject.isPending}
            >
              {updateProject.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
