import { escapeHtml, renderEmailLayout } from './email-layout.template';

export function workspaceInviteEmailTemplate(params: {
  workspaceName: string;
  roleName: string;
  loginUrl: string;
}): string {
  const { workspaceName, roleName, loginUrl } = params;

  const bodyHtml = `
    <p style="margin:0 0 14px 0;font-size:15px;color:#6b7280;line-height:1.6;">
      You've been added to this workspace as
    </p>
    <span style="display:inline-block;padding:4px 12px;border-radius:999px;background-color:#eff6ff;border:1px solid #bfdbfe;font-size:12px;font-weight:700;color:#1d4ed8;">${escapeHtml(roleName)}</span>
    <p style="margin:14px 0 0 0;font-size:14px;color:#9ca3af;">
      Sign in with this email address to get started.
    </p>`;

  return renderEmailLayout({
    icon: '🏢',
    title: escapeHtml(workspaceName),
    bodyHtml,
    cta: { label: 'Sign in', url: loginUrl },
    footnote: "If you weren't expecting this, you can safely ignore this email.",
  });
}
