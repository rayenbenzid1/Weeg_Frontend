// ─────────────────────────────────────────────
// Data Import (adapted to real backend endpoints)
// ─────────────────────────────────────────────
import { api } from "./api";

// ─────────────────────────────────────────────
// Arabic movement type constants
// (raw values stored in DB — never use English enum strings with the API)
// ─────────────────────────────────────────────

export const MOVEMENT_TYPES = {
  SALE: "ف بيع",
  SALE_RETURN: "مردودات بيع",
  PURCHASE: "ف شراء",
  PURCHASE_RETURN: "مردودات شراء",
  MAIN_ENTRY: "ادخال رئيسي",
} as const;

export type MovementTypeValue =
  (typeof MOVEMENT_TYPES)[keyof typeof MOVEMENT_TYPES];

export const SALE_TYPES: string[] = [
  MOVEMENT_TYPES.SALE,
  MOVEMENT_TYPES.SALE_RETURN,
];
export const PURCHASE_TYPES: string[] = [
  MOVEMENT_TYPES.PURCHASE,
  MOVEMENT_TYPES.PURCHASE_RETURN,
  MOVEMENT_TYPES.MAIN_ENTRY,
];

/** Maps a raw Arabic value to a friendly English display label */
export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  [MOVEMENT_TYPES.SALE]: "Sale",
  [MOVEMENT_TYPES.SALE_RETURN]: "Sales Return",
  [MOVEMENT_TYPES.PURCHASE]: "Purchase",
  [MOVEMENT_TYPES.PURCHASE_RETURN]: "Purchase Return",
  [MOVEMENT_TYPES.MAIN_ENTRY]: "Main Entry",
};

export function getMovementTypeLabel(rawType: string): string {
  return MOVEMENT_TYPE_LABELS[rawType] ?? rawType;
}

export function isSaleType(rawType: string): boolean {
  return SALE_TYPES.includes(rawType);
}

export function isPurchaseType(rawType: string): boolean {
  return PURCHASE_TYPES.includes(rawType);
}

// ─────────────────────────────────────────────
// Import Log / Result
// ─────────────────────────────────────────────

export interface ImportLogEntry {
  id: string;
  file_type: string;
  original_filename: string;
  status: "pending" | "processing" | "success" | "partial" | "failed";
  row_count: number;
  success_count: number;
  error_count: number;
  error_details: Array<{ row?: number; error: string }>;
  started_at: string;
  completed_at?: string | null;
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
  uploadFile: async (
    file: File,
    options: {
      file_type?: string;
      snapshot_date?: string;
      report_date?: string;
      onProgress?: (progress: number) => void;
    } = {},
  ): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append("file", file);
    if (options.file_type) formData.append("file_type", options.file_type);
    if (options.snapshot_date)
      formData.append("snapshot_date", options.snapshot_date);
    if (options.report_date)
      formData.append("report_date", options.report_date);

    const token = localStorage.getItem("fasi_access_token");

    const response = await fetch("/api/import/upload/", {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: "Network or server error" };
      }
      throw new Error(
        errorData.message ||
          errorData.error ||
          `Upload failed (${response.status})`,
      );
    }

    return response.json();
  },

  detectFile: async (file: File): Promise<DetectResult> => {
    const formData = new FormData();
    formData.append("file", file);

    const token = localStorage.getItem("fasi_access_token");

    const response = await fetch("/api/import/detect/", {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Detection failed");
    }

    return response.json();
  },

  getImportLogs: async (params?: { file_type?: string; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    const url = `/api/import/logs/${query ? `?${query}` : ""}`;
    const token = localStorage.getItem("fasi_access_token");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Failed to fetch logs");
    return response.json();
  },

  downloadTemplate: async (type: string) => {
    const token = localStorage.getItem("fasi_access_token");
    const response = await fetch(`/api/import/template/${type}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Template download failed");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}-import-template.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

export interface PaginatedResponse {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  [listKey: string]: any;
}

export interface QueryParams {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
  [key: string]: any;
}

function qs(params?: QueryParams): string {
  if (!params) return "";
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== null) p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
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

  get: (id: string) => api.get<Product>(`/products/${id}/`),

  categories: () => api.get<{ categories: string[] }>("/products/categories/"),

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

  get: (id: string) => api.get<Customer>(`/customers/${id}/`),

  movements: (id: string, params?: QueryParams) =>
    api.get<any>(`/customers/${id}/movements/${qs(params)}`),

  aging: (id: string) => api.get<any>(`/customers/${id}/aging/`),
};

// ─────────────────────────────────────────────
// Inventory (two-table architecture: Snapshot + Lines)
// ─────────────────────────────────────────────

/** One import-session record per uploaded Excel file. */
export interface InventorySnapshot {
  id: string;
  company_name: string;
  label: string;
  snapshot_date: string | null;
  fiscal_year: string;
  source_file: string;
  notes: string;
  uploaded_at: string;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  /** Annotated by list/detail endpoint. */
  line_count: number;
  /** DecimalField → may be a string. Use toNum() before display. */
  total_lines_value: number | string | null;
  /** Distinct branch names — present on the detail endpoint only. */
  branches?: string[];
}

export interface InventorySnapshotListResponse {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: InventorySnapshot[];
}

/** One product × branch row produced by the horizontal-melt import. */
export interface InventorySnapshotLine {
  id: string;
  product_category: string;
  product_code: string;
  product_name: string;
  branch_name: string;
  /** DecimalField → may be a string. Use toNum() before display. */
  quantity: number | string;
  unit_cost: number | string;
  line_value: number | string;
}

export interface InventoryLinesResponse {
  snapshot_id: string;
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  totals: {
    grand_total_qty: number;
    grand_total_value: number;
    distinct_products: number;
    out_of_stock_count: number;
    critical_count: number;
    low_count: number;
  };
  lines: InventorySnapshotLine[];
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
  /** List snapshot sessions for the current company, newest first. */
  listSnapshots: (params?: QueryParams & { search?: string }) =>
    api.get<InventorySnapshotListResponse>(`/inventory/${qs(params)}`),

  /** Full snapshot detail including branches[] list. */
  getSnapshot: (id: string) => api.get<InventorySnapshot>(`/inventory/${id}/`),

  /** Delete a snapshot and all its lines. */
  deleteSnapshot: (id: string) => api.delete<null>(`/inventory/${id}/`),

  /**
   * Paginated product × branch lines for one snapshot.
   * Supports ?branch= and ?search= filters.
   */
  getLines: (
    snapshotId: string,
    params?: QueryParams & { branch?: string; search?: string },
  ) =>
    api.get<InventoryLinesResponse>(
      `/inventory/${snapshotId}/lines/${qs(params)}`,
    ),

  /** Distinct upload dates (from uploaded_at). */
  dates: () => api.get<{ dates: string[] }>("/inventory/dates/"),

  /** Stock value + qty totals per branch. Optional ?snapshot_id= filter. */
  branchSummary: (params?: { snapshot_id?: string }) =>
    api.get<{ branches: BranchSummary[] }>(
      `/inventory/branch-summary/${qs(params)}`,
    ),

  /** Stock value + qty totals per product category. Optional ?snapshot_id= filter. */
  categoryBreakdown: (params?: { snapshot_id?: string }) =>
    api.get<{ categories: CategoryBreakdown[] }>(
      `/inventory/category-breakdown/${qs(params)}`,
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
  /** Raw Arabic label as stored in the DB, e.g. "ف بيع" */
  movement_type: string;
  /** Friendly English label returned by the serializer */
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
  total_profit?: number;
  total_qty?: number;
  sales_count: number;
  purchases_count: number;
}

export interface TypeBreakdownItem {
  /** Raw Arabic movement_type value */
  movement_type: string;
  /** Friendly English label */
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

export interface BranchMonthlyItem {
  month: string;
  year: number;
  [branch: string]: string | number;
}

export interface BranchMonthlyResponse {
  movement_type: string;
  branches: string[];
  monthly_data: BranchMonthlyItem[];
}
export const transactionsApi = {
  list: (
    params?: QueryParams & {
      /** Pass a raw Arabic movement_type value, e.g. MOVEMENT_TYPES.SALE */
      movement_type?: string;
      branch?: string;
      date_from?: string;
      date_to?: string;
    },
  ) => api.get<MovementsListResponse>(`/transactions/${qs(params)}`),

  get: (id: string) => api.get<any>(`/transactions/${id}/`),

  summary: (params?: { year?: number; months?: number }) =>
    api.get<{ summary: MonthlySummaryItem[] }>(
      `/transactions/summary/${qs(params)}`,
    ),

  typeBreakdown: (params?: { date_from?: string; date_to?: string }) =>
    api.get<{ breakdown: TypeBreakdownItem[] }>(
      `/transactions/type-breakdown/${qs(params)}`,
    ),

  /**
   * Branch breakdown filtered by a raw Arabic movement_type.
   * Defaults to SALE type if no movement_type is provided.
   */
  branchBreakdown: (params?: {
    /** Raw Arabic value, e.g. MOVEMENT_TYPES.SALE. Defaults to sale type on backend. */
    movement_type?: string;
    date_from?: string;
    date_to?: string;
  }) =>
    api.get<{ movement_type: string; branches: BranchBreakdownItem[] }>(
      `/transactions/branch-breakdown/${qs(params)}`,
    ),

  /**
   * Returns all distinct movement_type values present in the DB for this company.
   * Use this to dynamically populate filter dropdowns.
   * GET /api/transactions/movement-types/
   */
  branchMonthly: (params?: {
    movement_type?: string;
    year?: number;
    date_from?: string;
    date_to?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.movement_type) query.set("movement_type", params.movement_type);
    if (params?.year) query.set("year", String(params.year));
    if (params?.date_from) query.set("date_from", params.date_from);
    if (params?.date_to) query.set("date_to", params.date_to);
    const qs = query.toString();
    // ✅ Pas de slash final avant le ?
    return api.get<BranchMonthlyResponse>(
      `/transactions/branch-monthly${qs ? `/?${qs}` : "/"}`,
    );
  },
  movementTypes: () =>
    api.get<{ types: string[] }>("/transactions/movement-types/"),
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
  risk_score: "low" | "medium" | "high" | "critical";
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
  midpoint_days: number;
}

export const agingApi = {
  list: (params?: QueryParams & { report_date?: string; risk?: string }) =>
    api.get<AgingListResponse>(`/aging/${qs(params)}`),

  get: (id: string) => api.get<AgingRecord>(`/aging/${id}/`),

  dates: () => api.get<{ dates: string[] }>("/aging/dates/"),

  risk: (params?: { report_date?: string; risk?: string; limit?: number }) =>
    api.get<{
      report_date: string | null;
      count: number;
      top_risk: AgingRiskItem[];
    }>(`/aging/risk/${qs(params)}`),

  distribution: (params?: { report_date?: string }) =>
    api.get<{
      report_date: string | null;
      grand_total: number;
      distribution: AgingDistributionItem[];
    }>(`/aging/distribution/${qs(params)}`),
};

// ─────────────────────────────────────────────
// KPI Engine
// ─────────────────────────────────────────────

export interface KPIData {
  totalSalesValue: number;
  totalPurchasesValue: number;
  stockValue: number;
  totalReceivables: number;
  monthlySummary: MonthlySummaryItem[];
}

export const kpiApi = {
  async getAll(): Promise<KPIData> {
    const [summaryRes, inventoryRes, agingRes] = await Promise.allSettled([
      transactionsApi.summary(),
      inventoryApi.listSnapshots({ page_size: 1 }),
      agingApi.list({ page_size: 1 }),
    ]);

    const summary =
      summaryRes.status === "fulfilled" ? summaryRes.value.summary : [];

    const stockValue =
      inventoryRes.status === "fulfilled"
        ? toFiniteNumber(inventoryRes.value.items?.[0]?.total_lines_value, 0)
        : 0;

    const totalReceivables =
      agingRes.status === "fulfilled" ? (agingRes.value.grand_total ?? 0) : 0;

    const totalSalesValue = summary.reduce((s, m) => s + m.total_sales, 0);
    const totalPurchasesValue = summary.reduce(
      (s, m) => s + m.total_purchases,
      0,
    );

    return {
      totalSalesValue,
      totalPurchasesValue,
      stockValue,
      totalReceivables,
      monthlySummary: summary,
    };
  },
};

// ─────────────────────────────────────────────
// Credit KPI
// ─────────────────────────────────────────────

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
  risk_score: "low" | "medium" | "high" | "critical";
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
    api.get<CreditKPIData>(
      `/kpi/credit/${params?.report_date ? `?report_date=${params.report_date}` : ""}`,
    ),
};

// ─────────────────────────────────────────────
// Branches
// ─────────────────────────────────────────────

export const branchesApi = {
  list: () => inventoryApi.branchSummary(),
};

// ─────────────────────────────────────────────
// Sales KPI  — GET /api/kpi/sales/
// ─────────────────────────────────────────────

export interface SalesKPIProduct {
  material_code: string;
  material_name: string;
  total_revenue: number;
  total_qty: number;
  total_profit?: number;
  transaction_count: number;
  revenue_share: number; // %
  margin_pct?: number; // only in product_margins array
  rotation_rate?: number;
  coverage_days?: number;
  total_price_out_x_qty?:       number;  // ✅ ajouter
  total_balance_price_x_qty?:   number;  // ✅ ajouter
}

export interface SalesKPIClient {
  customer_name: string;
  total_revenue: number;
  total_profit?: number;
  transaction_count: number;
  revenue_share: number; // %
}

export interface MonthlySalesKPIItem {
  year: number;
  month: number;
  month_label: string;
  total_revenue: number;
  total_qty: number;
  count: number;
}

export interface SalesVelocityProduct {
  material_code: string;
  material_name: string;
  avg_daily_revenue: number;
  avg_daily_qty: number;
  days_to_sell_100: number;
  total_qty: number;
}

interface SalesKPIRawProduct {
  material_code?: string;
  material_name?: string;
  total_revenue?: number | string;
  revenue?: number | string;
  total_qty?: number | string;
  total_profit?: number | string;
  transaction_count?: number | string;
  revenue_share?: number | string;
  margin_pct?: number | string;
  rotation_rate?: number | string;
  coverage_days?: number | string | null;
  total_price_out_x_qty?:       number | string; 
  total_balance_price_x_qty?:   number | string;
}

interface SalesKPIRawClient {
  customer_name?: string;
  total_revenue?: number | string;
  total_profit?: number | string;
  transaction_count?: number | string;
  revenue_share?: number | string;
}

interface SalesKPIRawMonthly {
  year?: number | string;
  month?: number | string;
  month_label?: string;
  total_revenue?: number | string;
  total_qty?: number | string;
  count?: number | string;
}

interface SalesKPIRawVelocityProduct {
  material_code?: string;
  material_name?: string;
  avg_daily_revenue?: number | string;
  avg_daily_qty?: number | string;
  days_to_sell_100?: number | string;
  days_to_sell_100_units?: number | string;
  total_qty?: number | string;
}

interface SalesKPIRawData {
  year?: number | string;
  period?: { from?: string; to?: string };
  period_from?: string | null;
  period_to?: string | null;
  ca?: {
    total?: number | string;
    previous?: number | string;
    label?: string;
    unit?: string;
  };
  sales_evolution?: {
    value?: number | string | null;
    is_up?: boolean | null;
    label?: string;
    unit?: string;
    description?: string;
  };
  top_products?: SalesKPIRawProduct[];
  monthly_sales?: SalesKPIRawMonthly[];
  product_margins?: SalesKPIRawProduct[];
  top_clients?: SalesKPIRawClient[];
  sales_velocity?: {
    avg_daily_revenue?: number | string;
    avg_daily_qty?: number | string;
    n_days?: number | string;
    total_days?: number | string;
    by_product?: SalesKPIRawVelocityProduct[];
  };
}

export interface SalesKPIData {
  year: number;
  period_from: string | null;
  period_to: string | null;
  ca: { total: number; previous: number; label: string; unit: string };
  sales_evolution: {
    value: number;
    is_up: boolean;
    label: string;
    unit: string;
    description: string;
  };
  top_products: SalesKPIProduct[];
  monthly_sales: MonthlySalesKPIItem[];
  product_margins: SalesKPIProduct[];
  top_clients: SalesKPIClient[];
  sales_velocity: {
    avg_daily_revenue: number;
    avg_daily_qty: number;
    n_days: number;
    by_product: SalesVelocityProduct[];
  };
  avg_price_out?:     number;
  avg_balance_price?: number;
}

function normalizeSalesProduct(product: SalesKPIRawProduct): SalesKPIProduct {
  return {
    material_code: product.material_code ?? "",
    material_name: product.material_name ?? "",
    total_revenue: toFiniteNumber(product.total_revenue ?? product.revenue, 0),
    total_qty: toFiniteNumber(product.total_qty, 0),
    total_profit:
      product.total_profit === undefined
        ? undefined
        : toFiniteNumber(product.total_profit, 0),
    transaction_count: toFiniteNumber(product.transaction_count, 0),
    revenue_share: toFiniteNumber(product.revenue_share, 0),
    margin_pct:
      product.margin_pct === undefined
        ? undefined
        : toFiniteNumber(product.margin_pct, 0),
    rotation_rate:
      product.rotation_rate === undefined
        ? undefined
        : toFiniteNumber(product.rotation_rate, 0),
    coverage_days:
      product.coverage_days === null || product.coverage_days === undefined
        ? undefined
        : toFiniteNumber(product.coverage_days, 0),
    total_price_out_x_qty:     product.total_price_out_x_qty !== undefined
                             ? toFiniteNumber(product.total_price_out_x_qty, 0)
                             : undefined,   // ✅ ajouter
    total_balance_price_x_qty: product.total_balance_price_x_qty !== undefined
                             ? toFiniteNumber(product.total_balance_price_x_qty, 0)
                             : undefined,
  };
}

function normalizeSalesKPIData(raw: SalesKPIRawData): SalesKPIData {
  return {
    year: toFiniteNumber(raw.year, new Date().getFullYear()),
    period_from: raw.period_from ?? raw.period?.from ?? null,
    period_to: raw.period_to ?? raw.period?.to ?? null,
    ca: {
      total: toFiniteNumber(raw.ca?.total, 0),
      previous: toFiniteNumber(raw.ca?.previous, 0),
      label: raw.ca?.label ?? "Chiffre d'Affaires",
      unit: raw.ca?.unit ?? "LYD",
    },
    sales_evolution: {
      value: toFiniteNumber(raw.sales_evolution?.value, 0),
      is_up: Boolean(raw.sales_evolution?.is_up),
      label: raw.sales_evolution?.label ?? "Sales Evolution",
      unit: raw.sales_evolution?.unit ?? "%",
      description:
        raw.sales_evolution?.description ?? "Comparison with previous period",
    },
    top_products: (raw.top_products ?? []).map(normalizeSalesProduct),
    monthly_sales: (raw.monthly_sales ?? []).map((item) => ({
      year: toFiniteNumber(item.year, 0),
      month: toFiniteNumber(item.month, 0),
      month_label: item.month_label ?? "",
      total_revenue: toFiniteNumber(item.total_revenue, 0),
      total_qty: toFiniteNumber(item.total_qty, 0),
      count: toFiniteNumber(item.count, 0),
    })),
    product_margins: (raw.product_margins ?? []).map(normalizeSalesProduct),
    top_clients: (raw.top_clients ?? []).map((client) => ({
      customer_name: client.customer_name ?? "",
      total_revenue: toFiniteNumber(client.total_revenue, 0),
      total_profit:
        client.total_profit === undefined
          ? undefined
          : toFiniteNumber(client.total_profit, 0),
      transaction_count: toFiniteNumber(client.transaction_count, 0),
      revenue_share: toFiniteNumber(client.revenue_share, 0),
    })),
    sales_velocity: {
      avg_daily_revenue: toFiniteNumber(
        raw.sales_velocity?.avg_daily_revenue,
        0,
      ),
      avg_daily_qty: toFiniteNumber(raw.sales_velocity?.avg_daily_qty, 0),
      n_days: toFiniteNumber(
        raw.sales_velocity?.n_days ?? raw.sales_velocity?.total_days,
        0,
      ),
      by_product: (raw.sales_velocity?.by_product ?? []).map((product) => ({
        material_code: product.material_code ?? "",
        material_name: product.material_name ?? "",
        avg_daily_revenue: toFiniteNumber(product.avg_daily_revenue, 0),
        avg_daily_qty: toFiniteNumber(product.avg_daily_qty, 0),
        days_to_sell_100: toFiniteNumber(
          product.days_to_sell_100 ?? product.days_to_sell_100_units,
          0,
        ),
        total_qty: toFiniteNumber(product.total_qty, 0),
      })),
    },
  };
}

export const salesKpiApi = {
  getAll: async (params?: {
    year?: number;
    date_from?: string;
    date_to?: string;
    top_n?: number;
  }) => {
    const p = new URLSearchParams();
    if (params?.year) p.set("year", String(params.year));
    if (params?.date_from) p.set("date_from", params.date_from);
    if (params?.date_to) p.set("date_to", params.date_to);
    if (params?.top_n) p.set("top_n", String(params.top_n));
    const qs = p.toString();
    const raw = await api.get<SalesKPIRawData>(
      `/kpi/sales/${qs ? `?${qs}` : ""}`,
    );
    return normalizeSalesKPIData(raw);
  },
};

// ─────────────────────────────────────────────
// Stock KPI  — GET /api/kpi/stock/
// ─────────────────────────────────────────────

export interface StockKPIProduct {
  material_code: string;
  product_name: string;
  category: string | null;
  stock_qty: number;
  stock_value: number;
  cost_price: number;
  qty_sold: number;
  revenue: number;
  rotation_rate: number;
  coverage_days: number | null;
  // rotation_rate = qty_sold / (qty_opening + qty_purchased)
  qty_opening: number;    // ف.أول المدة — opening balance qty
  qty_purchased: number;  // ف شراء      — purchased qty during the year
  denominator: number;    // qty_opening + qty_purchased (the divisor)
}

interface StockKPIRawProduct {
  material_code?: string;
  product_name?: string;
  category?: string | null;
  stock_qty?: number | string;
  stock_value?: number | string;
  cost_price?: number | string;
  qty_sold?: number | string;
  revenue?: number | string;
  rotation_rate?: number | string;
  coverage_days?: number | string | null;
  qty_opening?: number | string;
  qty_purchased?: number | string;
  denominator?: number | string;
}

interface StockKPIRawData {
  snapshot_date?: string | null;
  year?: number;
  rotation_formula?: string; 
  stock_summary?: {
    total_products?: number;
    total_qty?: number;
    total_stock_qty?: number;
    total_value?: number;
    total_stock_value?: number;
    zero_stock_count?: number;
    low_rotation_count?: number;
    low_rotation_threshold?: number;
    avg_rotation_rate?: number;
  };
  top_rotation_products?: StockKPIRawProduct[];
  low_rotation_products?: StockKPIRawProduct[];
  zero_stock_products?: StockKPIRawProduct[];
  coverage_at_risk?: StockKPIRawProduct[];
}

export interface StockKPIData {
  snapshot_date: string | null;
  year: number;
  rotation_formula: string;
  stock_summary: {
    total_products: number;
    total_qty: number;
    total_value: number;
    zero_stock_count: number;
    low_rotation_count: number;
    low_rotation_threshold: number;
    avg_rotation_rate?: number;
  };
  top_rotation_products: StockKPIProduct[];
  low_rotation_products: StockKPIProduct[];
  zero_stock_products: StockKPIProduct[];
  coverage_at_risk: StockKPIProduct[];
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStockKPIProduct(
  product: StockKPIRawProduct,
): StockKPIProduct {
  const coverageDaysRaw = product.coverage_days;
  const coverageDays =
    coverageDaysRaw === null || coverageDaysRaw === undefined
      ? null
      : toFiniteNumber(coverageDaysRaw, 0);

  return {
    material_code: product.material_code ?? "",
    product_name: product.product_name ?? "",
    category: product.category ?? null,
    stock_qty: toFiniteNumber(product.stock_qty, 0),
    stock_value: toFiniteNumber(product.stock_value, 0),
    cost_price: toFiniteNumber(product.cost_price, 0),
    qty_sold: toFiniteNumber(product.qty_sold, 0),
    revenue: toFiniteNumber(product.revenue, 0),
    rotation_rate: toFiniteNumber(product.rotation_rate, 0),
    coverage_days: coverageDays,
    qty_opening:    toFiniteNumber(product.qty_opening,   0),
    qty_purchased:  toFiniteNumber(product.qty_purchased, 0),
    denominator:    toFiniteNumber(product.denominator,   0),
  };
}

function normalizeStockKPIData(raw: StockKPIRawData): StockKPIData {
  const summary = raw.stock_summary ?? {};

  return {
    snapshot_date: raw.snapshot_date ?? null,
    year: raw.year ?? new Date().getFullYear(),
    rotation_formula: raw.rotation_formula ?? "qty_sold / (stock_initial + achats)",
    stock_summary: {
      total_products: toFiniteNumber(summary.total_products, 0),
      total_qty: toFiniteNumber(
        summary.total_qty ?? summary.total_stock_qty,
        0,
      ),
      total_value: toFiniteNumber(
        summary.total_value ?? summary.total_stock_value,
        0,
      ),
      zero_stock_count: toFiniteNumber(summary.zero_stock_count, 0),
      low_rotation_count: toFiniteNumber(summary.low_rotation_count, 0),
      low_rotation_threshold: toFiniteNumber(summary.low_rotation_threshold, 0),
      avg_rotation_rate:
        summary.avg_rotation_rate !== undefined
          ? toFiniteNumber(summary.avg_rotation_rate, 0)
          : undefined,
    },
    top_rotation_products: (raw.top_rotation_products ?? []).map(
      normalizeStockKPIProduct,
    ),
    low_rotation_products: (raw.low_rotation_products ?? []).map(
      normalizeStockKPIProduct,
    ),
    zero_stock_products: (raw.zero_stock_products ?? []).map(
      normalizeStockKPIProduct,
    ),
    coverage_at_risk: (raw.coverage_at_risk ?? []).map(
      normalizeStockKPIProduct,
    ),
  };
}

export const stockKpiApi = {
  getAll: async (params?: {
    snapshot_date?: string;
    year?: number;
    low_rotation_threshold?: number;
  }) => {
    const p = new URLSearchParams();
    if (params?.snapshot_date) p.set("snapshot_date", params.snapshot_date);
    if (params?.year) p.set("year", String(params.year));
    if (params?.low_rotation_threshold !== undefined)
      p.set("low_rotation_threshold", String(params.low_rotation_threshold));
    const qs = p.toString();
    const raw = await api.get<StockKPIRawData>(
      `/kpi/stock/${qs ? `?${qs}` : ""}`,
    );
    return normalizeStockKPIData(raw);
  },
};
