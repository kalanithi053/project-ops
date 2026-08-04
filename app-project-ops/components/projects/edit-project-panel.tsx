"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import {
  RichTextEditor,
  finalizeStagedImages,
  hasRichTextContent,
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
import { uploadProjectAttachment } from "@/lib/api/hooks/use-project-attachments";
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
  const [isUploadingImages, setIsUploadingImages] = React.useState(false);
  // Images inserted via the editor's image button, staged locally (a blob
  // preview only) until "Save changes" — see RichTextEditor's `onStageImage`.
  const stagedImagesRef = React.useRef<Map<string, File>>(new Map());
  const stagingIdCounter = React.useRef(0);

  function stageImage(file: File): string {
    const stagingId = `staging-${stagingIdCounter.current++}`;
    stagedImagesRef.current.set(stagingId, file);
    return stagingId;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Enter a project name.");
    if (!startDate) return setError("Choose a start date.");
    if (!endDate) return setError("Choose an end date.");
    if (endDate < startDate) {
      return setError("End date can't be before the start date.");
    }

    const sanitizedDescription = sanitizeRichText(description).trim();
    // Finalizing only touches img tag attributes, never visible text, so the
    // length check is valid pre-upload — no point uploading images just to
    // reject the save afterward.
    const descriptionText = richTextToPlainText(sanitizedDescription).trim();
    if (descriptionText.length > MAX_DESCRIPTION_CHARS) {
      return setError(
        `Description must be ${MAX_DESCRIPTION_CHARS.toLocaleString()} characters or fewer.`,
      );
    }

    let finalDescription = sanitizedDescription;
    if (stagedImagesRef.current.size > 0) {
      setIsUploadingImages(true);
      const idMap = new Map<string, string>();
      // Best-effort: an image that fails to upload is dropped from the
      // description (by finalizeStagedImages) rather than holding up the rest.
      await Promise.all(
        Array.from(stagedImagesRef.current.entries()).map(
          async ([stagingId, file]) => {
            try {
              // isInline: false — a description's image is a real project
              // asset, so (unlike a comment's) it also shows in Attachments.
              const attachment = await uploadProjectAttachment(
                workspaceSlug,
                project.id,
                file,
                undefined,
                false,
              );
              idMap.set(stagingId, attachment.id);
            } catch {
              // Dropped below by finalizeStagedImages.
            }
          },
        ),
      );
      finalDescription = finalizeStagedImages(sanitizedDescription, idMap);
      setIsUploadingImages(false);
    }

    updateProject.mutate(
      {
        name: name.trim(),
        startDate,
        endDate,
        description: hasRichTextContent(finalDescription)
          ? finalDescription
          : undefined,
      },
      {
        onSuccess: () => {
          stagedImagesRef.current.clear();
          onOpenChange(false);
        },
      },
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
                disabled={isUploadingImages}
                imageContext={{ workspaceSlug, projectId: project.id }}
                onStageImage={stageImage}
                onRemoveStagedImage={(stagingId) =>
                  stagedImagesRef.current.delete(stagingId)
                }
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
              disabled={updateProject.isPending || isUploadingImages}
            >
              {updateProject.isPending || isUploadingImages ? (
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
