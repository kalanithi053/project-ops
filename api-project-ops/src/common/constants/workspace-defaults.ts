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

/** Default "Free" plan provisioned for a new workspace. */
export const DEFAULT_PLAN = {
  name: 'Free',
  maxProjects: 3,
  maxMembers: 5,
  maxTasksPerModule: 10,
  features: {
    maxModules: 5,
    customTicketStatuses: true,
    customRoles: true,
  } as Record<string, unknown>,
  isActive: true,
};
