export function taskStatusEmailTemplate(params: {
  taskName: string;
  taskPrefix: string | null;
  projectName: string;
  oldStatusName: string;
  newStatusName: string;
  actionUrl: string;
}): string {
  const {
    taskName,
    taskPrefix,
    projectName,
    oldStatusName,
    newStatusName,
    actionUrl,
  } = params;
  const label = taskPrefix ? `${taskPrefix} · ${taskName}` : taskName;

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
                  Task status updated in <strong>${projectName}</strong>:
                </p>
                <p style="margin:0 0 16px 0;font-size:15px;color:#111827;font-weight:bold;">
                  ${label}
                </p>
                <div style="margin:0 0 16px 0;padding:16px 24px;background-color:#f4f5f7;border-radius:6px;text-align:center;font-size:14px;color:#111827;">
                  <span style="color:#6b7280;">${oldStatusName}</span>
                  &nbsp;&rarr;&nbsp;
                  <strong>${newStatusName}</strong>
                </div>
                <p style="margin:0;">
                  <a href="${actionUrl}" style="display:inline-block;border-radius:6px;background-color:#2563eb;padding:10px 16px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">Open task</a>
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
