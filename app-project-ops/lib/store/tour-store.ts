import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type TourStatus = "idle" | "running";

interface TourState {
  activeTourId: string | null;
  stepIndex: number;
  status: TourStatus;
  start: (tourId: string) => void;
  /** Advances one step, or ends the tour if already on the last of `stepCount`. Atomic w.r.t. React's render cycle. */
  advance: (stepCount: number) => void;
  back: () => void;
  skip: () => void;
}

/**
 * Transient "is a tour running, and at what step" UI state. Persisted to
 * sessionStorage (not localStorage, unlike theme-store.ts) so an in-progress
 * tour survives a page refresh but doesn't linger across browser sessions —
 * whether the tour has ever been *completed* is server state (see
 * `Me.productTourCompletedAt` / `useCompleteProductTour`), not this store.
 *
 * `advance`/`back` compute the next state from `get()` inside the setter
 * rather than trusting a caller-supplied index, so a rapid double-click
 * (before React re-renders with the new `stepIndex`) can't drop a step.
 */
export const useTourStore = create<TourState>()(
  persist(
    (set, get) => ({
      activeTourId: null,
      stepIndex: 0,
      status: "idle",
      start: (tourId) => set({ activeTourId: tourId, stepIndex: 0, status: "running" }),
      advance: (stepCount) => {
        const nextIndex = get().stepIndex + 1;
        if (nextIndex >= stepCount) {
          set({ activeTourId: null, stepIndex: 0, status: "idle" });
        } else {
          set({ stepIndex: nextIndex });
        }
      },
      back: () => set({ stepIndex: Math.max(0, get().stepIndex - 1) }),
      skip: () => set({ activeTourId: null, stepIndex: 0, status: "idle" }),
    }),
    {
      name: "projectops.tour",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

/** Imperative facade, mirrors `toast` in lib/toast/toast-store.ts. */
export const tour = {
  start: (tourId: string) => useTourStore.getState().start(tourId),
  skip: () => useTourStore.getState().skip(),
};
