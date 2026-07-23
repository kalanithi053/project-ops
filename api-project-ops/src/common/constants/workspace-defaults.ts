import { StatusCategory } from '@prisma/client';

/** Default modules attached to every new workspace (and auto-added to projects). */
export const DEFAULT_MODULES: Array<{
  key: string;
  name: string;
  defaultTaskLimit: number;
  isDefault: boolean;
}> = [
  { key: 'pipeline', name: 'Pipeline', defaultTaskLimit: 10, isDefault: true },
  {
    key: 'custom_properties',
    name: 'Custom Properties',
    defaultTaskLimit: 20,
    isDefault: true,
  },
];

/** Default ticket status pipeline for a new workspace. */
export const DEFAULT_TICKET_STATUSES: Array<{
  name: string;
  color: string;
  order: number;
  isDefault: boolean;
  category: StatusCategory;
}> = [
  {
    name: 'Backlog',
    color: '#94a3b8',
    order: 0,
    isDefault: true,
    category: 'todo',
  },
  {
    name: 'In Progress',
    color: '#3b82f6',
    order: 1,
    isDefault: false,
    category: 'in_progress',
  },
  {
    name: 'Ready for QA',
    color: '#f59e0b',
    order: 2,
    isDefault: false,
    category: 'ready_qa',
  },
  {
    name: 'Review',
    color: '#3b82f6',
    order: 3,
    isDefault: false,
    category: 'review',
  },
  {
    name: 'Done',
    color: '#22c55e',
    order: 4,
    isDefault: false,
    category: 'done',
  },
];

export interface PlanTemplate {
  name: string;
  maxProjects: number;
  maxMembers: number;
  maxTasksPerModule: number;
  features: Record<string, unknown>;
  /** Exactly one template is the default (active) plan for a new workspace. */
  isActive: boolean;
}

const SHARED_PLAN_FEATURES: Record<string, unknown> = {
  maxModules: 100,
  customTicketStatuses: true,
  customRoles: true,
};

/**
 * Plan catalog provisioned for every workspace. All three tiers are created as
 * Plan rows; exactly one (Professional) starts active. Switch tiers by
 * activating another via POST /plans/:planId/activate.
 *
 * Limits are identical across tiers for now (100/100/100) — adjust per-tier here.
 */
export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    name: 'Professional',
    maxProjects: 100,
    maxMembers: 100,
    maxTasksPerModule: 100,
    features: SHARED_PLAN_FEATURES,
    isActive: true,
  },
  {
    name: 'Ultimate',
    maxProjects: 100,
    maxMembers: 100,
    maxTasksPerModule: 100,
    features: SHARED_PLAN_FEATURES,
    isActive: true,
  },
  {
    name: 'Enterprise',
    maxProjects: 100,
    maxMembers: 100,
    maxTasksPerModule: 100,
    features: SHARED_PLAN_FEATURES,
    isActive: true,
  },
];
