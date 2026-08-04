"use client";

import * as React from "react";
import {
  Bold,
  Image as ImageIcon,
  Italic,
  ListChecks,
  ListOrdered,
  Loader2,
  Underline,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast/toast-store";
import {
  MAX_ATTACHMENT_BYTES,
  formatBytes,
  uploadProjectAttachment,
  useResolveAttachmentImages,
} from "@/lib/api/hooks/use-project-attachments";

const IMAGE_ATTRIBUTES = new Set([
  "src",
  "alt",
  "data-attachment-id",
  "data-staging-id",
]);

export function sanitizeRichText(value: string): string {
  const documentValue = new DOMParser().parseFromString(value, "text/html");
  const allowedElements = new Set([
    "B",
    "BR",
    "DIV",
    "EM",
    "I",
    "IMG",
    "LI",
    "OL",
    "P",
    "STRONG",
    "SPAN",
    "U",
    "UL",
  ]);

  documentValue.body
    .querySelectorAll("script, style, iframe, object, embed")
    .forEach((element) => element.remove());

  // An <img> only has legitimate meaning here when it references an
  // uploaded attachment (data-attachment-id) or a not-yet-uploaded image
  // staged during project creation (data-staging-id, see
  // `finalizeStagedImages`) — otherwise it's a bare externally-sourced image
  // (e.g. a pasted <img src="https://evil.example/track.gif">), which would
  // fire on every render as a tracking pixel. Drop those outright rather
  // than merely stripping attributes, on every rich-text surface (task
  // descriptions/comments included), not just project descriptions.
  documentValue.body.querySelectorAll("img").forEach((element) => {
    if (
      !element.getAttribute("data-attachment-id") &&
      !element.getAttribute("data-staging-id")
    ) {
      element.remove();
    }
  });

  documentValue.body.querySelectorAll("*").forEach((element) => {
    if (!allowedElements.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      const keep =
        (element.tagName === "SPAN" &&
          attribute.name === "data-mention-email") ||
        (element.tagName === "IMG" && IMAGE_ATTRIBUTES.has(attribute.name));
      if (!keep) {
        element.removeAttribute(attribute.name);
        return;
      }
      // <img src> only ever holds a same-session blob: preview URL (it's
      // re-resolved from data-attachment-id on every fresh load anyway) —
      // guard against a stray javascript: scheme regardless.
      if (
        element.tagName === "IMG" &&
        attribute.name === "src" &&
        /^\s*javascript:/i.test(attribute.value)
      ) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  return documentValue.body.innerHTML;
}

/**
 * Replaces staged image placeholders (`data-staging-id`, inserted before a
 * project exists to upload against — see the `onStageImage` prop below)
 * with their real `data-attachment-id` per `idMap`, once the files have
 * actually been uploaded. The blob `src` is dropped too, since it's only
 * valid for this browser tab/session and gets re-resolved from the
 * attachment id on next render anyway.
 *
 * Any staged image absent from `idMap` — its upload failed, or this is
 * being used to strip every staged image before any upload has happened —
 * is removed outright rather than left as a dead reference.
 */
export function finalizeStagedImages(
  value: string,
  idMap: Map<string, string>,
): string {
  const documentValue = new DOMParser().parseFromString(value, "text/html");
  documentValue.body
    .querySelectorAll<HTMLImageElement>("img[data-staging-id]")
    .forEach((element) => {
      const stagingId = element.getAttribute("data-staging-id");
      const attachmentId = stagingId ? idMap.get(stagingId) : undefined;
      if (attachmentId) {
        element.setAttribute("data-attachment-id", attachmentId);
        element.removeAttribute("data-staging-id");
        element.removeAttribute("src");
      } else {
        element.remove();
      }
    });
  return documentValue.body.innerHTML;
}

/** Plain-text extract of rich text HTML — for length checks and compact previews. */
export function richTextToPlainText(value: string): string {
  // Block boundaries (paragraphs, list items) carry no whitespace of their
  // own in the DOM, so a raw .textContent runs adjacent blocks together —
  // insert a space at each closing tag before extracting text.
  const withBreaks = value.replace(/<\/(p|div|li|ul|ol)>/gi, "$& ");
  const text =
    new DOMParser().parseFromString(withBreaks, "text/html").body
      .textContent ?? "";
  return text.replace(/\s+/g, " ").trim();
}

interface RichTextEditorProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  "aria-label": string;
  disabled?: boolean;
  className?: string;
  onAtSign?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  /**
   * Enables the image toolbar button and clipboard image paste, uploading
   * immediately and resolving any existing `data-attachment-id` images to
   * viewable blob URLs. Use this when a project already exists to attach
   * the image to.
   */
  imageContext?: { workspaceSlug: string; projectId: string };
  /**
   * Alternative to `imageContext` for surfaces where no project id exists
   * yet to upload against (the New Project form, before creation). Called
   * with the picked/pasted file; returns a caller-chosen staging id that's
   * embedded as `data-staging-id` so the image can be finalized with
   * `finalizeStagedImages` once the file is actually uploaded post-creation.
   * Provide at most one of `imageContext`/`onStageImage` — `imageContext`
   * wins if both are somehow given.
   */
  onStageImage?: (file: File) => string;
}

/** Escapes a string for safe embedding inside a double-quoted HTML attribute. */
function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const RichTextEditor = React.forwardRef<
  HTMLDivElement,
  RichTextEditorProps
>(function RichTextEditor(
  {
    id,
    value,
    onChange,
    placeholder,
    disabled,
    className,
    onAtSign,
    imageContext,
    onStageImage,
    ...aria
  },
  forwardedRef,
) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const latestValue = React.useRef(value);
  const initialized = React.useRef(false);
  const [isUploadingImage, setIsUploadingImage] = React.useState(false);
  const imagesEnabled = Boolean(imageContext || onStageImage);

  React.useImperativeHandle(forwardedRef, () => editorRef.current as HTMLDivElement);

  React.useEffect(() => {
    if (
      editorRef.current &&
      (!initialized.current || value !== latestValue.current)
    ) {
      editorRef.current.innerHTML = sanitizeRichText(value);
      latestValue.current = value;
      initialized.current = true;
    }
  }, [value]);

  useResolveAttachmentImages(
    editorRef,
    imageContext?.workspaceSlug ?? "",
    imageContext?.projectId ?? "",
    [value],
  );

  function emitValue() {
    const next = editorRef.current?.innerHTML ?? "";
    latestValue.current = next;
    onChange(next);
  }

  function runCommand(command: string) {
    editorRef.current?.focus();
    document.execCommand(command);
    emitValue();
  }

  async function handleImageFile(file: File) {
    if (!imagesEnabled) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error(
        "Image too large",
        `${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_ATTACHMENT_BYTES)}.`,
      );
      return;
    }

    const previewUrl = URL.createObjectURL(file);

    // No project id exists yet to upload against (New Project form) — stage
    // the file locally and embed a placeholder the caller finalizes with
    // `finalizeStagedImages` once the project (and a real attachment) exists.
    if (!imageContext) {
      const stagingId = onStageImage!(file);
      editorRef.current?.focus();
      document.execCommand(
        "insertHTML",
        false,
        `<img data-staging-id="${stagingId}" alt="${escapeHtmlAttr(file.name)}" src="${previewUrl}">`,
      );
      emitValue();
      return;
    }

    setIsUploadingImage(true);
    try {
      const attachment = await uploadProjectAttachment(
        imageContext.workspaceSlug,
        imageContext.projectId,
        file,
      );
      editorRef.current?.focus();
      document.execCommand(
        "insertHTML",
        false,
        `<img data-attachment-id="${attachment.id}" data-resolved="true" alt="${escapeHtmlAttr(file.name)}" src="${previewUrl}">`,
      );
      emitValue();
    } catch {
      // apiFetch already surfaces an error toast.
    } finally {
      setIsUploadingImage(false);
    }
  }

  return (
    <div className={cn("overflow-hidden rounded-md border border-input bg-background", className)}>
      <div
        className="flex items-center gap-0.5 border-b border-border bg-muted/40 px-1.5 py-1"
        aria-label={`${aria["aria-label"]} formatting`}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Bold"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("bold")}
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Italic"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("italic")}
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Underline"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("underline")}
        >
          <Underline className="h-3.5 w-3.5" />
        </Button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Bulleted list"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("insertUnorderedList")}
        >
          <ListChecks className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Numbered list"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => runCommand("insertOrderedList")}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>
        {imagesEnabled && (
          <>
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Insert image"
              disabled={disabled || isUploadingImage}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => imageInputRef.current?.click()}
            >
              {isUploadingImage ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImageIcon className="h-3.5 w-3.5" />
              )}
            </Button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImageFile(file);
                event.target.value = "";
              }}
            />
          </>
        )}
      </div>
      <div
        id={id}
        ref={editorRef}
        role="textbox"
        aria-label={aria["aria-label"]}
        aria-multiline="true"
        aria-disabled={disabled || undefined}
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        className="min-h-40 px-3 py-2 text-sm leading-6 outline-none empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] [&_[data-mention-email]]:font-semibold [&_[data-mention-email]]:text-primary [&_img]:my-1 [&_img]:max-w-full [&_img]:rounded-md [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
        onInput={emitValue}
        onKeyDown={(event) => {
          if (event.key === "@" && !disabled) onAtSign?.(event);
        }}
        onPaste={(event) => {
          const imageItem = imagesEnabled
            ? Array.from(event.clipboardData.items).find((item) =>
                item.type.startsWith("image/"),
              )
            : undefined;
          if (imageItem) {
            event.preventDefault();
            const file = imageItem.getAsFile();
            if (file) void handleImageFile(file);
            return;
          }
          event.preventDefault();
          document.execCommand(
            "insertText",
            false,
            event.clipboardData.getData("text/plain"),
          );
          emitValue();
        }}
      />
    </div>
  );
});
