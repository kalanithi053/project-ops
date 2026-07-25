export function otpEmailTemplate(code: string, ttlMinutes: number): string {
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
                <p style="margin:0 0 16px 0;font-size:14px;color:#374151;">
                  Use the code below to sign in. This code expires in ${ttlMinutes} minutes.
                </p>
                <div style="margin:0 0 16px 0;padding:16px 24px;background-color:#f4f5f7;border-radius:6px;text-align:center;">
                  <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#111827;">${code}</span>
                </div>
                <p style="margin:0;font-size:13px;color:#6b7280;">
                  If you didn't request this code, you can safely ignore this email.
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
