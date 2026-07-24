import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Panel, Tone } from "@/types/module";

const spanClass: Record<1 | 2 | 3, string> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
};

/** Tailwind classes for the progress-bar fill, keyed by tone. */
const barToneClass: Record<Tone, string> = {
  default: "bg-primary",
  secondary: "bg-secondary-foreground",
  outline: "bg-foreground",
  success: "bg-status-success",
  warning: "bg-status-warning",
  error: "bg-status-error",
  info: "bg-status-info",
  neutral: "bg-status-neutral",
};

function PanelCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * Renders a config-driven grid of non-tabular panels (activity lists,
 * utilization bars, badge breakdowns, settings fields). Lets dashboard
 * and settings modules stay 100% declarative — same as table modules.
 */
export function ModulePanels({ panels }: { panels: Panel[] }) {
  if (panels.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {panels.map((panel) => (
        <div
          key={panel.title}
          className={cn("min-w-0", spanClass[panel.span ?? 1])}
        >
          {panel.type === "list" && (
            <PanelCard title={panel.title} description={panel.description}>
              <ul className="flex flex-col">
                {panel.items.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <li key={`${item.primary}-${index}`}>
                      {index > 0 && <Separator className="my-3" />}
                      <div className="flex items-start gap-3">
                        {Icon && (
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{item.primary}</p>
                          {item.secondary && (
                            <p className="truncate text-xs text-muted-foreground">
                              {item.secondary}
                            </p>
                          )}
                        </div>
                        {item.meta && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {item.meta}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </PanelCard>
          )}

          {panel.type === "progress" && (
            <PanelCard title={panel.title} description={panel.description}>
              <div className="flex flex-col gap-4">
                {panel.items.map((item) => {
                  const max = item.max ?? 100;
                  const pct = Math.max(
                    0,
                    Math.min(100, Math.round((item.value / max) * 100)),
                  );
                  return (
                    <div key={item.label} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate">{item.label}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {item.valueLabel ?? `${pct}%`}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            barToneClass[item.tone ?? "info"],
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </PanelCard>
          )}

          {panel.type === "breakdown" && (
            <PanelCard title={panel.title} description={panel.description}>
              <div className="flex flex-col gap-3">
                {panel.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between"
                  >
                    <Badge variant={item.tone ?? "neutral"}>{item.label}</Badge>
                    <span className="text-sm font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            </PanelCard>
          )}

          {panel.type === "fields" && (
            <PanelCard title={panel.title} description={panel.description}>
              <dl className="flex flex-col">
                {panel.items.map((item, index) => (
                  <div key={item.label}>
                    {index > 0 && <Separator className="my-3" />}
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-sm text-muted-foreground">
                        {item.label}
                      </dt>
                      <dd className="text-right text-sm font-medium">
                        {item.value}
                        {item.hint && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {item.hint}
                          </span>
                        )}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>
            </PanelCard>
          )}
        </div>
      ))}
    </div>
  );
}
