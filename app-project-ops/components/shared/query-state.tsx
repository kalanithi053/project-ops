"use client";

import * as React from "react";
import { AlertTriangle, Loader2, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useOnlineStatus } from "@/hooks/use-online-status";

interface QueryStateProps {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Custom loading placeholder (e.g. a skeleton). Falls back to a spinner. */
  skeleton?: React.ReactNode;
  loadingLabel?: string;
  errorLabel?: string;
  /** Show a "slow connection" hint if still loading after this many ms. */
  slowAfterMs?: number;
  children: React.ReactNode;
}

function isNetworkError(error: unknown, online: boolean): boolean {
  if (!online) return true;
  // A dropped fetch throws before we can build an ApiError.
  if (error instanceof ApiError) return false;
  if (error instanceof Error) return /fetch|network|load failed/i.test(error.message);
  return false;
}

/**
 * Standard loading / slow / offline / error / content wrapper for a
 * query, so every data view handles the same states consistently.
 */
export function QueryState({
  isLoading,
  isError,
  error,
  onRetry,
  skeleton,
  loadingLabel = "Loading…",
  errorLabel = "Something went wrong loading this data.",
  slowAfterMs = 6000,
  children,
}: QueryStateProps) {
  const online = useOnlineStatus();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {skeleton ?? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingLabel}
          </div>
        )}
        <SlowHint afterMs={slowAfterMs} />
      </div>
    );
  }

  if (isError) {
    const network = isNetworkError(error, online);
    const Icon = network ? WifiOff : AlertTriangle;
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-12 text-center">
        <Icon
          className={network ? "h-8 w-8 text-muted-foreground" : "h-8 w-8 text-status-error"}
        />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">
            {network ? "You're offline" : "Couldn't load"}
          </p>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {network
              ? "Check your connection and try again."
              : error instanceof ApiError
                ? error.message
                : errorLabel}
          </p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Shows a "slow connection" hint after a delay. Mounts only while a query
 * is loading, so it resets on each load and only sets state in an async
 * timeout callback.
 */
function SlowHint({ afterMs }: { afterMs: number }) {
  const [slow, setSlow] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setSlow(true), afterMs);
    return () => clearTimeout(timer);
  }, [afterMs]);

  if (!slow) return null;
  return (
    <p className="text-center text-xs text-muted-foreground">
      Still loading — your connection looks slow.
    </p>
  );
}
