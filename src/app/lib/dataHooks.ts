import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiError,api } from './api';
import {
  productsApi,
  customersApi,
  inventoryApi,

  transactionsApi,
  agingApi,
  kpiApi,
  type Product,
  type Customer,
  type InventoryItem,
  type Movement,
  type AgingRecord,
  type AgingRiskItem,
  type AgingDistributionItem,
  type MonthlySummaryItem,
  type BranchSummary,
  type CategoryBreakdown,
  type KPIData,
  type QueryParams,
} from './dataApi';

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
  deps: unknown[] = []
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
    return () => { mountedRef.current = false; };
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
    [id]
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

export function useInventory(params?: QueryParams & { snapshot_date?: string; category?: string }) {
  return useAsync(() => inventoryApi.list(params), [JSON.stringify(params)]);
}

export function useInventoryDates() {
  return useAsync(() => inventoryApi.dates(), []);
}

export function useBranchSummary(params?: { snapshot_date?: string; category?: string }) {
  return useAsync(
    () => inventoryApi.branchSummary(params),
    [JSON.stringify(params)]
  );
}

export function useCategoryBreakdown(params?: { snapshot_date?: string }) {
  return useAsync(
    () => inventoryApi.categoryBreakdown(params),
    [JSON.stringify(params)]
  );
}

// ─────────────────────────────────────────────
// Transactions
// ─────────────────────────────────────────────

export function useTransactions(
  params?: QueryParams & {
    movement_type?: string;
    branch?: string;
    date_from?: string;
    date_to?: string;
  }
) {
  return useAsync(
    () => transactionsApi.list(params),
    [JSON.stringify(params)]
  );
}

export function useTransactionSummary(params?: { year?: number }) {
  return useAsync(
    () => transactionsApi.summary(params),
    [JSON.stringify(params)]
  );
}

export function useBranchBreakdown(params?: { movement_type?: string; date_from?: string; date_to?: string }) {
  return useAsync(
    () => transactionsApi.branchBreakdown(params),
    [JSON.stringify(params)]
  );
}

export function useTypeBreakdown(params?: { date_from?: string; date_to?: string }) {
  return useAsync(
    () => transactionsApi.typeBreakdown(params),
    [JSON.stringify(params)]
  );
}

// ─────────────────────────────────────────────
// Aging
// ─────────────────────────────────────────────

export function useAgingList(params?: QueryParams & { report_date?: string; risk?: string }) {
  return useAsync(
    () => agingApi.list(params),
    [JSON.stringify(params)]
  );
}

export function useAgingDates() {
  return useAsync(() => agingApi.dates(), []);
}

export function useAgingRisk(params?: { report_date?: string; risk?: string; limit?: number }) {
  return useAsync(
    () => agingApi.risk(params),
    [JSON.stringify(params)]
  );
}

export function useAgingDistribution(params?: { report_date?: string }) {
  return useAsync(
    () => agingApi.distribution(params),
    [JSON.stringify(params)]
  );
}

// ─────────────────────────────────────────────
// KPIs (aggregated)
// ─────────────────────────────────────────────

export function useKPIs() {
  return useAsync(() => kpiApi.getAll(), []);
}

// ─────────────────────────────────────────────
// Re-exports of types for use in pages
// ─────────────────────────────────────────────

export type {
  Product,
  Customer,
  InventoryItem,
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
  risk_score: 'low' | 'medium' | 'high' | 'critical';
}

export interface AgingReportResponse {
  report_date: string | null;
  count: number;
  results: AgingRow[];   // ← nom utilisé par AgingReceivablePage
}

export interface AgingDatesResponse {
  dates: string[];
}

// ── useAgingReport ────────────────────────────────────────────────────────────
// Utilise agingApi.list() qui appelle /aging/ (route qui existe)
// et mappe "records" → "results" pour AgingReceivablePage

export function useAgingReport(params?: {
  report_date?: string;
  limit?: number;
}) {
  // agingApi.list() est déjà défini dans dataApi.ts → appelle /aging/
  const result = useAgingList({
    report_date: params?.report_date,
    page_size: params?.limit ?? 500, 
  } );

  const data: AgingReportResponse | null = result.data
    ? {
        report_date: result.data.report_date,
        count: result.data.count,
        results: (result.data as any).records ?? [],  // map records → results
      }
    : null;

  return {
    data,
    loading: result.loading,
    error: result.error,
    refetch: result.refetch,
  };
}