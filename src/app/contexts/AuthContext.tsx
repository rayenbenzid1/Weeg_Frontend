import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { authApi, BackendUser, type UserListItem } from '../lib/authApi';
import { TokenStorage, ApiError } from '../lib/api';

export type UserRole = 'admin' | 'manager' | 'agent';

export interface Permission {
  id: string;
  label: string;
  description: string;
  category: 'data' | 'analytics' | 'sales' | 'system';
}

export const AVAILABLE_PERMISSIONS: Permission[] = [
  { id: 'import-data',            label: 'Import Data',             description: 'Import Excel files into the database',        category: 'data' },
  { id: 'export-data',            label: 'Export Data',             description: 'Export data to Excel/CSV files',              category: 'data' },
  { id: 'view-dashboard',         label: 'View Dashboard',          description: 'Access main dashboard with KPIs',             category: 'analytics' },
  { id: 'view-reports',           label: 'View Reports',            description: 'Access and view all reports',                 category: 'analytics' },
  { id: 'generate-reports',       label: 'Generate Reports',        description: 'Create and generate custom reports',          category: 'analytics' },
  { id: 'view-kpi',               label: 'View KPIs',               description: 'Access KPI Engine and metrics',               category: 'analytics' },
  { id: 'filter-dashboard',       label: 'Filter Dashboard',        description: 'Apply filters to dashboard data',             category: 'analytics' },
  { id: 'view-sales',             label: 'View Sales',              description: 'Access sales and purchases data',             category: 'sales' },
  { id: 'view-inventory',         label: 'View Inventory',          description: 'Check product availability and stock levels', category: 'sales' },
  { id: 'view-customer-payments', label: 'View Customer Payments',  description: 'Access customer payment history',             category: 'sales' },
  { id: 'view-aging',             label: 'View Aging Receivables',  description: 'Track overdue payments and receivables',      category: 'sales' },
  { id: 'receive-notifications',  label: 'Receive Notifications',   description: 'Get notified about important events',         category: 'system' },
  { id: 'manage-alerts',          label: 'Manage Alerts',           description: 'Mark alerts as resolved',                    category: 'system' },
  { id: 'view-profile',           label: 'View Profile',            description: 'Access personal profile',                    category: 'system' },
  { id: 'change-password',        label: 'Change Password',         description: 'Update account password',                    category: 'system' },
  { id: 'ai-insights',            label: 'AI Insights',             description: 'Access AI-powered insights and chat',         category: 'analytics' },
];

export const DEFAULT_AGENT_PERMISSIONS: string[] = [
  'import-data', 'view-dashboard', 'view-reports', 'generate-reports',
  'view-kpi', 'filter-dashboard', 'view-sales', 'view-inventory',
  'view-customer-payments', 'receive-notifications', 'manage-alerts',
  'view-profile', 'change-password',
];

export const DEFAULT_MANAGER_PERMISSIONS: string[] = AVAILABLE_PERMISSIONS.map(p => p.id);

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: string[];
  isVerified: boolean;
  createdAt: string;
  mustChangePassword?: boolean;
  branchId?: string | null;
  branchName?: string | null;
  companyId?: string | null;
  companyName?: string | null;
}

function mapBackendUser(backendUser: BackendUser): User {
  return {
    id: backendUser.id,
    name: backendUser.full_name || `${backendUser.first_name} ${backendUser.last_name}`.trim(),
    email: backendUser.email,
    role: backendUser.role,
    permissions: backendUser.permissions_list,
    isVerified: backendUser.is_verified,
    createdAt: backendUser.created_at,
    mustChangePassword: backendUser.must_change_password,
    branchId: backendUser.branch,
    branchName: backendUser.branch_name,
    companyId: backendUser.company,
    companyName: backendUser.company_name,
  };
}

function mapListItem(item: UserListItem): User {
  return {
    id: item.id,
    name: item.full_name,
    email: item.email,
    role: item.role as UserRole,
    permissions: item.permissions_list ?? [],
    isVerified: item.status !== 'pending',
    createdAt: item.created_at,
    branchName: item.branch_name,
    companyId: item.company,
    companyName: item.company_name,
  };
}

interface SignupData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  companyName: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  users: User[];
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  signup: (userData: SignupData) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  verifyManager: (userId: string) => Promise<void>;
  rejectManager: (userId: string, reason?: string) => Promise<void>;
  createAgent: (userData: {
    name: string;
    email: string;
    role: string;
    permissions: string[];
    branchId?: string;
    tempPassword?: string;
  }) => Promise<void>;
  updateUserPermissions: (userId: string, permissions: string[]) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchUserList(role: UserRole, setUsers: (u: User[]) => void) {
  try {
    if (role === 'admin') {
      const res = await authApi.getAllUsers();
      setUsers(res.users.map(mapListItem));
    } else if (role === 'manager') {
      const res = await authApi.getAgents();
      setUsers(res.agents.map(mapListItem));
    }
  } catch {
    // non-critical
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('fasi_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) localStorage.setItem('fasi_user', JSON.stringify(user));
    else localStorage.removeItem('fasi_user');
  }, [user]);

  useEffect(() => {
    const token = TokenStorage.getAccess();
    if (!token) return;

    authApi.getProfile()
      .then(async profile => {
        const mappedUser = mapBackendUser(profile);
        setUser(mappedUser);
        await fetchUserList(mappedUser.role, setUsers);
      })
      .catch(() => {
        TokenStorage.clear();
        setUser(null);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── LOGIN ──────────────────────────────────────────────────────────────
  const login = async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    try {
      const response = await authApi.login({ email, password });
      TokenStorage.setTokens(response.access, response.refresh);
      const profile = await authApi.getProfile();
      const mappedUser = mapBackendUser(profile);
      setUser(mappedUser);
      await fetchUserList(mappedUser.role, setUsers);
      return { success: true, message: 'Connexion réussie' };
    } catch (err) {
      TokenStorage.clear();
      if (err instanceof ApiError) {
        if (err.status === 401) return { success: false, message: 'Email ou mot de passe incorrect' };
        if (err.status === 403) return { success: false, message: 'Votre compte est en attente de validation' };
        return { success: false, message: err.userMessage };
      }
      return { success: false, message: 'Erreur de connexion' };
    } finally {
      setIsLoading(false);
    }
  };

  // ── SIGNUP ─────────────────────────────────────────────────────────────
  const signup = async (userData: SignupData): Promise<{ success: boolean; message: string }> => {
    if (userData.role !== 'manager') {
      return { success: false, message: "Seuls les managers peuvent s'inscrire via ce formulaire" };
    }
    if (!userData.companyName?.trim()) {
      return { success: false, message: 'Le nom de la société est obligatoire.' };
    }
    setIsLoading(true);
    try {
      const nameParts = userData.name.trim().split(' ');
      const first_name = nameParts[0] || userData.name;
      const last_name = nameParts.slice(1).join(' ') || first_name; // fallback: repeat first name
      await authApi.managerSignup({
        email: userData.email,
        first_name,
        last_name,
        phone_number: userData.phone,
        company_name: userData.companyName.trim(),
        password: userData.password,
        password_confirm: userData.password,
      });
      return { success: true, message: "Compte créé ! En attente de vérification par l'admin." };
    } catch (err) {
      return { success: false, message: err instanceof ApiError ? err.userMessage : "Erreur lors de l'inscription" };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    setUsers([]);
  };

  const verifyManager = async (userId: string) => {
    await authApi.reviewManager(userId, { action: 'approve' });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, isVerified: true } : u));
  };

  const rejectManager = async (userId: string, reason = 'Demande rejetée') => {
    await authApi.reviewManager(userId, { action: 'reject', reason });
    setUsers(prev => prev.filter(u => u.id !== userId));
  };

  // ── CREATE AGENT ───────────────────────────────────────────────────────
  const createAgent = async (userData: {
    name: string;
    email: string;
    role: string;
    permissions: string[];
    branchId?: string;
    tempPassword?: string;
  }) => {
    const nameParts = userData.name.trim().split(' ');
    const first_name = nameParts[0] || userData.name;
    const last_name = nameParts.slice(1).join(' ') || first_name; // ← fix: never send empty string

    const payload = {
      email: userData.email,
      first_name,
      last_name,
      ...(userData.branchId ? { branch: userData.branchId } : {}),
      permissions_list: userData.permissions,
      temporary_password: userData.tempPassword || 'Agent@123456',
    };

    try {
      const res = await authApi.createAgent(payload);
      setUsers(prev => [...prev, mapListItem(res.agent)]);
    } catch (err) {
      console.error('[createAgent] Erreur →', (err as { data?: unknown })?.data ?? err);
      throw err;
    }
  };

  const updateUserPermissions = async (userId: string, permissions: string[]) => {
    await authApi.updatePermissions(userId, permissions);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, permissions } : u));
    if (user?.id === userId) setUser({ ...user, permissions });
  };

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await authApi.getProfile();
      setUser(mapBackendUser(profile));
    } catch { /* ignore */ }
  }, []);

  return (
    <AuthContext.Provider value={{
      user, users, isLoading,
      login, signup, logout,
      verifyManager, rejectManager,
      createAgent, updateUserPermissions,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}