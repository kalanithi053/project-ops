import { escapeHtml, renderEmailLayout } from './email-layout.template';

export function projectInviteEmailTemplate(params: {
  projectName: string;
  roleName: string;
  loginUrl: string;
}): string {
  const { projectName, roleName, loginUrl } = params;

  const bodyHtml = `
    <p style="margin:0 0 12px 0;font-size:14px;color:#374151;line-height:1.6;">
      You've been added to this project as
    </p>
    <span style="display:inline-block;padding:4px 12px;border-radius:999px;background-color:#f0fdf4;border:1px solid #bbf7d0;font-size:12px;font-weight:700;color:#15803d;">${escapeHtml(roleName)}</span>
    <p style="margin:16px 0 0 0;font-size:13px;color:#6b7280;">
      Sign in with this email address to get started.
    </p>`;

  return renderEmailLayout({
    accentColor: '#0d9488',
    badgeGlyph: '🤝',
    eyebrow: 'Project invite',
    title: escapeHtml(projectName),
    bodyHtml,
    cta: { label: 'Sign in', url: loginUrl },
  });
}
