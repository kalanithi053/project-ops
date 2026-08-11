import { escapeHtml, renderEmailLayout } from './email-layout.template';

function commentPreview(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function commentMentionEmailTemplate(params: {
  authorName: string;
  workspaceName: string;
  body: string;
  actionUrl: string;
}): string {
  const { authorName, workspaceName, body, actionUrl } = params;

  const bodyHtml = `
    <p style="margin:0 0 16px 0;font-size:15px;color:#6b7280;line-height:1.6;">
      in <strong style="color:#374151;">${escapeHtml(workspaceName)}</strong>
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:14px 16px;background-color:#f8fafc;border-left:3px solid #2563eb;border-radius:4px;font-size:14px;line-height:1.6;color:#374151;text-align:left;">
          ${escapeHtml(commentPreview(body))}
        </td>
      </tr>
    </table>`;

  return renderEmailLayout({
    icon: '@',
    title: `${escapeHtml(authorName)} mentioned you`,
    bodyHtml,
    cta: { label: 'View comment', url: actionUrl },
  });
}
