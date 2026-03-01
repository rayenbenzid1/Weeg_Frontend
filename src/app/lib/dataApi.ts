// ─────────────────────────────────────────────
// Data Import (adapted to real backend endpoints)
// ─────────────────────────────────────────────
import { api } from './api';

export interface ImportLogEntry {
  id: string;
  file_type: string;
  original_filename: string;
  status: 'pending' | 'processing' | 'success' | 'partial' | 'failed';
  row_count: number;
  success_count: number;
  error_count: number;
  error_details: Array<{ row?: number; error: string }>;
  started_at: string;
  completed_at?: string | null;
  // Ajoute d'autres champs si besoin (company_name, imported_by_username, etc.)
}

export interface ImportResult {
  message: string;
  import_log: ImportLogEntry;
  result: {
    file_type: string;
    total_rows: number;
    created: number;
    updated: number;
    errors: string[];
  };
}

export interface DetectResult {
  filename: string;
  detected_file_type: string;
  headers: string[];
  preview_rows: Record<string, string>[];
  total_rows_estimate?: number | null;
}

export const dataImportApi = {
  /**
   * Upload Excel file + process import
   * POST /api/import/upload/
   */
  uploadFile: async (
    file: File,
    options: {
      file_type?: string;           // optional override
      snapshot_date?: string;       // YYYY-MM-DD
      report_date?: string;         // YYYY-MM-DD
      onProgress?: (progress: number) => void;
    } = {}
  ): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    if (options.file_type) formData.append('file_type', options.file_type);
    if (options.snapshot_date) formData.append('snapshot_date', options.snapshot_date);
    if (options.report_date) formData.append('report_date', options.report_date);

    const token = localStorage.getItem('fasi_access_token'); // ou ton nom de clé token

    const response = await fetch('/api/import/upload/', {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
      // Important : NE PAS mettre Content-Type manuellement → le navigateur le gère pour FormData
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: 'Network or server error' };
      }
      throw new Error(errorData.message || errorData.error || `Upload failed (${response.status})`);
    }

    return response.json();
  },

  /**
   * Detect file type + get preview (first rows)
   * POST /api/import/detect/
   */
  detectFile: async (file: File): Promise<DetectResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('fasi_access_token');

    const response = await fetch('/api/import/detect/', {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Detection failed');
    }

    return response.json();
  },

  /**
   * Get list of previous imports (logs)
   * GET /api/import/logs/
   */
  getImportLogs: async (params?: { file_type?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    const url = `/api/import/logs/${query ? `?${query}` : ''}`;

    const token = localStorage.getItem('fasi_access_token');
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error('Failed to fetch logs');
    return response.json(); // { count: number, logs: ImportLogEntry[] }
  },

  // Optionnel : Download template (si tu implémentes cet endpoint côté backend plus tard)
  downloadTemplate: async (type: string) => {
    // Exemple si tu ajoutes un endpoint /api/import/template/<type>/
    const token = localStorage.getItem('fasi_access_token');
    const response = await fetch(`/api/import/template/${type}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Template download failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-import-template.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

export interface PaginatedResponse<T> {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  [listKey: string]: any; // products | customers | items | movements | records
}

export interface QueryParams {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
  [key: string]: any;
}

function qs(params?: QueryParams): string {
  if (!params) return '';
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

// ─────────────────────────────────────────────
// Products
// ─────────────────────────────────────────────

export interface Product {
  id: string;
  product_code: string;
  lab_code: string | null;
  product_name: string;
  category: string | null;
  movement_count?: number;
  latest_snapshot_date?: string | null;
  total_stock?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProductsListResponse {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  products: Product[];
}

export const productsApi = {
  list: (params?: QueryParams & { category?: string }) =>
    api.get<ProductsListResponse>(`/products/${qs(params)}`),

  get: (id: string) =>
    api.get<Product>(`/products/${id}/`),

  categories: () =>
    api.get<{ categories: string[] }>('/products/categories/'),

  inventoryHistory: (id: string, params?: QueryParams) =>
    api.get<any>(`/products/${id}/inventory/${qs(params)}`),

  movements: (id: string, params?: QueryParams) =>
    api.get<any>(`/products/${id}/movements/${qs(params)}`),
};

// ─────────────────────────────────────────────
// Customers
// ─────────────────────────────────────────────

export interface Customer {
  id: string;
  customer_name: string;
  account_code: string;
  area_code: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  movement_count?: number;
  latest_aging_total?: number | null;
  latest_aging_risk?: string | null;
  created_at?: string;
}

export interface CustomersListResponse {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  customers: Customer[];
}

export const customersApi = {
  list: (params?: QueryParams & { area_code?: string }) =>
    api.get<CustomersListResponse>(`/customers/${qs(params)}`),

  get: (id: string) =>
    api.get<Customer>(`/customers/${id}/`),

  movements: (id: string, params?: QueryParams) =>
    api.get<any>(`/customers/${id}/movements/${qs(params)}`),

  aging: (id: string) =>
    api.get<any>(`/customers/${id}/aging/`),
};

// ─────────────────────────────────────────────
// Inventory
// ─────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  snapshot_date: string;
  product: string;
  product_code: string;
  product_name: string;
  category: string | null;
  qty_alkarimia: number;
  qty_benghazi: number;
  qty_mazraa: number;
  qty_dahmani: number;
  qty_janzour: number;
  qty_misrata: number;
  value_alkarimia: number;
  value_mazraa: number;
  value_dahmani: number;
  value_janzour: number;
  value_misrata: number;
  total_qty: number;
  cost_price: number;
  total_value: number;
}

export interface InventoryListResponse {
  snapshot_date: string | null;
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  totals: { grand_total_qty: number; grand_total_value: number };
  items: InventoryItem[];
}

export interface BranchSummary {
  branch: string;
  total_qty: number;
  total_value: number;
}

export interface CategoryBreakdown {
  category: string;
  total_qty: number;
  total_value: number;
}

export const inventoryApi = {
  list: (params?: QueryParams & { snapshot_date?: string; category?: string }) =>
    api.get<InventoryListResponse>(`/inventory/${qs(params)}`),

  get: (id: string) =>
    api.get<InventoryItem>(`/inventory/${id}/`),

  dates: () =>
    api.get<{ dates: string[] }>('/inventory/dates/'),

  branchSummary: (params?: { snapshot_date?: string; category?: string }) =>
    api.get<{ snapshot_date: string | null; branches: BranchSummary[] }>(
      `/inventory/branch-summary/${qs(params)}`
    ),

  categoryBreakdown: (params?: { snapshot_date?: string }) =>
    api.get<{ snapshot_date: string | null; categories: CategoryBreakdown[] }>(
      `/inventory/category-breakdown/${qs(params)}`
    ),
};

// ─────────────────────────────────────────────
// Transactions
// ─────────────────────────────────────────────

export interface Movement {
  id: string;
  material_code: string;
  material_name: string;
  movement_date: string;
  movement_type: string;
  movement_type_display: string;
  qty_in: number;
  qty_out: number;
  total_in: number;
  total_out: number;
  balance_price: number;
  branch_name: string | null;
  customer_name: string | null;
}

export interface MovementsListResponse {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  totals: { total_in_value: number; total_out_value: number };
  movements: Movement[];
}

export interface MonthlySummaryItem {
  year: number;
  month: number;
  month_label: string;
  total_sales: number;
  total_purchases: number;
  sales_count: number;
  purchases_count: number;
}

export interface TypeBreakdownItem {
  movement_type: string;
  label: string;
  count: number;
  total_in: number;
  total_out: number;
}

export interface BranchBreakdownItem {
  branch: string;
  count: number;
  total: number;
}

export const transactionsApi = {
  list: (params?: QueryParams & {
    movement_type?: string;
    branch?: string;
    date_from?: string;
    date_to?: string;
  }) =>
    api.get<MovementsListResponse>(`/transactions/${qs(params)}`),

  get: (id: string) =>
    api.get<any>(`/transactions/${id}/`),

  summary: (params?: { year?: number; months?: number }) =>
    api.get<{ summary: MonthlySummaryItem[] }>(`/transactions/summary/${qs(params)}`),

  typeBreakdown: (params?: { date_from?: string; date_to?: string }) =>
    api.get<{ breakdown: TypeBreakdownItem[] }>(
      `/transactions/type-breakdown/${qs(params)}`
    ),

  branchBreakdown: (params?: { movement_type?: string; date_from?: string; date_to?: string }) =>
    api.get<{ movement_type: string; branches: BranchBreakdownItem[] }>(
      `/transactions/branch-breakdown/${qs(params)}`
    ),
};

// ─────────────────────────────────────────────
// Aging
// ─────────────────────────────────────────────

export interface AgingRecord {
  id: string;
  report_date: string;
  customer: string | null;
  customer_name: string | null;
  account: string;
  account_code: string;
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d91_120: number;
  d121_150: number;
  d151_180: number;
  d181_210: number;
  d211_240: number;
  d241_270: number;
  d271_300: number;
  d301_330: number;
  over_330: number;
  total: number;
  overdue_total: number;
  risk_score: 'low' | 'medium' | 'high' | 'critical';
}

export interface AgingListResponse {
  report_date: string | null;
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  grand_total: number;
  records: AgingRecord[];
}

export interface AgingRiskItem {
  id: string;
  account: string;
  account_code: string;
  customer_name: string | null;
  total: number;
  overdue_total: number;
  risk_score: string;
}

export interface AgingDistributionItem {
  bucket: string;
  label: string;
  total: number;
  percentage: number;
}

export const agingApi = {
  list: (params?: QueryParams & { report_date?: string; risk?: string }) =>
    api.get<AgingListResponse>(`/aging/${qs(params)}`),

  get: (id: string) =>
    api.get<AgingRecord>(`/aging/${id}/`),

  dates: () =>
    api.get<{ dates: string[] }>('/aging/dates/'),

  risk: (params?: { report_date?: string; risk?: string; limit?: number }) =>
    api.get<{ report_date: string | null; count: number; top_risk: AgingRiskItem[] }>(
      `/aging/risk/${qs(params)}`
    ),

  distribution: (params?: { report_date?: string }) =>
    api.get<{
      report_date: string | null;
      grand_total: number;
      distribution: AgingDistributionItem[];
    }>(`/aging/distribution/${qs(params)}`),
};

// ─────────────────────────────────────────────
// KPI Engine (aggregated from multiple endpoints)
// ─────────────────────────────────────────────

export interface KPIData {
  totalSalesValue: number;
  totalPurchasesValue: number;
  stockValue: number;
  totalReceivables: number;
  monthlySummary: MonthlySummaryItem[];
}

export const kpiApi = {
  /**
   * Fetches KPIs by combining:
   *  - transactions/summary (sales, purchases over 12 months)
   *  - inventory (total stock value)
   *  - aging (total receivables)
   */
  async getAll(): Promise<KPIData> {
    const [summaryRes, inventoryRes, agingRes] = await Promise.allSettled([
      transactionsApi.summary(),
      inventoryApi.list({ page_size: 1 }),
      agingApi.list({ page_size: 1 }),
    ]);

    const summary =
      summaryRes.status === 'fulfilled' ? summaryRes.value.summary : [];

    const stockValue =
      inventoryRes.status === 'fulfilled'
        ? inventoryRes.value.totals?.grand_total_value ?? 0
        : 0;

    const totalReceivables =
      agingRes.status === 'fulfilled'
        ? agingRes.value.grand_total ?? 0
        : 0;

    const totalSalesValue = summary.reduce((s, m) => s + m.total_sales, 0);
    const totalPurchasesValue = summary.reduce((s, m) => s + m.total_purchases, 0);

    return {
      totalSalesValue,
      totalPurchasesValue,
      stockValue,
      totalReceivables,
      monthlySummary: summary,
    };
  },
};
// ─────────────────────────────────────────────────────────────────────────────
// Add this to src/app/lib/dataApi.ts  (append after the existing kpiApi)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreditKPIItem {
  value: number;
  label: string;
  unit: string;
  description: string;
  numerator?: number;
  denominator?: number;
  ca_credit?: number;
  ca_total?: number;
  overdue_amount?: number;
  total_receivables?: number;
  recovered_amount?: number;
  total_credit?: number;
}

export interface RiskyCustomer {
  id: string;
  account: string;
  account_code: string;
  customer_name: string;
  total: number;
  current: number;
  overdue_total: number;
  risk_score: 'low' | 'medium' | 'high' | 'critical';
  overdue_percentage: number;
  dmp_days: number;
  buckets: Record<string, number>;
}

export interface BucketDistributionItem {
  bucket: string;
  label: string;
  amount: number;
  percentage: number;
  midpoint_days: number;
}

export interface CreditKPIData {
  report_date: string | null;
  kpis: {
    taux_clients_credit: CreditKPIItem;
    taux_credit_total: CreditKPIItem;
    taux_impayes: CreditKPIItem;
    dmp: CreditKPIItem;
    taux_recouvrement: CreditKPIItem;
  };
  top5_risky_customers: RiskyCustomer[];
  bucket_distribution: BucketDistributionItem[];
  summary: {
    total_customers: number;
    credit_customers: number;
    grand_total_receivables: number;
    overdue_amount: number;
    ca_credit: number;
    ca_total: number;
  };
}

export const creditKpiApi = {
  getAll: (params?: { report_date?: string }) =>
    api.get<CreditKPIData>(`/kpi/credit/${params?.report_date ? `?report_date=${params.report_date}` : ''}`),
};
// ─────────────────────────────────────────────
// Branches (derived from inventory branch-summary)
// ─────────────────────────────────────────────

export const branchesApi = {
  list: () => inventoryApi.branchSummary(),
};