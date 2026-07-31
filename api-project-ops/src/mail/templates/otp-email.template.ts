import { renderEmailLayout } from './email-layout.template';

export function otpEmailTemplate(code: string, ttlMinutes: number): string {
  const bodyHtml = `
    <p style="margin:0 0 16px 0;font-size:14px;color:#374151;line-height:1.6;">
      Use the code below to sign in. It expires in ${ttlMinutes} minute${ttlMinutes === 1 ? '' : 's'}.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:18px 0;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;text-align:center;">
          <span style="font-size:30px;font-weight:700;letter-spacing:10px;color:#111827;">${code}</span>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0 0 0;font-size:13px;color:#6b7280;">
      Didn't request this code? You can safely ignore this email.
    </p>`;

  return renderEmailLayout({
    accentColor: '#4f46e5',
    badgeGlyph: '🔒',
    eyebrow: 'Sign-in code',
    title: 'Verify it&rsquo;s you',
    bodyHtml,
  });
}
