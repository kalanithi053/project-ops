import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";

/**
 * Layout for pre-dashboard routes (sign-in, workspace picker, and
 * future flows like SSO callback). A two-column
 * enterprise shell: a fixed branded rail on the left (desktop only) and
 * the active form centered on the right. Deliberately excludes the app
 * shell — these pages render before a session exists.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr] xl:grid-cols-2">
      <AuthBrandPanel className="hidden lg:flex" />
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10 sm:px-8">
        {children}
      </main>
    </div>
  );
}
