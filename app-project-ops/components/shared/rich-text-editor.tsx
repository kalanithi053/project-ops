"use client";

import * as React from "react";
import { Bold, Italic, ListChecks, ListOrdered, Underline } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function sanitizeRichText(value: string): string {
  const documentValue = new DOMParser().parseFromString(value, "text/html");
  const allowedElements = new Set([
    "B",
    "BR",
    "DIV",
    "EM",
    "I",
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

  documentValue.body.querySelectorAll("*").forEach((element) => {
    if (!allowedElements.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      if (
        element.tagName !== "SPAN" ||
        attribute.name !== "data-mention-email"
      ) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  return documentValue.body.innerHTML;
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
}

export const RichTextEditor = React.forwardRef<
  HTMLDivElement,
  RichTextEditorProps
>(function RichTextEditor(
  { id, value, onChange, placeholder, disabled, className, onAtSign, ...aria },
  forwardedRef,
) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const latestValue = React.useRef(value);
  const initialized = React.useRef(false);

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
        className="min-h-40 px-3 py-2 text-sm leading-6 outline-none empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] [&_[data-mention-email]]:font-semibold [&_[data-mention-email]]:text-primary [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
        onInput={emitValue}
        onKeyDown={(event) => {
          if (event.key === "@" && !disabled) onAtSign?.(event);
        }}
        onPaste={(event) => {
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
