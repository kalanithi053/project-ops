import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** KPI row placeholder matching <StatsGrid>. */
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-0">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-7 w-12" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Data-table placeholder (header row + N body rows). */
export function TableSkeleton({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center gap-4 border-b border-border px-3 py-2.5">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-3.5 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex items-center gap-4 border-b border-border px-3 py-3.5 last:border-0"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              className="h-4 flex-1"
              style={{ opacity: 1 - rowIndex * 0.12 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Vertical list of row placeholders (workspace picker, member lists). */
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-lg border border-border p-3"
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Grid of card placeholders (teams, dashboards). */
export function CardsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3.5 w-40" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Kanban board placeholder (columns of stacked cards) — a `TableSkeleton`
 * reads nothing like the real board, which is the point of this one.
 */
export function BoardSkeleton({
  columns = 4,
  cardsPerColumn = 3,
}: {
  columns?: number;
  cardsPerColumn?: number;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: columns }).map((_, columnIndex) => (
        <div
          key={columnIndex}
          className="flex w-72 shrink-0 flex-col gap-2 rounded-lg bg-muted/40 p-2"
        >
          <div className="flex items-center gap-2 px-1 py-0.5">
            <Skeleton className="h-2.5 w-2.5 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
          {Array.from({ length: cardsPerColumn }).map((_, cardIndex) => (
            <div
              key={cardIndex}
              className="flex flex-col gap-2 rounded-md border border-border bg-card p-3"
              style={{ opacity: 1 - cardIndex * 0.15 }}
            >
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-full" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * One dense form-card placeholder: header bar, a wide body column of
 * multi-line fields, and a narrower sidebar column — matches the shape of
 * the task/bug/incident editor (and similar detail forms), which the plain
 * 3-line `CardsSkeleton` body reads as far sparser than.
 */
export function FormSkeleton() {
  return (
    <Card className="mx-auto w-full max-w-6xl">
      <CardHeader className="gap-3">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-7 w-2/3" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-40 w-full rounded-md" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-16 w-full rounded-md" />
        </div>
        <div className="flex flex-col gap-4 lg:border-l lg:border-border lg:pl-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** One placeholder card: title + description line + N body rows. */
function OverviewCardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3.5 w-48" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Matches the project overview page's real layout exactly: a stats row,
 * then the module-capacity / work-by-type / work-by-status grid, then the
 * priority / team-workload grid, then recent activity — six card sections
 * in total, not the generic two-card `CardsSkeleton` this page used to show.
 */
export function ProjectOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <StatsSkeleton count={4} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OverviewCardSkeleton rows={4} />
        </div>
        <div className="flex flex-col gap-4">
          <OverviewCardSkeleton rows={3} />
          <OverviewCardSkeleton rows={3} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <OverviewCardSkeleton rows={4} />
        <OverviewCardSkeleton rows={4} />
      </div>
      <OverviewCardSkeleton rows={3} />
    </div>
  );
}
