import { Boxes, Check } from "lucide-react";

import { cn } from "@/lib/utils";

const highlights = [
  "Plan sprints and track delivery in one shared workspace",
  "See team capacity and resourcing at a glance",
  "Enterprise-grade roles, SSO, and audit logs built in",
];

/**
 * The branded left rail shown alongside the auth forms (sign-in,
 * create-workspace). Intentionally dark in both light and dark themes —
 * it uses the fixed neutral scale rather than theme tokens so the brand
 * treatment stays consistent regardless of the viewer's color scheme.
 */
export function AuthBrandPanel({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "relative flex-col justify-between overflow-hidden bg-neutral-950 p-10 text-neutral-100 lg:p-12",
        className,
      )}
    >
      {/* Soft brand glows for depth (purely decorative). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(600px circle at 20% 15%, rgba(99,102,241,0.18), transparent 45%), radial-gradient(500px circle at 85% 85%, rgba(56,189,248,0.14), transparent 45%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-neutral-950">
          <Boxes className="h-5 w-5" />
        </div>
        <span className="text-lg font-semibold tracking-tight">ProjectOps</span>
      </div>

      <div className="relative flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            The operating system for engineering delivery.
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-neutral-400">
            Bring projects, people, and capacity into one place — so your teams
            always know what&apos;s on track, what&apos;s at risk, and where to
            focus next.
          </p>
        </div>

        <ul className="flex flex-col gap-3">
          {highlights.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Check className="h-3 w-3 text-neutral-100" />
              </span>
              <span className="text-sm text-neutral-300">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative flex items-center justify-between text-xs text-neutral-500">
        <span>SOC 2 Type II · GDPR ready</span>
        <span>© {new Date().getFullYear()} ProjectOps</span>
      </div>
    </aside>
  );
}
