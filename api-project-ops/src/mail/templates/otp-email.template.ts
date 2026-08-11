import { renderEmailLayout } from './email-layout.template';

function formatTtl(ttlMinutes: number): string {
  if (ttlMinutes >= 1440) {
    const days = Math.round(ttlMinutes / 1440);
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  return `${ttlMinutes} minute${ttlMinutes === 1 ? '' : 's'}`;
}

export function otpEmailTemplate(code: string, ttlMinutes: number): string {
  const bodyHtml = `
    <p style="margin:0;font-size:15px;color:#6b7280;line-height:1.6;">
      Use the code below to sign in. It expires in ${formatTtl(ttlMinutes)}.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
      <tr>
        <td style="padding:18px 0;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;text-align:center;">
          <span style="font-size:30px;font-weight:700;letter-spacing:10px;color:#111827;">${code}</span>
        </td>
      </tr>
    </table>`;

  return renderEmailLayout({
    icon: '🔒',
    title: 'Verify it&rsquo;s you',
    bodyHtml,
    footnote: "Didn't request this code? You can safely ignore this email.",
  });
}
