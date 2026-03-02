// src/lib/api/transactionsApi.ts
// NOTE: movement_type values are raw Arabic labels as stored in the DB.
// Never use old English enum strings ('sale', 'purchase', etc.) with the backend.

import axios from 'axios';
import {
  MOVEMENT_TYPES,
  SALE_TYPES,
  PURCHASE_TYPES,
  isSaleType,
  isPurchaseType,
} from './dataApi';

// ─────────────────────────────────────────────
// Re-export constants for convenience
// ─────────────────────────────────────────────

export { MOVEMENT_TYPES, SALE_TYPES, PURCHASE_TYPES };

// ─────────────────────────────────────────────
// Types / Interfaces
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
  /** Raw Arabic movement_type value, e.g. "ف بيع" */
  movement_type?: string;
  /** Comma-separated Arabic movement_type values for multi-type filtering */
  movement_type__in?: string;
  branch?: string;
  product?: string;
  date_from?: string;
  date_to?: string;
  [key: string]: any;
}

export interface TransactionBase {
  id: string;
  date: string;
  /** Raw Arabic movement_type value, e.g. "ف بيع" */
  movement_type: string;
  /** Friendly English label returned by the serializer */
  movement_type_display?: string;
  material_code: string;
  material_name: string;
  quantity: number;
  unit_price?: number;
  total: number;
  product?: string;
  product_name?: string;
  branch?: string;
  branch_name?: string;
  customer?: string | null;
  customer_name?: string | null;
  company?: string;
  company_name?: string;
}

export interface Sale extends TransactionBase {
  type: 'sale';
  invoice_number?: string;
}

export interface Purchase extends TransactionBase {
  type: 'purchase';
  invoice_number?: string;
}

export type Transaction = Sale | Purchase;

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

function buildQueryString(params?: QueryParams): string {
  if (!params) return '';
  const filtered = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (!filtered.length) return '';

  const searchParams = new URLSearchParams();
  filtered.forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(v => searchParams.append(key, String(v)));
    } else {
      searchParams.append(key, String(value));
    }
  });

  return '?' + searchParams.toString();
}

// ─────────────────────────────────────────────
// Axios instance
// ─────────────────────────────────────────────

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fasi_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'An error occurred';
    return Promise.reject(new Error(message));
  }
);

// ─────────────────────────────────────────────
// Transactions API
// ─────────────────────────────────────────────

export const transactionsApi = {
  /**
   * All movements (all types)
   */
  listMovements: async (params?: QueryParams): Promise<PaginatedResponse<TransactionBase>> => {
    const query = buildQueryString(params);
    const response = await api.get<PaginatedResponse<TransactionBase>>(`/transactions/movements/${query}`);
    return response.data;
  },

  /**
   * Movements filtered to sale types ("ف بيع" and "مردودات بيع")
   */
  listSales: async (params?: QueryParams): Promise<PaginatedResponse<Sale>> => {
    const query = buildQueryString({
      ...params,
      // Pass Arabic values joined by comma for multi-type filtering
      movement_type__in: SALE_TYPES.join(','),
      ordering: params?.ordering || '-movement_date',
    });
    const response = await api.get<PaginatedResponse<Sale>>(`/transactions/movements/${query}`);
    return {
      ...response.data,
      results: response.data.results.map(item => ({ ...item, type: 'sale' as const })),
    };
  },

  /**
   * Movements filtered to purchase types ("ف شراء", "مردودات شراء", "ادخال رئيسي")
   */
  listPurchases: async (params?: QueryParams): Promise<PaginatedResponse<Purchase>> => {
    const query = buildQueryString({
      ...params,
      movement_type__in: PURCHASE_TYPES.join(','),
      ordering: params?.ordering || '-movement_date',
    });
    const response = await api.get<PaginatedResponse<Purchase>>(`/transactions/movements/${query}`);
    return {
      ...response.data,
      results: response.data.results.map(item => ({ ...item, type: 'purchase' as const })),
    };
  },

  /**
   * Single transaction. Type is inferred from the raw Arabic movement_type.
   */
  getTransaction: async (id: string): Promise<Transaction> => {
    const response = await api.get<TransactionBase>(`/transactions/movements/${id}/`);
    const data = response.data;

    if (isSaleType(data.movement_type)) {
      return { ...data, type: 'sale' as const };
    } else {
      return { ...data, type: 'purchase' as const };
    }
  },

  getSummary: async (params?: { date_from?: string; date_to?: string; branch?: string }) => {
    const query = buildQueryString(params);
    const response = await api.get<{
      total_sales: number;
      total_purchases: number;
      transaction_count: number;
      avg_transaction: number;
    }>(`/transactions/summary/${query}`);
    return response.data;
  },

  /**
   * Returns all distinct movement_type values (Arabic) present in DB for this company.
   * Use for dynamic dropdown population.
   */
  getMovementTypes: async (): Promise<string[]> => {
    const response = await api.get<{ movement_types: string[] }>('/transactions/movement-types/');
    return response.data.movement_types;
  },
};