"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import {
  useCompleteProductTour,
  useCompleteProjectOverviewTour,
  useMe,
} from "@/lib/api/hooks/use-users";
import { useTourStore } from "@/lib/store/tour-store";
import {
  ONBOARDING_TOUR_ID,
  PROJECT_OVERVIEW_TOUR_ID,
  TOURS,
} from "@/lib/tour/tour-config";
import { TourOverlay } from "@/components/tour/tour-overlay";

const AUTO_START_DELAY_MS = 700;

function useTourStoreHydrated() {
  const [hydrated, setHydrated] = React.useState(() => useTourStore.persist.hasHydrated());

  React.useEffect(() => {
    // Re-check (not just trust the lazy initializer) in case hydration
    // finished in the gap between that initial render and this effect —
    // subscribing to onFinishHydration alone would miss that window.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!hydrated && useTourStore.persist.hasHydrated()) setHydrated(true);
    return useTourStore.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);

  return hydrated;
}

/** True on `/{workspace}/projects/{projectId}` exactly — not a sub-route like `/work-items`. */
function isProjectOverviewPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 3 && segments[1] === "projects";
}

/**
 * Mounts the tour engine for both the onboarding tour and the project-overview
 * tour. Auto-starts each one exactly once for a user who hasn't completed it
 * yet, and renders the coach-mark overlay whenever either is running. Also
 * exposes itself to `lib/store/tour-store.ts`'s `tour.start(...)` facade, used
 * by the "Replay product tour" menu item.
 */
export function TourProvider() {
  const { data: me } = useMe();
  const pathname = usePathname();
  const completeOnboarding = useCompleteProductTour();
  const completeProjectOverview = useCompleteProjectOverviewTour();
  const hydrated = useTourStoreHydrated();

  const activeTourId = useTourStore((state) => state.activeTourId);
  const stepIndex = useTourStore((state) => state.stepIndex);
  const status = useTourStore((state) => state.status);
  const start = useTourStore((state) => state.start);
  const advance = useTourStore((state) => state.advance);
  const back = useTourStore((state) => state.back);
  const skip = useTourStore((state) => state.skip);

  const onboardingAutoStartedRef = React.useRef(false);
  const projectOverviewAutoStartedRef = React.useRef(false);

  React.useEffect(() => {
    if (onboardingAutoStartedRef.current || !hydrated || !me) return;
    onboardingAutoStartedRef.current = true;
    if (!me.isTourDone && status === "idle") {
      const timer = setTimeout(() => start(ONBOARDING_TOUR_ID), AUTO_START_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [hydrated, me, status, start]);

  React.useEffect(() => {
    if (projectOverviewAutoStartedRef.current || !hydrated || !me) return;
    if (!isProjectOverviewPath(pathname)) return;
    projectOverviewAutoStartedRef.current = true;
    if (!me.isProjectOverviewTourDone && status === "idle") {
      const timer = setTimeout(() => start(PROJECT_OVERVIEW_TOUR_ID), AUTO_START_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [hydrated, me, status, pathname, start]);

  // Persist completion exactly once, whenever a running tour ends (finished or skipped)
  // — a single seam instead of duplicating the mutate() call at each call site.
  const wasRunningRef = React.useRef(false);
  const lastTourIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (status === "running") {
      wasRunningRef.current = true;
      lastTourIdRef.current = activeTourId;
    } else if (wasRunningRef.current) {
      wasRunningRef.current = false;
      if (lastTourIdRef.current === PROJECT_OVERVIEW_TOUR_ID) {
        if (!completeProjectOverview.isPending) completeProjectOverview.mutate();
      } else if (!completeOnboarding.isPending) {
        completeOnboarding.mutate();
      }
    }
    // completeOnboarding/completeProjectOverview identity changes every render; only status matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, activeTourId]);

  if (status !== "running" || !activeTourId) {
    return null;
  }

  const steps = TOURS[activeTourId];
  const step = steps?.[stepIndex];
  if (!step) return null;

  const workspaceSlug = pathname.split("/").filter(Boolean)[0];

  return (
    <TourOverlay
      step={step}
      stepIndex={stepIndex}
      stepCount={steps.length}
      workspaceSlug={workspaceSlug}
      onNext={() => advance(steps.length)}
      onBack={back}
      onSkip={skip}
    />
  );
}
