import { StatusCategory } from '@prisma/client';

/**
 * Default module catalog (HubSpot implementation modules). Seeded per plan;
 * `isDefault` modules are auto-attached to new projects with seed tasks.
 */
export const DEFAULT_MODULES: Array<{
  key: string;
  name: string;
  defaultTaskLimit: number;
  isDefault: boolean;
}> = [
  {
    key: 'pipelines',
    name: 'Pipelines',
    defaultTaskLimit: 10,
    isDefault: true,
  },
  {
    key: 'custom_properties',
    name: 'Custom Properties',
    defaultTaskLimit: 20,
    isDefault: true,
  },
  {
    key: 'workflows',
    name: 'Workflows',
    defaultTaskLimit: 15,
    isDefault: true,
  },
  { key: 'forms', name: 'Forms', defaultTaskLimit: 10, isDefault: false },
  {
    key: 'email_templates',
    name: 'Email Templates',
    defaultTaskLimit: 10,
    isDefault: false,
  },
  {
    key: 'landing_pages',
    name: 'Landing Pages',
    defaultTaskLimit: 10,
    isDefault: false,
  },
  {
    key: 'reports_dashboards',
    name: 'Reports & Dashboards',
    defaultTaskLimit: 10,
    isDefault: false,
  },
  {
    key: 'custom_objects',
    name: 'Custom Objects',
    defaultTaskLimit: 10,
    isDefault: false,
  },
  {
    key: 'integrations',
    name: 'Integrations',
    defaultTaskLimit: 5,
    isDefault: false,
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
    name: 'New',
    color: '#e4f468ff',
    order: 0,
    isDefault: true,
    category: 'todo',
  },
  {
    name: 'Open',
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

/** Default priority list for a new workspace. */
export const DEFAULT_PRIORITIES: Array<{
  name: string;
  color: string;
  order: number;
  isDefault: boolean;
}> = [
  { name: 'Low', color: '#94a3b8', order: 0, isDefault: false },
  { name: 'Medium', color: '#3b82f6', order: 1, isDefault: true },
  { name: 'High', color: '#f59e0b', order: 2, isDefault: false },
  { name: 'Urgent', color: '#ef4444', order: 3, isDefault: false },
];

/**
 * Default project types for a new workspace. `isPlanAdd` controls whether
 * creating a project of this type provisions plan modules + seed tasks. The
 * seeded plans (Professional/Ultimate/Enterprise) belong to the first isPlanAdd
 * type.
 */
export const DEFAULT_PROJECT_TYPES: Array<{
  name: string;
  description: string;
  isPlanAdd: boolean;
}> = [
  {
    name: 'HubSpot',
    description:
      'Full setup — provisions the active plan modules and seed tasks',
    isPlanAdd: true,
  },
  {
    name: 'Development',
    description: 'Empty project — no modules or seed tasks',
    isPlanAdd: false,
  },
];

export interface PlanTemplate {
  name: string;
  features: Record<string, unknown>;
  isActive: boolean;
}

const SHARED_PLAN_FEATURES: Record<string, unknown> = {
  customTicketStatuses: true,
  customRoles: true,
};

/** Plan catalog provisioned for every workspace. */
export const PLAN_TEMPLATES: PlanTemplate[] = [
  { name: 'Professional', features: SHARED_PLAN_FEATURES, isActive: true },
  { name: 'Ultimate', features: SHARED_PLAN_FEATURES, isActive: true },
  { name: 'Enterprise', features: SHARED_PLAN_FEATURES, isActive: true },
];
