import { formatDate } from "@/lib/format";
import type { WorkItemInsightRef } from "@/lib/api/types";

/**
 * Name/prefix/type/project/due-date block shared by the dashboard's
 * attention, priority, and quick-time-log work-item lists — keeps that
 * layout identical across all three instead of drifting independently.
 */
export function WorkItemInsightTitle({ item }: { item: WorkItemInsightRef }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="flex items-center gap-1.5 text-sm font-medium">
        {item.workItemType && (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: item.workItemType.color ?? "var(--status-neutral)" }}
            aria-hidden
          />
        )}
        {item.prefix && (
          <span className="shrink-0 text-muted-foreground">{item.prefix}</span>
        )}
        <span className="truncate">{item.name}</span>
      </span>
      <span className="text-xs text-muted-foreground">
        {item.workItemType ? `${item.workItemType.name} · ` : ""}
        {item.project.name}
      </span>
      {item.dueDate && (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          due {formatDate(item.dueDate)}
        </span>
      )}
    </div>
  );
}
