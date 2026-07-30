"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { useCompleteProductTour, useMe } from "@/lib/api/hooks/use-users";
import { useTourStore } from "@/lib/store/tour-store";
import { ONBOARDING_TOUR_ID, onboardingTour } from "@/lib/tour/tour-config";
import { TourOverlay } from "@/components/tour/tour-overlay";

const AUTO_START_DELAY_MS = 700;

function useTourStoreHydrated() {
  const [hydrated, setHydrated] = React.useState(() => useTourStore.persist.hasHydrated());

  React.useEffect(() => {
    setHydrated(useTourStore.persist.hasHydrated());
    return useTourStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
}

/**
 * Mounts the onboarding tour engine. Auto-starts the tour once for a user
 * who hasn't completed it yet (`Me.productTourCompletedAt` is null), and
 * renders the coach-mark overlay whenever a tour is running. Also exposes
 * itself to `lib/store/tour-store.ts`'s `tour.start(...)` facade, used by
 * the "Replay product tour" menu item.
 */
export function TourProvider() {
  const { data: me } = useMe();
  const pathname = usePathname();
  const completeTour = useCompleteProductTour();
  const hydrated = useTourStoreHydrated();

  const activeTourId = useTourStore((state) => state.activeTourId);
  const stepIndex = useTourStore((state) => state.stepIndex);
  const status = useTourStore((state) => state.status);
  const start = useTourStore((state) => state.start);
  const advance = useTourStore((state) => state.advance);
  const back = useTourStore((state) => state.back);
  const skip = useTourStore((state) => state.skip);

  const autoStartedRef = React.useRef(false);

  React.useEffect(() => {
    if (autoStartedRef.current || !hydrated || !me) return;
    autoStartedRef.current = true;
    if (!me.productTourCompletedAt && status === "idle") {
      const timer = setTimeout(() => start(ONBOARDING_TOUR_ID), AUTO_START_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [hydrated, me, status, start]);

  // Persist completion exactly once, whenever a running tour ends (finished or skipped)
  // — a single seam instead of duplicating the mutate() call at each call site.
  const wasRunningRef = React.useRef(false);
  React.useEffect(() => {
    if (status === "running") {
      wasRunningRef.current = true;
    } else if (wasRunningRef.current) {
      wasRunningRef.current = false;
      if (!completeTour.isPending) completeTour.mutate();
    }
    // completeTour identity changes every render (new mutation object); only status matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (status !== "running" || activeTourId !== ONBOARDING_TOUR_ID) {
    return null;
  }

  const steps = onboardingTour;
  const step = steps[stepIndex];
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
