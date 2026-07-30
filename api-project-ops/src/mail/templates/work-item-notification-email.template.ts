function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** 'work_item' -> 'work item'; task/incident/bug pass through as-is. */
function formatLabel(entityType: string): string {
  return entityType === 'work_item' ? 'work item' : entityType;
}

export function workItemNotificationEmailTemplate(params: {
  action: 'created' | 'updated' | 'reminder' | 'assigned';
  entityType: string;
  workItemName: string;
  projectName: string;
  actionUrl: string;
  /** Who reassigned it — only used for the 'assigned' action. */
  actorName?: string;
}): string {
  const {
    action,
    entityType,
    workItemName,
    projectName,
    actionUrl,
    actorName,
  } = params;
  const label = formatLabel(entityType);
  const intro =
    action === 'reminder'
      ? `A reminder about this ${escapeHtml(label)} in <strong>${escapeHtml(projectName)}</strong>:`
      : action === 'assigned'
        ? `You were reassigned to this ${escapeHtml(label)} in <strong>${escapeHtml(projectName)}</strong>${actorName ? ` by <strong>${escapeHtml(actorName)}</strong>` : ''}:`
        : `A ${escapeHtml(label)} was ${action} in <strong>${escapeHtml(projectName)}</strong>:`;

  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:32px 40px 16px 40px;">
                <h1 style="margin:0;font-size:18px;color:#111827;">ProjectOps</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 24px 40px;">
                <p style="margin:0 0 8px 0;font-size:14px;color:#374151;">
                  ${intro}
                </p>
                <p style="margin:0 0 16px 0;font-size:15px;color:#111827;font-weight:bold;">
                  ${escapeHtml(workItemName)}
                </p>
                <p style="margin:0;">
                  <a href="${actionUrl}" style="display:inline-block;border-radius:6px;background-color:#2563eb;padding:10px 16px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">Open ${escapeHtml(label)}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
