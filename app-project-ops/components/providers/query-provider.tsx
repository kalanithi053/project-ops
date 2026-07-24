"use client";

import * as React from "react";
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { ApiError } from "@/lib/api/client";
import { toast } from "@/lib/toast/toast-store";

/**
 * App-wide TanStack Query provider. The client is created once per
 * browser session (useState) so it survives re-renders but never leaks
 * between requests during SSR.
 *
 * A global MutationCache surfaces every failed action as an error toast,
 * unless the mutation opts out with `meta.suppressErrorToast` (e.g. auth
 * screens that render the error inline). Success toasts are fired by the
 * individual mutation hooks where a message makes sense.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onError: (error, _vars, _ctx, mutation) => {
            if (mutation.meta?.suppressErrorToast) return;
            const message =
              error instanceof ApiError || error instanceof Error
                ? error.message
                : "Something went wrong.";
            toast.error("Action failed", message);
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error) => {
              // Don't retry auth / not-found / permission errors.
              if (error instanceof ApiError) {
                if ([400, 401, 403, 404].includes(error.statusCode)) return false;
              }
              return failureCount < 2;
            },
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
