"use client";

import * as React from "react";

import { sanitizeRichText } from "@/components/shared/rich-text-editor";
import { useResolveAttachmentImages } from "@/lib/api/hooks/use-project-attachments";
import { cn } from "@/lib/utils";

/** Read-only rendering of rich text (project description, etc.), with any embedded images resolved. */
export function RichTextContent({
  html,
  workspaceSlug,
  projectId,
  className,
}: {
  html: string;
  workspaceSlug: string;
  projectId: string;
  className?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const sanitized = React.useMemo(() => sanitizeRichText(html), [html]);

  useResolveAttachmentImages(containerRef, workspaceSlug, projectId, [
    sanitized,
  ]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "text-sm leading-6 [&_img]:my-1 [&_img]:max-w-full [&_img]:rounded-md [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6",
        className,
      )}
      // sanitizeRichText allowlists elements/attributes before this renders.
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
