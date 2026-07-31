import { escapeHtml, renderEmailLayout } from './email-layout.template';

/** 'work_item' -> 'work item'; task/incident/bug pass through as-is. */
function formatLabel(entityType: string): string {
  return entityType === 'work_item' ? 'work item' : entityType;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export interface WorkItemStatusRef {
  name: string;
  color: string | null;
}

export type WorkItemNotificationAction =
  | 'created'
  | 'updated'
  | 'reminder'
  | 'assigned'
  | 'status_changed';

/** A neutral pill — background/border stay fixed, only the text picks up the status's own color. */
function statusPill(status: WorkItemStatusRef): string {
  return `<span style="display:inline-block;padding:5px 12px;border-radius:999px;background-color:#f8fafc;border:1px solid #e2e8f0;font-size:12px;font-weight:700;color:${status.color || '#374151'};">${escapeHtml(status.name)}</span>`;
}

export function workItemNotificationEmailTemplate(params: {
  action: WorkItemNotificationAction;
  entityType: string;
  workItemName: string;
  projectName: string;
  actionUrl: string;
  /** Who reassigned it — only used for the 'assigned' action. */
  actorName?: string;
  /** Only used for the 'status_changed' action. */
  fromStatus?: WorkItemStatusRef;
  toStatus?: WorkItemStatusRef;
}): string {
  const {
    action,
    entityType,
    workItemName,
    projectName,
    actionUrl,
    actorName,
    fromStatus,
    toStatus,
  } = params;
  const label = formatLabel(entityType);
  const projectBadge = `<strong>${escapeHtml(projectName)}</strong>`;

  const VISUALS: Record<
    WorkItemNotificationAction,
    { accentColor: string; badgeGlyph: string; eyebrow: string }
  > = {
    created: {
      accentColor: '#16a34a',
      badgeGlyph: '+',
      eyebrow: `New ${label}`,
    },
    updated: {
      accentColor: '#64748b',
      badgeGlyph: '✎',
      eyebrow: `${capitalize(label)} updated`,
    },
    status_changed: {
      accentColor: toStatus?.color || '#d97706',
      badgeGlyph: '⇄',
      eyebrow: 'Status changed',
    },
    assigned: {
      accentColor: '#7c3aed',
      badgeGlyph: '☺',
      eyebrow: `You've been assigned`,
    },
    reminder: {
      accentColor: '#f59e0b',
      badgeGlyph: '🔔',
      eyebrow: 'Reminder',
    },
  };
  const visual = VISUALS[action];

  let bodyHtml: string;
  if (action === 'status_changed' && fromStatus && toStatus) {
    bodyHtml = `
      <p style="margin:0 0 14px 0;font-size:14px;color:#374151;line-height:1.6;">
        This ${escapeHtml(label)} in ${projectBadge} moved:
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td>${statusPill(fromStatus)}</td>
          <td style="padding:0 10px;color:#9ca3af;font-size:14px;">&rarr;</td>
          <td>${statusPill(toStatus)}</td>
        </tr>
      </table>`;
  } else {
    const intro =
      action === 'reminder'
        ? `A reminder about this ${escapeHtml(label)} in ${projectBadge}:`
        : action === 'assigned'
          ? `You were assigned to this ${escapeHtml(label)} in ${projectBadge}${actorName ? ` by <strong>${escapeHtml(actorName)}</strong>` : ''}:`
          : action === 'created'
            ? `A new ${escapeHtml(label)} was created in ${projectBadge}:`
            : `A ${escapeHtml(label)} was updated in ${projectBadge}:`;
    bodyHtml = `<p style="margin:0 0 4px 0;font-size:14px;color:#374151;line-height:1.6;">${intro}</p>`;
  }

  return renderEmailLayout({
    accentColor: visual.accentColor,
    badgeGlyph: visual.badgeGlyph,
    eyebrow: visual.eyebrow,
    title: escapeHtml(workItemName),
    bodyHtml,
    cta: { label: `Open ${escapeHtml(label)}`, url: actionUrl },
  });
}
