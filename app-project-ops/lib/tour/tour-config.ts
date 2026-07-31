import {
  BarChart3,
  Bell,
  Building2,
  FolderKanban,
  Layers,
  LayoutDashboard,
  ListChecks,
  Plus,
  Settings,
  Sparkles,
  Users,
  UserCircle,
  type LucideIcon,
} from "lucide-react";

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
  /** Icon shown in the card's badge. Defaults to a generic sparkle if omitted. */
  icon?: LucideIcon;
}

export const ONBOARDING_TOUR_ID = "onboarding";
export const PROJECT_OVERVIEW_TOUR_ID = "project-overview";

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
    icon: Sparkles,
  },
  {
    id: "nav-dashboard",
    title: "Your dashboard",
    body: "Home base — a snapshot of what's happening across your workspace.",
    selector: "nav-dashboard",
    placement: "right",
    icon: LayoutDashboard,
  },
  {
    id: "nav-projects",
    title: "Projects",
    body: "Every initiative your team is running lives here, organized and easy to jump into.",
    selector: "nav-projects",
    placement: "right",
    icon: FolderKanban,
  },
  {
    id: "new-project",
    title: "Create a project in seconds",
    body: "Spin up a new project any time with this button.",
    selector: "new-project-button",
    route: "/projects",
    placement: "left",
    icon: Plus,
  },
  {
    id: "nav-reports",
    title: "Reports",
    body: "Track progress and spot bottlenecks with built-in reporting.",
    selector: "nav-reports",
    placement: "right",
    icon: BarChart3,
  },
  {
    id: "nav-users",
    title: "People",
    body: "See everyone in your workspace and what they're working on.",
    selector: "nav-users",
    placement: "right",
    icon: Users,
  },
  {
    id: "nav-settings",
    title: "Settings",
    body: "Configure roles, statuses, priorities, and plans for your workspace here.",
    selector: "nav-settings",
    placement: "right",
    icon: Settings,
  },
  {
    id: "workspace-switcher",
    title: "Switch workspaces anytime",
    body: "Jump between workspaces you belong to, or manage them, right from the header.",
    selector: "workspace-switcher",
    placement: "bottom",
    icon: Building2,
  },
  {
    id: "notifications",
    title: "Stay in the loop",
    body: "Mentions, assignments, and updates land here as they happen.",
    selector: "notifications-bell",
    placement: "bottom",
    icon: Bell,
  },
  {
    id: "user-menu",
    title: "Your account",
    body: "Update your profile and preferences — and replay this tour anytime from here.",
    selector: "user-menu",
    placement: "bottom",
    icon: UserCircle,
  },
  {
    id: "finish",
    title: "You're all set",
    body: "That's the tour! Jump in and start building.",
    icon: Sparkles,
  },
];

/**
 * A short walkthrough of a single project's overview page. Auto-starts the
 * first time a user lands on `/{workspace}/projects/{projectId}` — which
 * includes right after creating a project, since creation now navigates
 * there — and never needs a `route` since every step lives on that one page.
 */
export const projectOverviewTour: TourStep[] = [
  {
    id: "project-welcome",
    title: "Here's your project",
    body: "A quick look at what this overview page tells you at a glance.",
    icon: Sparkles,
  },
  {
    id: "project-stats",
    title: "Quick stats",
    body: "Work items, completion, modules, and team size — the four numbers that matter most.",
    selector: "project-stats",
    placement: "bottom",
    icon: ListChecks,
  },
  {
    id: "project-modules",
    title: "Module capacity",
    body: "How much of each module's task allowance this project has used.",
    selector: "project-module-capacity",
    placement: "right",
    icon: Layers,
  },
  {
    id: "project-status",
    title: "Work by status",
    body: "Where all the work currently sits in the workflow.",
    selector: "project-work-by-status",
    placement: "left",
    icon: ListChecks,
  },
  {
    id: "project-priority",
    title: "Priority by status",
    body: "Task counts broken down by priority and stage.",
    selector: "project-priority-by-status",
    placement: "right",
    icon: BarChart3,
  },
  {
    id: "project-workload",
    title: "Team workload",
    body: "Assigned work and logged effort for each project member.",
    selector: "project-team-workload",
    placement: "left",
    icon: Users,
  },
  {
    id: "project-activity",
    title: "Recent activity",
    body: "A running log of what's changed on this project lately.",
    selector: "project-recent-activity",
    placement: "top",
    icon: Sparkles,
  },
  {
    id: "project-finish",
    title: "You're ready to go",
    body: "Head into Work items to start filing tasks, bugs, and incidents.",
    icon: Sparkles,
  },
];

export const TOURS: Record<string, TourStep[]> = {
  [ONBOARDING_TOUR_ID]: onboardingTour,
  [PROJECT_OVERVIEW_TOUR_ID]: projectOverviewTour,
};
