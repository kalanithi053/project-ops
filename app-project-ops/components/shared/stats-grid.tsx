import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { StatItem } from "@/types/module";

/**
 * Responsive KPI row. Renders one <Card> per stat from config, matching
 * the dashboard's stat treatment so numbers read consistently across
 * every module.
 */
export function StatsGrid({ stats }: { stats: StatItem[] }) {
  if (stats.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            </CardHeader>
            <CardContent className="flex flex-col gap-0.5">
              <p className="text-2xl font-semibold">{stat.value}</p>
              {stat.hint && (
                <p className="text-xs text-muted-foreground">{stat.hint}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
