/**
 * Permissions constants — séparées de AuthContext pour éviter le warning HMR Vite
 * (un fichier ne doit pas mélanger exports React et exports non-React)
 */

export interface Permission {
  id: string;
  label: string;
  description: string;
  category: 'data' | 'analytics' | 'sales' | 'system';
}

export const AVAILABLE_PERMISSIONS: Permission[] = [
  { id: 'import-data',           label: 'Import Data',              description: 'Import Excel files into the database',       category: 'data' },
  { id: 'export-data',           label: 'Export Data',              description: 'Export data to Excel/CSV files',             category: 'data' },
  { id: 'view-dashboard',        label: 'View Dashboard',           description: 'Access main dashboard with KPIs',            category: 'analytics' },
  { id: 'view-reports',          label: 'View Reports',             description: 'Access and view all reports',                category: 'analytics' },
  { id: 'generate-reports',      label: 'Generate Reports',         description: 'Create and generate custom reports',         category: 'analytics' },
  { id: 'view-kpi',              label: 'View KPIs',                description: 'Access KPI Engine and metrics',              category: 'analytics' },
  { id: 'filter-dashboard',      label: 'Filter Dashboard',         description: 'Apply filters to dashboard data',            category: 'analytics' },
  { id: 'view-sales',            label: 'View Sales',               description: 'Access sales and purchases data',            category: 'sales' },
  { id: 'view-inventory',        label: 'View Inventory',           description: 'Check product availability and stock levels', category: 'sales' },
  { id: 'view-customer-payments',label: 'View Customer Payments',   description: 'Access customer payment history',            category: 'sales' },
  { id: 'view-aging',            label: 'View Aging Receivables',   description: 'Track overdue payments and receivables',     category: 'sales' },
  { id: 'receive-notifications', label: 'Receive Notifications',    description: 'Get notified about important events',        category: 'system' },
  { id: 'manage-alerts',         label: 'Manage Alerts',            description: 'Mark alerts as resolved',                   category: 'system' },
  { id: 'view-profile',          label: 'View Profile',             description: 'Access personal profile',                   category: 'system' },
  { id: 'change-password',       label: 'Change Password',          description: 'Update account password',                   category: 'system' },
  { id: 'ai-insights',           label: 'AI Insights',              description: 'Access AI-powered insights and chat',        category: 'analytics' },
];

export const DEFAULT_AGENT_PERMISSIONS: string[] = [
  'import-data',
  'view-dashboard',
  'view-reports',
  'generate-reports',
  'view-kpi',
  'filter-dashboard',
  'view-sales',
  'view-inventory',
  'view-customer-payments',
  'receive-notifications',
  'manage-alerts',
  'view-profile',
  'change-password',
];

export const DEFAULT_MANAGER_PERMISSIONS: string[] = AVAILABLE_PERMISSIONS.map(p => p.id);