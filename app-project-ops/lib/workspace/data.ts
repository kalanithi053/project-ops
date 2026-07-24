"use client";

import * as React from "react";

/**
 * Per-workspace data (projects, members, activity feed).
 *
 * There's no backend yet, so everything is persisted in localStorage,
 * namespaced by workspace slug, and exposed through the
 * `useWorkspaceData` hook. Replace the read/write helpers with real API
 * calls once the backend exists — the hook's shape can stay the same.
 */

export type TeamName = "HubSpot" | "Dev Team";

export const TEAMS: TeamName[] = ["HubSpot", "Dev Team"];

export interface Project {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  team: TeamName;
  createdAt: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  team: TeamName;
  addedAt: string;
}

export type ActivityType = "project" | "member" | "workspace";

export interface Activity {
  id: string;
  type: ActivityType;
  message: string;
  at: string;
}

function keyFor(slug: string, collection: string) {
  return `projectops.ws.${slug}.${collection}`;
}

function read<T>(slug: string, collection: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(keyFor(slug, collection));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(slug: string, collection: string, items: T[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(slug, collection), JSON.stringify(items));
  } catch {
    // Ignore quota / serialization failures — non-critical for the demo.
  }
}

export interface NewProject {
  name: string;
  startDate: string;
  endDate: string;
  team: TeamName;
}

export interface NewMember {
  name: string;
  email: string;
  role: string;
  team: TeamName;
}

export interface WorkspaceData {
  projects: Project[];
  members: Member[];
  activities: Activity[];
  addProject: (input: NewProject) => Project;
  addMember: (input: NewMember) => Member;
}

/**
 * Reactive access to a workspace's data. Seeds state from localStorage
 * on mount, and keeps localStorage in sync as items are added.
 */
export function useWorkspaceData(slug: string): WorkspaceData {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [activities, setActivities] = React.useState<Activity[]>([]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load from localStorage per slug
    setProjects(read<Project>(slug, "projects"));
    setMembers(read<Member>(slug, "members"));
    setActivities(read<Activity>(slug, "activities"));
  }, [slug]);

  const logActivity = React.useCallback(
    (type: ActivityType, message: string) => {
      setActivities((prev) => {
        const next = [
          { id: `act_${Date.now()}`, type, message, at: new Date().toISOString() },
          ...prev,
        ];
        write(slug, "activities", next);
        return next;
      });
    },
    [slug],
  );

  const addProject = React.useCallback(
    (input: NewProject) => {
      const project: Project = {
        id: `prj_${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...input,
      };
      setProjects((prev) => {
        const next = [project, ...prev];
        write(slug, "projects", next);
        return next;
      });
      logActivity("project", `Created project “${project.name}” for ${project.team}`);
      return project;
    },
    [slug, logActivity],
  );

  const addMember = React.useCallback(
    (input: NewMember) => {
      const member: Member = {
        id: `mem_${Date.now()}`,
        addedAt: new Date().toISOString(),
        ...input,
      };
      setMembers((prev) => {
        const next = [member, ...prev];
        write(slug, "members", next);
        return next;
      });
      logActivity("member", `Added ${member.name} to ${member.team}`);
      return member;
    },
    [slug, logActivity],
  );

  return { projects, members, activities, addProject, addMember };
}
