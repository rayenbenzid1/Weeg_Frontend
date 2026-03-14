import { useState, useEffect, useCallback, useRef } from "react";
import { ApiError } from "./api";
import {
  salesKpiApi,
  stockKpiApi,
  creditKpiApi,
  SalesKPIData,
  StockKPIData,
  CreditKPIData,
  productsApi,
  customersApi,
  inventoryApi,
  transactionsApi,
  agingApi,
  kpiApi,
  MOVEMENT_TYPES,
  type Product,
  type Customer,
  type InventorySnapshot,
  type InventorySnapshotLine,
  type InventoryLinesResponse,
  type Movement,
  type AgingRecord,
  type AgingRiskItem,
  type AgingDistributionItem,
  type MonthlySummaryItem,
  type BranchSummary,
  type CategoryBreakdown,
  type KPIData,
  type QueryParams,
} from "./dataApi";

// ─────────────────────────────────────────────────────────────────────────────
// Movement-type normaliser
//
// Some Excel files store movement types with a trailing space, e.g. 'ف بيع '
// instead of 'ف بيع'.  When those rows reach the DB un-trimmed, any query
// using the canonical value ('ف بيع') returns zero results, causing branches
// to vanish from every chart.
//
// This helper strips all whitespace from any movement_type before it is sent
// to the API.  It is applied in every hook that accepts a movement_type param,
// acting as a last line of defence on the frontend side.
//
// The root fix is the Django data migration 0003_trim_movement_types.py which
// cleans all existing rows in the DB, and the updated MovementsParser which
// strips at import time.  This frontend guard ensures correctness even if a
// stale client sends an untrimmed value.
// ─────────────────────────────────────────────────────────────────────────────

type WithMovementType = { movement_type?: string };

/**
 * Return a copy of `params` with `movement_type` trimmed of whitespace.
 * If `params` is undefined or has no `movement_type`, it is returned unchanged.
 */
function normalizeMovementType<T extends WithMovementType>(
  params?: T,
): T | undefined {
  if (!params) return params;
  if (params.movement_type === undefined) return params;
  const trimmed = params.movement_type.trim();
  if (trimmed === params.movement_type) return params; // no change — avoid new object
  return { ...params, movement_type: trimmed };
}

// ─────────────────────────────────────────────
// Generic async hook
// ─────────────────────────────────────────────

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useAsync<T>(
  fetchFn: () => Promise<T>,
  deps: unknown[] = [],
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      if (mountedRef.current) setData(result);
    } catch (err) {
      if (mountedRef.current) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(String(err));
        }
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    execute();
    return () => {
      mountedRef.current = false;
    };
  }, [execute]);

  return { data, loading, error, refetch: execute };
}

// ─────────────────────────────────────────────
// Products
// ─────────────────────────────────────────────

export function useProducts(params?: QueryParams & { category?: string }) {
  return useAsync(() => productsApi.list(params), [JSON.stringify(params)]);
}

export function useProduct(id: string | null) {
  return useAsync(
    () => (id ? productsApi.get(id) : Promise.resolve(null as any)),
    [id],
  );
}

export function useProductCategories() {
  return useAsync(() => productsApi.categories(), []);
}

// ─────────────────────────────────────────────
// Customers
// ─────────────────────────────────────────────

export function useCustomers(params?: QueryParams & { area_code?: string }) {
  return useAsync(() => customersApi.list(params), [JSON.stringify(params)]);
}

// ─────────────────────────────────────────────
// Inventory
// ─────────────────────────────────────────────

export function useInventorySnapshots(
  params?: QueryParams & { search?: string },
) {
  return useAsync(
    () => inventoryApi.listSnapshots(params),
    [JSON.stringify(params)],
  );
}

export function useInventoryLines(
  snapshotId: string | null,
  params?: QueryParams & { branch?: string; search?: string },
) {
  return useAsync(
    () =>
      snapshotId
        ? inventoryApi.getLines(snapshotId, params)
        : Promise.resolve(null as any),
    [snapshotId, JSON.stringify(params)],
  );
}

export function useInventoryDates() {
  return useAsync(() => inventoryApi.dates(), []);
}

export function useBranchSummary(params?: { snapshot_id?: string }) {
  return useAsync(
    () => inventoryApi.branchSummary(params),
    [JSON.stringify(params)],
  );
}

export function useCategoryBreakdown(params?: { snapshot_id?: string }) {
  return useAsync(
    () => inventoryApi.categoryBreakdown(params),
    [JSON.stringify(params)],
  );
}

// ─────────────────────────────────────────────
// Transactions
// ─────────────────────────────────────────────

export function useTransactions(
  params?: QueryParams & {
    /** Raw Arabic movement_type, e.g. MOVEMENT_TYPES.SALE */
    movement_type?: string;
    branch?: string;
    date_from?: string;
    date_to?: string;
  },
) {
  // FIX: normalise movement_type before sending to API
  const normalized = normalizeMovementType(params);
  return useAsync(
    () => transactionsApi.list(normalized),
    [JSON.stringify(normalized)],
  );
}

export function useTransactionSummary(params?: {
  year?: number;
  date_from?: string;
  date_to?: string;
}) {
  return useAsync(
    () => transactionsApi.summary(params),
    [JSON.stringify(params)],
  );
}

/**
 * Branch breakdown filtered by movement type.
 *
 * Pass a raw Arabic value as `movement_type`, e.g.:
 *   useBranchBreakdown({ movement_type: MOVEMENT_TYPES.SALE })
 *   useBranchBreakdown({ movement_type: MOVEMENT_TYPES.PURCHASE })
 *
 * If omitted, the backend defaults to the sale type.
 *
 * FIX: movement_type is trimmed before being sent to the API so that Excel
 * files that stored 'ف بيع ' (with trailing space) produce the same results
 * as files that stored 'ف بيع'.
 */
export function useBranchBreakdown(params?: {
  movement_type?: string;
  date_from?: string;
  date_to?: string;
}) {
  // FIX: normalise movement_type before sending to API
  const normalized = normalizeMovementType(params);
  return useAsync(
    () => transactionsApi.branchBreakdown(normalized),
    [JSON.stringify(normalized)],
  );
}

/**
 * Per-branch monthly revenue/profit chart data.
 *
 * FIX: movement_type is trimmed before being sent to the API — same reason
 * as useBranchBreakdown above.
 */
export function useBranchMonthly(params?: {
  movement_type?: string;
  year?: number;
  date_from?: string;
  date_to?: string;
}) {
  // FIX: normalise movement_type before sending to API
  const normalized = normalizeMovementType(params);
  return useAsync(
    () => transactionsApi.branchMonthly(normalized),
    [JSON.stringify(normalized)],
  );
}

export function useTypeBreakdown(params?: {
  date_from?: string;
  date_to?: string;
}) {
  return useAsync(
    () => transactionsApi.typeBreakdown(params),
    [JSON.stringify(params)],
  );
}

/**
 * Returns all distinct movement_type values (Arabic labels) present in the DB.
 * Use this to dynamically populate filter <Select> dropdowns on the frontend.
 */
export function useMovementTypes() {
  return useAsync(() => transactionsApi.movementTypes(), []);
}

// ─────────────────────────────────────────────
// Aging
// ─────────────────────────────────────────────

export function useAgingList(
  params?: QueryParams & { report_date?: string; risk?: string },
) {
  return useAsync(() => agingApi.list(params), [JSON.stringify(params)]);
}

export function useAgingDates() {
  return useAsync(() => agingApi.dates(), []);
}

export function useAgingRisk(params?: {
  report_date?: string;
  risk?: string;
  limit?: number;
}) {
  return useAsync(() => agingApi.risk(params), [JSON.stringify(params)]);
}

export function useAgingDistribution(params?: { report_date?: string }) {
  return useAsync(
    () => agingApi.distribution(params),
    [JSON.stringify(params)],
  );
}

// ─────────────────────────────────────────────
// KPIs (aggregated)
// ─────────────────────────────────────────────

export function useKPIs() {
  return useAsync(() => kpiApi.getAll(), []);
}

// ─────────────────────────────────────────────
// Re-exports
// ─────────────────────────────────────────────

export type {
  Product,
  Customer,
  InventorySnapshot,
  InventorySnapshotLine,
  InventoryLinesResponse,
  Movement,
  AgingRecord,
  AgingRiskItem,
  AgingDistributionItem,
  MonthlySummaryItem,
  BranchSummary,
  CategoryBreakdown,
  KPIData,
  QueryParams,
};

export { MOVEMENT_TYPES };

export interface AgingRow {
  id: string;
  account: string;
  account_code: string;
  customer_name: string | null;
  report_date: string;
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

export interface AgingReportResponse {
  report_date: string | null;
  count: number;
  results: AgingRow[];
}

export interface AgingDatesResponse {
  dates: string[];
}

export function useAgingReport(params?: {
  report_date?: string;
  limit?: number;
}) {
  const result = useAgingList({
    report_date: params?.report_date,
    page_size: params?.limit ?? 500,
  });

  const data: AgingReportResponse | null = result.data
    ? {
        report_date: result.data.report_date,
        count: result.data.count,
        results: (result.data as any).records ?? [],
      }
    : null;

  return {
    data,
    loading: result.loading,
    error: result.error,
    refetch: result.refetch,
  };
}

export function useSalesKPI(params?: {
  year?: number;
  date_from?: string;
  date_to?: string;
  top_n?: number;
}) {
  return useAsync(() => salesKpiApi.getAll(params), [JSON.stringify(params)]);
}

export function useStockKPI(params?: {
  snapshot_date?: string;
  year?: number;
  low_rotation_threshold?: number;
}) {
  return useAsync(() => stockKpiApi.getAll(params), [JSON.stringify(params)]);
}

export function useCreditKPI(params?: { report_date?: string }) {
  return useAsync(() => creditKpiApi.getAll(params), [JSON.stringify(params)]);
}

// Also re-export the new types for convenience:
export type { SalesKPIData, StockKPIData, CreditKPIData };