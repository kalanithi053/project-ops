export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface EmailLayoutParams {
  /** Drives the top accent bar, badge background, and CTA button. */
  accentColor: string;
  /** Single character/emoji rendered in the badge — no external images or SVG. */
  badgeGlyph: string;
  /** Small uppercase label next to the badge, e.g. "Status changed". */
  eyebrow: string;
  /** Main heading — callers must escape any interpolated user content themselves. */
  title: string;
  /** Action-specific content — callers must escape any interpolated user content themselves. */
  bodyHtml: string;
  cta?: { label: string; url: string };
  /** Hidden preview text shown by mail clients next to the subject line. */
  preheader?: string;
}

/**
 * Shared shell for every transactional email: a brand wordmark, then a
 * colored accent bar + badge that signal the action at a glance, then the
 * action-specific body each template supplies.
 *
 * Plain inline-styled tables only — no external CSS/JS/images/SVG — so it
 * renders consistently across Gmail, Outlook, and Apple Mail without any
 * client-specific fallbacks.
 */
export function renderEmailLayout(params: EmailLayoutParams): string {
  const { accentColor, badgeGlyph, eyebrow, title, bodyHtml, cta, preheader } =
    params;

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Helvetica,Arial,sans-serif;">
    ${
      preheader
        ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>`
        : ''
    }
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="520" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:0 0 16px 0;text-align:center;">
                <span style="font-size:13px;font-weight:700;letter-spacing:0.02em;color:#111827;">ProjectOps</span>
              </td>
            </tr>
          </table>
          <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="height:4px;line-height:4px;font-size:4px;background-color:${accentColor};">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:28px 40px 0 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:36px;height:36px;border-radius:9px;background-color:${accentColor};text-align:center;vertical-align:middle;">
                      <span style="font-size:16px;line-height:36px;color:#ffffff;">${badgeGlyph}</span>
                    </td>
                    <td style="padding-left:12px;vertical-align:middle;">
                      <span style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${accentColor};">${escapeHtml(eyebrow)}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 40px 4px 40px;">
                <p style="margin:0;font-size:17px;font-weight:600;color:#111827;line-height:1.4;">${title}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px 32px 40px;">
                ${bodyHtml}
                ${
                  cta
                    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                        <tr>
                          <td style="border-radius:6px;background-color:${accentColor};">
                            <a href="${cta.url}" style="display:inline-block;padding:11px 20px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(cta.label)}</a>
                          </td>
                        </tr>
                      </table>`
                    : ''
                }
              </td>
            </tr>
            <tr>
              <td style="padding:18px 40px;border-top:1px solid #f1f5f9;">
                <p style="margin:0;font-size:12px;color:#9ca3af;">Automated notification from ProjectOps — please don't reply to this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
