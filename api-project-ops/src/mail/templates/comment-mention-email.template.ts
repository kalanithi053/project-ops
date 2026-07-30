function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
                  <strong>${escapeHtml(authorName)}</strong> mentioned you in a comment in <strong>${escapeHtml(workspaceName)}</strong>.
                </p>
                <div style="padding:16px;background-color:#f4f5f7;border-radius:6px;font-size:14px;line-height:1.5;color:#374151;">
                  ${escapeHtml(commentPreview(body))}
                </div>
                <p style="margin:20px 0 0 0;">
                  <a href="${actionUrl}" style="display:inline-block;border-radius:6px;background-color:#2563eb;padding:10px 16px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">Open comment</a>
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
