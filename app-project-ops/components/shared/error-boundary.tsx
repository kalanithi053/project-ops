"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
  /** Optional custom fallback renderer. */
  fallback?: (reset: () => void) => React.ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Component-level error boundary. Catches render/runtime errors in the
 * subtree and shows a recoverable fallback, so one broken module doesn't
 * take down the whole shell. Route-level errors are still handled by
 * Next's `app/error.tsx`.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Replace with real error reporting (Sentry, etc.) once available.
    console.error(error);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.reset);

    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-status-error" />
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">Something went wrong</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            This section failed to render. Try again.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={this.reset}>
          Try again
        </Button>
      </div>
    );
  }
}
