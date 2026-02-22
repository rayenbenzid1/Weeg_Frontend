/**
 * FASI Data API Services
 * All data-related API calls (products, sales, inventory, KPI, alerts, aging, reports, AI)
 * Each service maps to Django app endpoints.
 */

import { api } from './api';

// ─────────────────────────────────────────────
// Generic pagination wrapper (DRF default)
// ─────────────────────────────────────────────

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface QueryParams {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
  [key: string]: unknown;
}

function buildQueryString(params?: QueryParams): string {
  if (!params) return '';
  const filtered = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (!filtered.length) return '';
  return '?' + new URLSearchParams(
    filtered.map(([k, v]) => [k, String(v)])
  ).toString();
}

// ─────────────────────────────────────────────
// Products
// ─────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  purchase_price: number;
  sale_price: number;
  current_stock: number;
  min_stock: number;
  max_stock: number;
}

export const productsApi = {
  list: (params?: QueryParams) =>
    api.get<PaginatedResponse<Product>>(`/products/${buildQueryString(params)}`),

  get: (id: string) =>
    api.get<Product>(`/products/${id}/`),
};

// ─────────────────────────────────────────────
// Branches
// ─────────────────────────────────────────────

export interface Branch {
  id: string;
  name: string;
  location: string;
}

export const branchesApi = {
  list: () => api.get<PaginatedResponse<Branch>>('/branches/'),
  get: (id: string) => api.get<Branch>(`/branches/${id}/`),
};

// ─────────────────────────────────────────────
// Customers
// ─────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  credit_limit: number;
  risk_score: number;
}

export const customersApi = {
  list: (params?: QueryParams) =>
    api.get<PaginatedResponse<Customer>>(`/customers/${buildQueryString(params)}`),

  get: (id: string) =>
    api.get<Customer>(`/customers/${id}/`),
};

// ─────────────────────────────────────────────
// Transactions (Sales + Purchases)
// ─────────────────────────────────────────────

export interface Sale {
  id: string;
  invoice_number: string;
  date: string;
  product: string;
  product_name: string;
  branch: string;
  branch_name: string;
  customer: string;
  customer_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Purchase {
  id: string;
  invoice_number: string;
  date: string;
  product: string;
  product_name: string;
  branch: string;
  branch_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export const transactionsApi = {
  listSales: (params?: QueryParams) =>
    api.get<PaginatedResponse<Sale>>(`/transactions/sales/${buildQueryString(params)}`),

  listPurchases: (params?: QueryParams) =>
    api.get<PaginatedResponse<Purchase>>(`/transactions/purchases/${buildQueryString(params)}`),

  getSale: (id: string) =>
    api.get<Sale>(`/transactions/sales/${id}/`),

  getPurchase: (id: string) =>
    api.get<Purchase>(`/transactions/purchases/${id}/`),
};

// ─────────────────────────────────────────────
// Inventory
// ─────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  product: string;
  product_name: string;
  branch: string;
  branch_name: string;
  quantity: number;
  last_updated: string;
}

export const inventoryApi = {
  list: (params?: QueryParams) =>
    api.get<PaginatedResponse<InventoryItem>>(`/inventory/${buildQueryString(params)}`),
};

// ─────────────────────────────────────────────
// KPI
// ─────────────────────────────────────────────

export interface KPIData {
  total_invoices: number;
  total_purchases: number;
  total_sales: number;
  stock_value: number;
  total_receivables: number;
  total_revenue: number;
  total_margin: number;
  risk_level: number;
}

export interface MonthlySalesData {
  month: string;
  sales: number;
  purchases: number;
}

export interface AgingDistribution {
  name: string;
  value: number;
  fill: string;
}

export interface TopProduct {
  product_id: string;
  product_name: string;
  total: number;
}

export interface BranchPerformance {
  branch: string;
  sales: number;
  stock: number;
}

export const kpiApi = {
  getKPIs: (params?: { branch?: string; date_from?: string; date_to?: string }) =>
    api.get<KPIData>(`/kpi/summary/${buildQueryString(params)}`),

  getMonthlySales: (params?: { months?: number }) =>
    api.get<MonthlySalesData[]>(`/kpi/monthly-sales/${buildQueryString(params)}`),

  getAgingDistribution: () =>
    api.get<AgingDistribution[]>('/kpi/aging-distribution/'),

  getTopProducts: (params?: { limit?: number }) =>
    api.get<TopProduct[]>(`/kpi/top-products/${buildQueryString(params)}`),

  getBranchPerformance: () =>
    api.get<BranchPerformance[]>('/kpi/branch-performance/'),
};

// ─────────────────────────────────────────────
// Alerts
// ─────────────────────────────────────────────

export interface Alert {
  id: string;
  type: 'low_stock' | 'high_sales' | 'risk' | 'overdue' | 'sales_drop' | 'exchange_rate' | 'seasonal';
  severity: 'low' | 'medium' | 'critical';
  product_id?: string;
  branch_id?: string;
  customer_id?: string;
  message: string;
  date: string;
  days_active: number;
  status: 'pending' | 'resolved';
  ai_explanation?: string;
}

export const alertsApi = {
  list: (params?: QueryParams & { status?: string; severity?: string }) =>
    api.get<PaginatedResponse<Alert>>(`/alerts/${buildQueryString(params)}`),

  resolve: (id: string) =>
    api.patch<{ message: string }>(`/alerts/${id}/resolve/`),

  markAllResolved: () =>
    api.post<{ message: string }>('/alerts/resolve-all/'),
};

// ─────────────────────────────────────────────
// Aging Receivables
// ─────────────────────────────────────────────

export interface AgingReceivable {
  id: string;
  customer: string;
  customer_name: string;
  branch: string;
  branch_name: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  remaining_balance: number;
  days_overdue: number;
}

export const agingApi = {
  list: (params?: QueryParams & { customer?: string; min_days?: number }) =>
    api.get<PaginatedResponse<AgingReceivable>>(`/aging/${buildQueryString(params)}`),

  getTopRisky: () =>
    api.get<{ customer_id: string; customer_name: string; total_overdue: number; days_overdue: number; risk_score: number }[]>(
      '/aging/top-risky/'
    ),
};

// ─────────────────────────────────────────────
// Reports
// ─────────────────────────────────────────────

export interface ReportFilters extends QueryParams {
  date_from?: string;
  date_to?: string;
  branch?: string;
  product?: string;
  customer?: string;
  format?: 'json' | 'csv' | 'excel';
}

export const reportsApi = {
  getSalesReport: (filters?: ReportFilters) =>
    api.get<{ data: Sale[]; summary: Record<string, number> }>(
      `/reports/sales/${buildQueryString(filters)}`
    ),

  getPurchasesReport: (filters?: ReportFilters) =>
    api.get<{ data: Purchase[]; summary: Record<string, number> }>(
      `/reports/purchases/${buildQueryString(filters)}`
    ),

  getInventoryReport: (filters?: ReportFilters) =>
    api.get<{ data: InventoryItem[] }>(`/reports/inventory/${buildQueryString(filters)}`),

  exportSales: async (filters?: ReportFilters) => {
    const params = { ...filters, format: 'excel' as const };
    const blob = await fetch(`/api/reports/sales/export/${buildQueryString(params)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('fasi_access_token')}` },
    }).then(r => r.blob());
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales-report.xlsx';
    a.click();
  },
};

// ─────────────────────────────────────────────
// AI Insights
// ─────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIInsightResponse {
  message: string;
  data?: Record<string, unknown>;
  suggestions?: string[];
}

export const aiApi = {
  chat: (messages: ChatMessage[]) =>
    api.post<AIInsightResponse>('/ai-insights/chat/', { messages }),

  getSummary: () =>
    api.get<{ summary: string; key_insights: string[]; recommendations: string[] }>(
      '/ai-insights/summary/'
    ),

  getPredictions: () =>
    api.get<{ predictions: Record<string, unknown>[] }>('/ai-insights/predictions/'),
};

// ─────────────────────────────────────────────
// Data Import
// ─────────────────────────────────────────────

export interface ImportResult {
  success: boolean;
  rows_imported: number;
  rows_failed: number;
  errors: string[];
  message: string;
}

export const dataImportApi = {
  uploadFile: async (file: File, type: 'sales' | 'purchases' | 'inventory' | 'customers'): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const token = localStorage.getItem('fasi_access_token');
    const response = await fetch('/api/data-import/upload/', {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Import failed');
    }

    return response.json();
  },

  getTemplate: async (type: string) => {
    const token = localStorage.getItem('fasi_access_token');
    const response = await fetch(`/api/data-import/template/${type}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-template.xlsx`;
    a.click();
  },
};