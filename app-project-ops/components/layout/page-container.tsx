import { cn } from "@/lib/utils";

/**
 * Consistent max-width/padding wrapper for route content, so individual
 * pages don't each re-implement their own spacing.
 */
export function PageContainer({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8", className)}
      {...props}
    />
  );
}
