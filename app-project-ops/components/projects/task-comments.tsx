"use client";

import * as React from "react";
import {
  Loader2,
  MessageSquare,
  PencilLine,
  Send,
  Trash2,
} from "lucide-react";

import {
  RichTextEditor,
  sanitizeRichText,
} from "@/components/shared/rich-text-editor";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import {
  useCreateWorkItemComment,
  useDeleteWorkItemComment,
  useWorkItemComments,
  useUpdateWorkItemComment,
} from "@/lib/api/hooks/use-work-item-comments";
import { useWorkspaceMembers } from "@/lib/api/hooks/use-members";
import { useMe } from "@/lib/api/hooks/use-users";
import { formatDateTime } from "@/lib/format";
import { getFullname } from "@/lib/utils";

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function authorName(author: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  return getFullname(author) ?? author.email;
}

function commentTime(value: string): string {
  return formatDateTime(value);
}

function plainText(value: string): string {
  return new DOMParser().parseFromString(value, "text/html").body.textContent?.trim() ?? "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function TaskComments({
  workspaceSlug,
  projectId,
  taskId,
  incidentId,
  canComment,
}: {
  workspaceSlug: string;
  projectId: string;
  taskId?: string;
  incidentId?: string;
  canComment: boolean;
}) {
  const itemType = incidentId ? "incident" : "task";
  const itemId = incidentId ?? taskId ?? "";
  const comments = useWorkItemComments(
    workspaceSlug,
    projectId,
    itemType,
    itemId,
  );
  const createComment = useCreateWorkItemComment(
    workspaceSlug,
    projectId,
    itemType,
    itemId,
  );
  const updateComment = useUpdateWorkItemComment(
    workspaceSlug,
    projectId,
    itemType,
    itemId,
  );
  const deleteComment = useDeleteWorkItemComment(
    workspaceSlug,
    projectId,
    itemType,
    itemId,
  );
  const { data: workspaceMembers } = useWorkspaceMembers(workspaceSlug);
  const { data: me } = useMe();
  const editorRef = React.useRef<HTMLDivElement>(null);
  const [body, setBody] = React.useState("");
  const [mentionedEmails, setMentionedEmails] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [mentionOpen, setMentionOpen] = React.useState(false);
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(null);
  const [editingBody, setEditingBody] = React.useState("");
  const [deletingCommentId, setDeletingCommentId] = React.useState<string | null>(null);

  const mentionableMembers = (workspaceMembers ?? [])
    .filter((member) => member.status !== "removed")
    .map((member) => {
      const user = member.user ?? member;
      const email = user.email;
      const name = getFullname(user) ?? email;
      return email ? { email, name } : null;
    })
    .filter((member): member is { email: string; name: string } => Boolean(member));

  function syncMentionState(nextBody: string) {
    const documentValue = new DOMParser().parseFromString(nextBody, "text/html");
    const activeMentionEmails = new Set(
      Array.from(
        documentValue.querySelectorAll<HTMLElement>("[data-mention-email]"),
      )
        .filter((mention) => mention.textContent?.replace("@", "").trim())
        .map((mention) => mention.dataset.mentionEmail)
        .filter((email): email is string => Boolean(email)),
    );
    const nextText = plainText(nextBody);
    setMentionedEmails((current) =>
      current.filter((email) => {
        if (activeMentionEmails.has(email)) return true;
        const member = mentionableMembers.find((option) => option.email === email);
        return member ? nextText.includes(`@${member.name}`) : false;
      }),
    );
  }

  function changeBody(nextBody: string) {
    setBody(nextBody);
    syncMentionState(nextBody);
  }

  function addMention(email: string, name: string) {
    if (mentionedEmails.includes(email)) return;
    editorRef.current?.focus();
    document.execCommand(
      "insertHTML",
      false,
      `<span data-mention-email="${escapeHtml(email)}">@${escapeHtml(name)}</span>&nbsp;`,
    );
    setBody(editorRef.current?.innerHTML ?? body);
    setMentionedEmails((current) =>
      current.includes(email) ? current : [...current, email],
    );
    setMentionOpen(false);
  }

  function submit() {
    const sanitizedBody = sanitizeRichText(body).trim();
    const textBody = plainText(sanitizedBody);
    if (!textBody) return setError("Write a comment before posting.");
    if (textBody.length > 4000) {
      return setError("Comments must be 4,000 characters or fewer.");
    }

    setError(null);
    createComment.mutate(
      {
        body: sanitizedBody,
        ...(mentionedEmails.length ? { mentions: mentionedEmails } : {}),
      },
      {
        onSuccess: () => {
          setBody("");
          setMentionedEmails([]);
        },
      },
    );
  }

  function startEditing(comment: {
    id: string;
    body: string;
  }) {
    setEditingCommentId(comment.id);
    setEditingBody(comment.body);
    setDeletingCommentId(null);
  }

  function saveEdit(comment: {
    id: string;
    mentions: Array<{ user: { email: string } }>;
  }) {
    const sanitizedBody = sanitizeRichText(editingBody).trim();
    if (!plainText(sanitizedBody)) return;

    updateComment.mutate(
      {
        id: comment.id,
        dto: {
          body: sanitizedBody,
          mentions: comment.mentions.map((mention) => mention.user.email),
        },
      },
      { onSuccess: () => setEditingCommentId(null) },
    );
  }

  return (
    <section className="border-t border-border pt-4" aria-labelledby="comments-heading">
      <div className="mb-3 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h2 id="comments-heading" className="text-sm font-semibold">
          Comments
        </h2>
        {comments.data && (
          <span className="text-xs text-muted-foreground">
            {comments.data.length}
          </span>
        )}
      </div>

      {canComment ? (
        <div className="mb-4 flex flex-col gap-2">
          <Popover
            open={mentionOpen}
            onOpenChange={(open) => {
              setMentionOpen(open);
            }}
          >
            <PopoverAnchor asChild>
              <div>
                <RichTextEditor
                  ref={editorRef}
                  id="task-comment"
                  value={body}
                  onChange={changeBody}
                  placeholder="Add a comment…"
                  aria-label="Comment"
                  disabled={createComment.isPending}
                  className="[&_[role=textbox]]:min-h-24"
                  onAtSign={(event) => {
                    event.preventDefault();
                    setMentionOpen(true);
                  }}
                />
              </div>
            </PopoverAnchor>
            <PopoverContent
              side="top"
              align="start"
              className="max-h-64 min-w-56 overflow-y-auto p-1"
            >
              <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Workspace members
              </p>
              {mentionableMembers.map((member) => (
                <button
                  type="button"
                  key={member.email}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
                  onClick={() => addMention(member.email, member.name)}
                >
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[9px]">
                      {initials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0">
                    <span className="block truncate">{member.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {member.email}
                    </span>
                  </span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={createComment.isPending || !body.trim()}
              onClick={submit}
            >
              {createComment.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Post comment
            </Button>
          </div>
        </div>
      ) : (
        <p className="mb-4 text-xs text-muted-foreground">
          You don&apos;t have permission to add comments.
        </p>
      )}

      {comments.isLoading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading comments…
        </div>
      ) : comments.isError ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border p-3">
          <p className="text-sm text-muted-foreground">
            Comments could not be loaded.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => comments.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : comments.data?.length ? (
        <ol className="flex flex-col gap-3">
          {comments.data.map((comment) => {
            const name = authorName(comment.author);
            const canManageComment = canComment && me?.id === comment.authorId;
            const isEditing = editingCommentId === comment.id;
            const isDeleting = deletingCommentId === comment.id;
            return (
              <li key={comment.id} className="flex gap-2.5">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-[10px]">
                    {initials(name) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 rounded-md bg-muted/50 px-3 py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium">{name}</span>
                    <span className="inline-flex items-center gap-1">
                      <time
                        dateTime={comment.createdAt}
                        className="text-xs text-muted-foreground"
                      >
                        {commentTime(comment.createdAt)}
                      </time>
                      {canManageComment && !isEditing && !isDeleting && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            aria-label="Edit comment"
                            onClick={() => startEditing(comment)}
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            aria-label="Delete comment"
                            onClick={() => setDeletingCommentId(comment.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </span>
                  </div>
                  {isEditing ? (
                    <div className="mt-2 flex flex-col gap-2">
                      <RichTextEditor
                        id={`edit-comment-${comment.id}`}
                        value={editingBody}
                        onChange={setEditingBody}
                        placeholder="Edit comment…"
                        aria-label="Edit comment"
                        disabled={updateComment.isPending}
                        className="[&_[role=textbox]]:min-h-24"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={updateComment.isPending}
                          onClick={() => setEditingCommentId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={updateComment.isPending || !plainText(editingBody)}
                          onClick={() => saveEdit(comment)}
                        >
                          {updateComment.isPending && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                          Save comment
                        </Button>
                      </div>
                    </div>
                  ) : isDeleting ? (
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-background px-2 py-1.5">
                      <span className="text-xs text-muted-foreground">
                        Delete this comment?
                      </span>
                      <span className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={deleteComment.isPending}
                          onClick={() => setDeletingCommentId(null)}
                        >
                          Keep
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={deleteComment.isPending}
                          onClick={() =>
                            deleteComment.mutate(comment.id, {
                              onSuccess: () => setDeletingCommentId(null),
                            })
                          }
                        >
                          {deleteComment.isPending && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          )}
                          Delete
                        </Button>
                      </span>
                    </div>
                  ) : (
                    <>
                      <div
                        className="mt-1 whitespace-pre-wrap text-sm leading-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeRichText(comment.body),
                        }}
                      />
                      {comment.mentions.length > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Mentioned: {comment.mentions
                            .map((mention) => authorName(mention.user))
                            .join(", ")}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      )}
    </section>
  );
}
