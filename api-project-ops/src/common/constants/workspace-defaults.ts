import { StatusCategory, WorkTypeCategory } from '@prisma/client';

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
  canDelete: boolean;
  category: StatusCategory;
}> = [
  {
    name: 'New',
    color: '#e4f468ff',
    order: 0,
    isDefault: true,
    canDelete: true,
    category: 'new',
  },
  {
    name: 'Open',
    color: '#94a3b8',
    order: 1,
    isDefault: false,
    canDelete: true,
    category: 'todo',
  },
  {
    name: 'In Progress',
    color: '#3b82f6',
    order: 2,
    isDefault: false,
    canDelete: true,
    category: 'in_progress',
  },
  {
    name: 'Ready for QA',
    color: '#f59e0b',
    order: 3,
    isDefault: false,
    canDelete: true,
    category: 'ready_qa',
  },
  {
    name: 'Review',
    color: '#3b82f6',
    order: 4,
    isDefault: false,
    canDelete: true,
    category: 'review',
  },
  {
    name: 'Done',
    color: '#22c55e',
    order: 5,
    isDefault: false,
    canDelete: true,
    category: 'done',
  },
  {
    name: 'Blocked',
    color: '#ef4444',
    order: 6,
    isDefault: false,
    canDelete: true,
    category: 'blocked',
  },
  {
    name: 'Removed',
    color: '#64748b',
    order: 7,
    isDefault: false,
    canDelete: false,
    category: 'removed',
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

/** Default work type catalog for a new workspace. */
export const DEFAULT_WORK_TYPES: Array<{
  name: string;
  color: string;
  category: WorkTypeCategory;
}> = [
  {
    name: 'Task',
    color: '#fde68a',
    category: 'task',
  },
  {
    name: 'Incident',
    color: '#3b82f6',
    category: 'incident',
  },
  {
    name: 'Bug',
    color: '#f43f5e',
    category: 'bug',
  },
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
  color: string;
}> = [
  {
    name: 'HubSpot',
    description:
      'Full setup — provisions the active plan modules and seed tasks',
    isPlanAdd: true,
    color: '#e4f468ff',
  },
  {
    name: 'Development',
    description: 'Empty project — no modules or seed tasks',
    isPlanAdd: false,
    color: '#fd0909',
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

interface HubModuleDef {
  key: string;
  name: string;
  defaultTaskLimit: number;
  isDefault: boolean;
}

/**
 * HubSpot's real product lines ("Hubs"), each with its own module catalog —
 * a static reference list (not a live HubSpot API integration). Each hub gets
 * a `Plan` row per `HUB_TIERS` tier (see `provisionHubCatalog` in
 * workspace-provisioning.ts), and that plan's modules come from here — the
 * same Plan -> Module -> seed-task pipeline `DEFAULT_MODULES` already uses.
 */
export const DEFAULT_HUBS: Array<{
  key: string;
  name: string;
  modules: HubModuleDef[];
}> = [
  {
    key: 'marketing_hub',
    name: 'Marketing Hub',
    modules: [
      { key: 'forms', name: 'Forms', defaultTaskLimit: 10, isDefault: true },
      {
        key: 'email_marketing',
        name: 'Email Marketing',
        defaultTaskLimit: 10,
        isDefault: true,
      },
      {
        key: 'landing_pages',
        name: 'Landing Pages',
        defaultTaskLimit: 10,
        isDefault: true,
      },
      {
        key: 'workflows',
        name: 'Workflows',
        defaultTaskLimit: 15,
        isDefault: false,
      },
      { key: 'ads', name: 'Ads', defaultTaskLimit: 5, isDefault: false },
      {
        key: 'campaigns',
        name: 'Campaigns',
        defaultTaskLimit: 5,
        isDefault: false,
      },
    ],
  },
  {
    key: 'sales_hub',
    name: 'Sales Hub',
    modules: [
      {
        key: 'pipelines',
        name: 'Pipelines',
        defaultTaskLimit: 10,
        isDefault: true,
      },
      {
        key: 'sequences',
        name: 'Sequences',
        defaultTaskLimit: 10,
        isDefault: true,
      },
      { key: 'quotes', name: 'Quotes', defaultTaskLimit: 5, isDefault: true },
      {
        key: 'playbooks',
        name: 'Playbooks',
        defaultTaskLimit: 5,
        isDefault: false,
      },
      {
        key: 'meetings',
        name: 'Meetings',
        defaultTaskLimit: 5,
        isDefault: false,
      },
      {
        key: 'deal_automation',
        name: 'Deal Automation',
        defaultTaskLimit: 10,
        isDefault: false,
      },
    ],
  },
  {
    key: 'service_hub',
    name: 'Service Hub',
    modules: [
      {
        key: 'ticket_pipelines',
        name: 'Ticket Pipelines',
        defaultTaskLimit: 10,
        isDefault: true,
      },
      {
        key: 'knowledge_base',
        name: 'Knowledge Base',
        defaultTaskLimit: 10,
        isDefault: true,
      },
      {
        key: 'feedback_surveys',
        name: 'Feedback Surveys',
        defaultTaskLimit: 5,
        isDefault: true,
      },
      {
        key: 'playbooks',
        name: 'Playbooks',
        defaultTaskLimit: 5,
        isDefault: false,
      },
      {
        key: 'live_chat',
        name: 'Live Chat',
        defaultTaskLimit: 5,
        isDefault: false,
      },
      { key: 'slas', name: 'SLAs', defaultTaskLimit: 5, isDefault: false },
    ],
  },
  {
    key: 'content_hub',
    name: 'Content Hub',
    modules: [
      {
        key: 'website_pages',
        name: 'Website Pages',
        defaultTaskLimit: 10,
        isDefault: true,
      },
      { key: 'blog', name: 'Blog', defaultTaskLimit: 10, isDefault: true },
      { key: 'seo', name: 'SEO', defaultTaskLimit: 10, isDefault: true },
      {
        key: 'themes',
        name: 'Themes',
        defaultTaskLimit: 5,
        isDefault: false,
      },
      {
        key: 'memberships',
        name: 'Memberships',
        defaultTaskLimit: 5,
        isDefault: false,
      },
      {
        key: 'dynamic_pages',
        name: 'Dynamic Pages',
        defaultTaskLimit: 5,
        isDefault: false,
      },
    ],
  },
  {
    key: 'operations_hub',
    name: 'Operations Hub',
    modules: [
      {
        key: 'data_sync',
        name: 'Data Sync',
        defaultTaskLimit: 10,
        isDefault: true,
      },
      {
        key: 'workflow_automation',
        name: 'Workflow Automation',
        defaultTaskLimit: 15,
        isDefault: true,
      },
      {
        key: 'data_quality_automation',
        name: 'Data Quality Automation',
        defaultTaskLimit: 10,
        isDefault: true,
      },
      {
        key: 'custom_properties',
        name: 'Custom Properties',
        defaultTaskLimit: 20,
        isDefault: false,
      },
      {
        key: 'datasets',
        name: 'Datasets',
        defaultTaskLimit: 5,
        isDefault: false,
      },
      {
        key: 'programmable_automation',
        name: 'Programmable Automation',
        defaultTaskLimit: 5,
        isDefault: false,
      },
    ],
  },
  {
    key: 'commerce_hub',
    name: 'Commerce Hub',
    modules: [
      {
        key: 'invoices',
        name: 'Invoices',
        defaultTaskLimit: 10,
        isDefault: true,
      },
      {
        key: 'payment_links',
        name: 'Payment Links',
        defaultTaskLimit: 5,
        isDefault: true,
      },
      {
        key: 'subscriptions',
        name: 'Subscriptions',
        defaultTaskLimit: 5,
        isDefault: true,
      },
      { key: 'quotes', name: 'Quotes', defaultTaskLimit: 5, isDefault: false },
      { key: 'carts', name: 'Carts', defaultTaskLimit: 5, isDefault: false },
      {
        key: 'discounts',
        name: 'Discounts',
        defaultTaskLimit: 5,
        isDefault: false,
      },
    ],
  },
];

/** Tiers seeded for every Hub — mirrors HubSpot's own tier naming. */
export const HUB_TIERS = ['Starter', 'Professional', 'Enterprise'] as const;

/**
 * Spacing between `WorkItem.position` values wherever rows are appended —
 * project seeding, single-item create, and the Kanban board's drag-and-drop
 * reorder all share this constant so a freshly-provisioned project's starter
 * tasks already have room between them, instead of every row defaulting to
 * the same value and forcing a full-column rebalance the first time any of
 * them is dragged.
 */
export const POSITION_GAP = 1000;

export function generateRandomId(length = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';

  for (let i = 0; i < length; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return id;
}
