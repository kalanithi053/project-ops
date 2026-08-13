import { cn } from "@/lib/utils";

/**
 * Shared bento-style grid shell. A 4-column responsive grid; tiles opt into
 * the varied-size "bento box" look via span classes on `BentoTile` itself
 * (e.g. `sm:col-span-2 lg:row-span-2`), not on the grid.
 */
export function BentoGrid({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A single bento tile. `interactive` adds hover affordance for tiles that
 * act as links/buttons; plain tiles (stats, highlights) omit it.
 */
export function BentoTile({
  className,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-2xl border border-border bg-card p-5 shadow-sm",
        interactive &&
          "transition-colors hover:border-foreground/20 hover:bg-accent/40",
        className,
      )}
      {...props}
    />
  );
}
