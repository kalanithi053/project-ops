export function incidentCreatedEmailTemplate(params: {
  reporterName: string;
  assigneeName: string | null;
  incidentTitle: string;
}): string {
  const { reporterName, assigneeName, incidentTitle } = params;
  const summary = assigneeName
    ? `<strong>${reporterName}</strong> has created an incident and assigned it to <strong>${assigneeName}</strong>.`
    : `<strong>${reporterName}</strong> has created an incident.`;

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
                <h1 style="margin:0;font-size:18px;color:#111827;">ProjectHub</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 24px 40px;">
                <p style="margin:0 0 16px 0;font-size:14px;color:#374151;">
                  ${summary}
                </p>
                <p style="margin:0;font-size:15px;color:#111827;font-weight:bold;">
                  ${incidentTitle}
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
