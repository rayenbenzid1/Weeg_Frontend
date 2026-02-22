/**
 * FASI Data Hooks
 * Custom React hooks that wrap the data API with loading, error, and refetch state.
 * Drop-in replacement for components currently using mockData.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiError } from './api';
import {
  productsApi, branchesApi, customersApi, transactionsApi, inventoryApi,
  kpiApi, alertsApi, agingApi,
  type Product, type Branch, type Customer, type Sale, type Purchase,
  type InventoryItem, type KPIData, type MonthlySalesData, type Alert,
  type AgingReceivable, type AgingDistribution, type TopProduct,
  type BranchPerformance, type PaginatedResponse, type QueryParams,
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
        setError(err instanceof ApiError ? err.userMessage : String(err));
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

export function useProducts(params?: QueryParams) {
  return useAsync<PaginatedResponse<Product>>(
    () => productsApi.list(params),
    [JSON.stringify(params)]
  );
}

export function useProduct(id: string) {
  return useAsync<Product>(
    () => productsApi.get(id),
    [id]
  );
}

// ─────────────────────────────────────────────
// Branches
// ─────────────────────────────────────────────

export function useBranches() {
  return useAsync<PaginatedResponse<Branch>>(
    () => branchesApi.list(),
    []
  );
}

// ─────────────────────────────────────────────
// Customers
// ─────────────────────────────────────────────

export function useCustomers(params?: QueryParams) {
  return useAsync<PaginatedResponse<Customer>>(
    () => customersApi.list(params),
    [JSON.stringify(params)]
  );
}

// ─────────────────────────────────────────────
// Sales & Purchases
// ─────────────────────────────────────────────

export function useSales(params?: QueryParams) {
  return useAsync<PaginatedResponse<Sale>>(
    () => transactionsApi.listSales(params),
    [JSON.stringify(params)]
  );
}

export function usePurchases(params?: QueryParams) {
  return useAsync<PaginatedResponse<Purchase>>(
    () => transactionsApi.listPurchases(params),
    [JSON.stringify(params)]
  );
}

// ─────────────────────────────────────────────
// Inventory
// ─────────────────────────────────────────────

export function useInventory(params?: QueryParams) {
  return useAsync<PaginatedResponse<InventoryItem>>(
    () => inventoryApi.list(params),
    [JSON.stringify(params)]
  );
}

// ─────────────────────────────────────────────
// KPI
// ─────────────────────────────────────────────

export function useKPIs(params?: { branch?: string; date_from?: string; date_to?: string }) {
  return useAsync<KPIData>(
    () => kpiApi.getKPIs(params),
    [JSON.stringify(params)]
  );
}

export function useMonthlySales(months?: number) {
  return useAsync<MonthlySalesData[]>(
    () => kpiApi.getMonthlySales({ months }),
    [months]
  );
}

export function useAgingDistribution() {
  return useAsync<AgingDistribution[]>(
    () => kpiApi.getAgingDistribution(),
    []
  );
}

export function useTopProducts(limit?: number) {
  return useAsync<TopProduct[]>(
    () => kpiApi.getTopProducts({ limit }),
    [limit]
  );
}

export function useBranchPerformance() {
  return useAsync<BranchPerformance[]>(
    () => kpiApi.getBranchPerformance(),
    []
  );
}

// ─────────────────────────────────────────────
// Alerts
// ─────────────────────────────────────────────

export function useAlerts(params?: QueryParams & { status?: string; severity?: string }) {
  const state = useAsync<PaginatedResponse<Alert>>(
    () => alertsApi.list(params),
    [JSON.stringify(params)]
  );

  const resolveAlert = useCallback(async (id: string) => {
    await alertsApi.resolve(id);
    state.refetch();
  }, [state]);

  return { ...state, resolveAlert };
}

// ─────────────────────────────────────────────
// Aging Receivables
// ─────────────────────────────────────────────

export function useAgingReceivables(params?: QueryParams & { customer?: string; min_days?: number }) {
  return useAsync<PaginatedResponse<AgingReceivable>>(
    () => agingApi.list(params),
    [JSON.stringify(params)]
  );
}

export function useTopRiskyCustomers() {
  return useAsync<{ customer_id: string; customer_name: string; total_overdue: number; days_overdue: number; risk_score: number }[]>(
    () => agingApi.getTopRisky(),
    []
  );
}