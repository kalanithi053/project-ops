export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface EmailLayoutParams {
  /** Large centered glyph/emoji rendered above the heading — no external images or SVG. */
  icon: string;
  /** Main heading — callers must escape any interpolated user content themselves. */
  title: string;
  /** Action-specific content — callers must escape any interpolated user content themselves. Should be center-aligned to match the shell. */
  bodyHtml: string;
  cta?: { label: string; url: string };
  /** Small muted centered line shown below the CTA (or body, if there's no CTA). Callers must escape it themselves. */
  footnote?: string;
  /** Hidden preview text shown by mail clients next to the subject line. */
  preheader?: string;
}

/**
 * Shared shell for every transactional email: a centered wordmark, a large
 * centered glyph, a bold centered heading, then the action-specific body
 * each template supplies, and a single black CTA button.
 *
 * Plain inline-styled tables only — no external CSS/JS/images/SVG — so it
 * renders consistently across Gmail, Outlook, and Apple Mail without any
 * client-specific fallbacks.
 */
export function renderEmailLayout(params: EmailLayoutParams): string {
  const { icon, title, bodyHtml, cta, footnote, preheader } = params;

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background-color:#ffffff;font-family:Helvetica,Arial,sans-serif;">
    ${
      preheader
        ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>`
        : ''
    }
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;padding:48px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:0 24px 40px 24px;text-align:center;">
                <span style="font-size:15px;font-weight:700;letter-spacing:0.01em;color:#111827;">ProjectOps</span>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 20px 24px;text-align:center;">
                <span style="font-size:52px;line-height:1;">${icon}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 12px 24px;text-align:center;">
                <p style="margin:0;font-size:26px;font-weight:700;color:#111827;line-height:1.3;">${title}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 4px 40px;text-align:center;">
                ${bodyHtml}
              </td>
            </tr>
            ${
              cta
                ? `<tr>
                    <td style="padding:24px 24px 4px 24px;text-align:center;">
                      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                        <tr>
                          <td style="border-radius:8px;background-color:#111827;">
                            <a href="${cta.url}" style="display:inline-block;padding:13px 32px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;">${escapeHtml(cta.label)}</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>`
                : ''
            }
            ${
              footnote
                ? `<tr>
                    <td style="padding:24px 40px 8px 40px;text-align:center;">
                      <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">${footnote}</p>
                    </td>
                  </tr>`
                : ''
            }
            <tr>
              <td style="padding:32px 24px 0 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f1f5f9;">
                  <tr>
                    <td style="padding:20px 0 0 0;text-align:center;">
                      <p style="margin:0;font-size:12px;color:#9ca3af;">Automated notification from ProjectOps — please don't reply to this email.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
