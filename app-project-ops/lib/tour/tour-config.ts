export type TourPlacement = "top" | "bottom" | "left" | "right";

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** `data-tour` value of the element to spotlight; omitted for the centered intro/outro cards. */
  selector?: string;
  /** Workspace-relative path to navigate to before this step, if the target isn't on the current page. */
  route?: string;
  /** Preferred side for the coach-mark card; flipped automatically if it would overflow the viewport. */
  placement?: TourPlacement;
}

export const ONBOARDING_TOUR_ID = "onboarding";

/**
 * The default "getting started" walkthrough. Deliberately confined to
 * elements that exist regardless of workspace data (nav, header controls),
 * so it works the same for a brand-new empty workspace as a busy one.
 */
export const onboardingTour: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to ProjectOps",
    body: "Take a two-minute look at where everything lives before you dive in.",
  },
  {
    id: "nav-dashboard",
    title: "Your dashboard",
    body: "Home base — a snapshot of what's happening across your workspace.",
    selector: "nav-dashboard",
    placement: "right",
  },
  {
    id: "nav-projects",
    title: "Projects",
    body: "Every initiative your team is running lives here, organized and easy to jump into.",
    selector: "nav-projects",
    placement: "right",
  },
  {
    id: "new-project",
    title: "Create a project in seconds",
    body: "Spin up a new project any time with this button.",
    selector: "new-project-button",
    route: "/projects",
    placement: "left",
  },
  {
    id: "nav-reports",
    title: "Reports",
    body: "Track progress and spot bottlenecks with built-in reporting.",
    selector: "nav-reports",
    placement: "right",
  },
  {
    id: "nav-users",
    title: "People",
    body: "See everyone in your workspace and what they're working on.",
    selector: "nav-users",
    placement: "right",
  },
  {
    id: "nav-settings",
    title: "Settings",
    body: "Configure roles, statuses, priorities, and plans for your workspace here.",
    selector: "nav-settings",
    placement: "right",
  },
  {
    id: "workspace-switcher",
    title: "Switch workspaces anytime",
    body: "Jump between workspaces you belong to, or manage them, right from the header.",
    selector: "workspace-switcher",
    placement: "bottom",
  },
  {
    id: "notifications",
    title: "Stay in the loop",
    body: "Mentions, assignments, and updates land here as they happen.",
    selector: "notifications-bell",
    placement: "bottom",
  },
  {
    id: "user-menu",
    title: "Your account",
    body: "Update your profile and preferences — and replay this tour anytime from here.",
    selector: "user-menu",
    placement: "bottom",
  },
  {
    id: "finish",
    title: "You're all set",
    body: "That's the tour! Jump in and start building.",
  },
];
