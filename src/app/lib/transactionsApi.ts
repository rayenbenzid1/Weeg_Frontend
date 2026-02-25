// src/lib/api/transactionsApi.ts

import axios from 'axios';

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
  movement_type?: string;
  movement_type__in?: string;
  branch?: string;
  product?: string;
  date_from?: string;
  date_to?: string;
  [key: string]: any;
}

export interface TransactionBase {
  id: string;                     // UUID
  date: string;                   // ISO date
  movement_type: string;          // "sale", "purchase", "opening_balance", etc.
  movement_type_display?: string;
  material_code: string;
  material_name: string;
  quantity: number;
  unit_price?: number;
  total: number;
  product?: string;               // UUID
  product_name?: string;
  branch?: string;                // UUID
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
// Utilitaires internes (indépendants)
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
// Configuration de base (axios instance)
// ─────────────────────────────────────────────

const api = axios.create({
  baseURL: '/api', // ou import.meta.env.VITE_API_URL
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Ajout automatique du token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fasi_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Gestion des erreurs globale
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
// Transactions API (indépendante)
// ─────────────────────────────────────────────

export const transactionsApi = {
  /**
   * Liste des mouvements (tous types)
   * GET /api/transactions/movements/
   */
  listMovements: async (params?: QueryParams): Promise<PaginatedResponse<TransactionBase>> => {
    const query = buildQueryString(params);
    const response = await api.get<PaginatedResponse<TransactionBase>>(`/transactions/movements/${query}`);
    return response.data;
  },

  /**
   * Liste filtrée sur les ventes
   */
  listSales: async (params?: QueryParams): Promise<PaginatedResponse<Sale>> => {
    const query = buildQueryString({
      ...params,
      movement_type__in: 'sale,sales_return',
      ordering: params?.ordering || '-movement_date',
    });
    const response = await api.get<PaginatedResponse<Sale>>(`/transactions/movements/${query}`);
    return {
      ...response.data,
      results: response.data.results.map(item => ({ ...item, type: 'sale' as const })),
    };
  },

  /**
   * Liste filtrée sur les achats
   */
  listPurchases: async (params?: QueryParams): Promise<PaginatedResponse<Purchase>> => {
    const query = buildQueryString({
      ...params,
      movement_type__in: 'purchase,purchase_return,main_entry',
      ordering: params?.ordering || '-movement_date',
    });
    const response = await api.get<PaginatedResponse<Purchase>>(`/transactions/movements/${query}`);
    return {
      ...response.data,
      results: response.data.results.map(item => ({ ...item, type: 'purchase' as const })),
    };
  },

  /**
   * Récupérer une transaction unique
   */
  getTransaction: async (id: string): Promise<Transaction> => {
    const response = await api.get<Transaction>(`/transactions/movements/${id}/`);
    const data = response.data;
    
    // Ajout du type côté client
    if (['sale', 'sales_return'].includes(data.movement_type)) {
      return { ...data, type: 'sale' as const };
    } else {
      return { ...data, type: 'purchase' as const };
    }
  },

  /**
   * Statistiques sommaires (optionnel - si tu ajoutes un endpoint dédié)
   */
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
};