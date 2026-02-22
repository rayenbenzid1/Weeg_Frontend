/**
 * FASI Auth API
 * URLs mappées exactement sur config/urls.py :
 *
 *   /api/auth/      → apps.token_security  (JWT login, refresh, blacklist)
 *   /api/users/     → apps.authentication  (profile, agents, users, signup...)
 *   /api/companies/ → apps.companies       (gestion des sociétés)
 */

import { api, apiFetch, TokenStorage } from './api';


// ─────────────────────────────────────────────
// Types (matching Django serializers)
// ─────────────────────────────────────────────

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
}

export interface BackendUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone_number: string | null;
  role: 'admin' | 'manager' | 'agent';
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'suspended';
  permissions_list: string[];
  branch: string | null;
  branch_name: string | null;
  company: string | null;
  company_name: string | null;
  must_change_password: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface ManagerSignupPayload {
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  company_name: string;          // ← nouveau champ obligatoire
  password: string;
  password_confirm: string;
}

export interface CreateAgentPayload {
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  branch?: string;
  permissions_list: string[];
  temporary_password: string;
  // NB: company est automatiquement hérité du manager côté backend
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
  new_password_confirm: string;
}

export interface UpdateProfilePayload {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
}

export interface ApproveRejectPayload {
  action: 'approve' | 'reject';
  reason?: string;
}

export interface UserListItem {
  id: string;
  email: string;
  full_name: string;
  phone_number: string | null;
  role: string;
  status: string;
  branch_name: string | null;
  company: string | null;
  company_name: string | null;
  created_at: string;
  permissions_list: string[];
}

export interface PendingManagersResponse {
  count: number;
  pending_managers: UserListItem[];
}

export interface AgentListResponse {
  count: number;
  agents: UserListItem[];
}

export interface Company {
  id: string;
  name: string;
  industry: string | null;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
}

// ─────────────────────────────────────────────
// Auth Service
// ─────────────────────────────────────────────

export const authApi = {

  // ── JWT (token_security app → /api/auth/) ──────────────────────────────

  login: async (payload: LoginPayload): Promise<LoginResponse> => {
    return apiFetch<LoginResponse>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
    });
  },

  logout: async (): Promise<void> => {
    const refresh = TokenStorage.getRefresh();
    const access = TokenStorage.getAccess();
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

    if (refresh) {
      try {
        await fetch(`${API_BASE}/auth/logout/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(access ? { Authorization: `Bearer ${access}` } : {}),
          },
          body: JSON.stringify({ refresh }),
        });
      } catch {
        // réseau mort — logout local garanti
      }
    }

    TokenStorage.clear();
  },

  // ── Profile (authentication app → /api/users/) ─────────────────────────

  getProfile: (): Promise<BackendUser> =>
    api.get<BackendUser>('/users/profile/'),

  updateProfile: (data: UpdateProfilePayload) =>
    api.patch<{ message: string; user: BackendUser }>('/users/profile/', data),

  // ── Signup Manager ──────────────────────────────────────────────────────

  /**
   * POST /api/users/signup/
   * Inclut maintenant le champ company_name.
   */
  managerSignup: (payload: ManagerSignupPayload) =>
    apiFetch<{ message: string; email: string }>('/users/signup/', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
    }),

  // ── Password ────────────────────────────────────────────────────────────

  changePassword: (payload: ChangePasswordPayload) =>
    api.post<{ message: string }>('/users/change-password/', payload),

  requestPasswordReset: (user_id: string) =>
    api.post<{ message: string }>('/users/password-reset/request/', { user_id }),

  confirmPasswordReset: (token: string, new_password: string, new_password_confirm: string) =>
    apiFetch<{ message: string }>('/users/password-reset/confirm/', {
      method: 'POST',
      body: JSON.stringify({ token, new_password, new_password_confirm }),
      skipAuth: true,
    }),

  // ── Manager approval ────────────────────────────────────────────────────

  getPendingManagers: (): Promise<PendingManagersResponse> =>
    api.get<PendingManagersResponse>('/users/signup/pending/'),

  reviewManager: (managerId: string, payload: ApproveRejectPayload) =>
    api.post<{ message: string; manager: UserListItem }>(
      `/users/signup/review/${managerId}/`,
      payload
    ),

  // ── Agents ──────────────────────────────────────────────────────────────

  getAgents: (): Promise<AgentListResponse> =>
    api.get<AgentListResponse>('/users/agents/'),

  createAgent: (payload: CreateAgentPayload) =>
    api.post<{ message: string; agent: UserListItem }>('/users/agents/create/', payload),

  deleteAgent: (agentId: string) =>
    api.delete<{ message: string }>(`/users/agents/${agentId}/`),

  // ── All Users (admin) ───────────────────────────────────────────────────

  getAllUsers: (filters?: { role?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.role) params.set('role', filters.role);
    if (filters?.status) params.set('status', filters.status);
    const qs = params.toString();
    return api.get<{ count: number; users: UserListItem[] }>(
      `/users/users/${qs ? '?' + qs : ''}`
    );
  },

  updatePermissions: (userId: string, permissions_list: string[]) =>
    api.patch<{ message: string; permissions_list: string[] }>(
      `/users/users/${userId}/permissions/`,
      { permissions_list }
    ),

  updateStatus: (userId: string, status: 'active' | 'suspended', reason?: string) =>
    api.patch<{ message: string }>(
      `/users/users/${userId}/status/`,
      { status, reason }
    ),

  // ── Companies (admin) ───────────────────────────────────────────────────

  getCompanies: (): Promise<{ count: number; companies: Company[] }> =>
    api.get('/companies/'),

  createCompany: (data: Partial<Company>) =>
    api.post<Company>('/companies/', data),

  updateCompany: (companyId: string, data: Partial<Company>) =>
    api.patch<Company>(`/companies/${companyId}/`, data),
};
