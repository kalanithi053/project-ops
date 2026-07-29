"use client";

import { Copy } from "lucide-react";
import type { MouseEvent } from "react";

import { toast } from "@/lib/toast/toast-store";
import { cn } from "@/lib/utils";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

export function CopyWorkItemLink({
  prefix,
  title,
  url,
  className,
}: {
  prefix: string;
  title: string;
  url: string;
  className?: string;
}) {
  async function handleCopy(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    try {
      const href = `${window.location.origin}${url}`;
      const plainText = `${prefix}: ${title}\n${href}`;
      if (typeof ClipboardItem === "undefined") {
        await navigator.clipboard.writeText(plainText);
      } else {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob(
              [
                `<a href="${escapeHtml(href)}">${escapeHtml(prefix)}</a>: ${escapeHtml(title)}`,
              ],
              { type: "text/html" },
            ),
            "text/plain": new Blob([plainText], { type: "text/plain" }),
          }),
        ]);
      }
      toast.success("Work item link copied");
    } catch {
      toast.error("Unable to copy the work item link");
    }
  }

  return (
    <button
      type="button"
      aria-label={`Copy link for ${prefix}: ${title}`}
      title="Copy work item link"
      className={cn(
        "rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/title:opacity-100",
        className,
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={handleCopy}
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}
