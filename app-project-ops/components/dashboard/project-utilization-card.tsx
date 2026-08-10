"use client";

import Link from "next/link";
import { Clock } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/skeletons";
import { Meter } from "@/components/dashboard/meter";
import { scheduleMeter } from "@/lib/utilization-display";
import { formatDate } from "@/lib/format";
import type { ProjectUtilization } from "@/lib/api/types";

const ENGAGEMENT_LABELS: Record<string, string> = {
  fixed_budget: "Fixed budget",
  time_and_material: "Time & material",
  retainer: "Retainer",
};

interface ProjectUtilizationCardProps {
  workspaceSlug: string;
  projects: ProjectUtilization[];
  isLoading: boolean;
}

/**
 * "Hours utilized" — per-project schedule/budget health for Owner/Admin/
 * Client: an hours-budget meter for time_and_material engagements, or a
 * start→target date-window meter for fixed_budget/retainer ones, alongside
 * total logged hours. Backs GET /projects/utilization.
 */
export function ProjectUtilizationCard({
  workspaceSlug,
  projects,
  isLoading,
}: ProjectUtilizationCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hours utilized</CardTitle>
        <CardDescription>
          Logged time against each project&apos;s budget or schedule
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Utilization shows up once a project has logged time."
            icon={Clock}
            className="py-8"
          />
        ) : (
          <ul className="flex flex-col">
            {projects.map((project, index) => {
              const meter = scheduleMeter(project);
              return (
                <li key={project.id}>
                  {index > 0 && <Separator className="my-3" />}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <Link
                        href={`/${workspaceSlug}/projects/${project.id}`}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {project.name}
                      </Link>
                      <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                        {project.loggedHours}h logged
                      </span>
                    </div>
                    {meter ? (
                      <Meter
                        label={
                          project.engagementType
                            ? ENGAGEMENT_LABELS[project.engagementType] ?? meter.label
                            : meter.label
                        }
                        percent={meter.percent}
                        tone={meter.tone}
                        valueLabel={meter.valueLabel}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No estimated hours or target date set.
                      </p>
                    )}
                    {project.basis === "date" && project.startDate && project.targetDate && (
                      <p className="text-xs text-muted-foreground">
                        {formatDate(project.startDate)} – {formatDate(project.targetDate)}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
