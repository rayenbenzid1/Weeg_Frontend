import { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import {
  Check, X, Mail, Calendar, User as UserIcon, Building2,
  Loader2, RefreshCw, Ban, UserCheck, Filter,
  Globe, MapPin, Server, Briefcase,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ManagerUser {
  id: string;
  email: string;
  full_name: string;
  phone_number: string | null;
  role: string;
  status: string;
  company: string | null;
  company_name: string | null;
  // ✅ NEW company fields
  company_industry?: string | null;
  company_country?: string | null;
  company_city?: string | null;
  company_current_erp?: string | null;
  created_at: string;
  permissions_list: string[];
}

// ---------------------------------------------------------------------------
// RejectModal
// ---------------------------------------------------------------------------

function RejectModal({
  manager, onConfirm, onCancel, isLoading,
}: {
  manager: ManagerUser;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <X className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Reject request</h3>
            <p className="text-sm text-muted-foreground">{manager.full_name}</p>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Reason for rejection <span className="text-red-500">*</span></label>
          <textarea
            className="w-full min-h-[100px] rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Explain the reason for rejection..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="flex gap-2">
          <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            onClick={() => onConfirm(reason)} disabled={isLoading || !reason.trim()}>
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Rejecting...</> : <><X className="h-4 w-4 mr-2" />Confirm</>}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SuspendModal
// ---------------------------------------------------------------------------

function SuspendModal({
  user, onConfirm, onCancel, isLoading,
}: {
  user: ManagerUser;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
            <Ban className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Suspend account</h3>
            <p className="text-sm text-muted-foreground">{user.full_name}</p>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Reason (optional)</label>
          <textarea
            className="w-full min-h-[80px] rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Reason for suspension..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="flex gap-2">
          <Button className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
            onClick={() => onConfirm(reason)} disabled={isLoading}>
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />...</> : <><Ban className="h-4 w-4 mr-2" />Suspend</>}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending: 'Pending', active: 'Approved', approved: 'Approved',
    suspended: 'Suspended', rejected: 'Rejected',
  };
  return map[status] ?? status;
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    active:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    approved:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    rejected:  'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
};

const roleBadge = (role: string) => {
  const map: Record<string, string> = {
    manager: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    agent:   'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    admin:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  };
  return map[role] ?? 'bg-gray-100 text-gray-600';
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

// ---------------------------------------------------------------------------
// Tabs config
// ---------------------------------------------------------------------------

type TabId = 'pending' | 'managers' | 'agents' | 'suspended' | 'all';

const TABS: { id: TabId; label: string; url: string }[] = [
  { id: 'pending',   label: 'Pending',   url: '/users/users/?status=pending'   },
  { id: 'managers',  label: 'Managers',  url: '/users/users/?role=manager'     },
  { id: 'agents',    label: 'Agents',    url: '/users/users/?role=agent'       },
  { id: 'suspended', label: 'Suspended', url: '/users/users/?status=suspended' },
  { id: 'all',       label: 'All',       url: '/users/users/'                  },
];

// ---------------------------------------------------------------------------
// CompanyBadge — inline company info pills
// ---------------------------------------------------------------------------

function CompanyInfo({ user }: { user: ManagerUser }) {
  const items = [
    user.company_name     && { icon: <Building2 className="h-3 w-3" />, label: user.company_name },
    user.company_industry && { icon: <Briefcase  className="h-3 w-3" />, label: user.company_industry },
    user.company_country  && user.company_city
      ? { icon: <MapPin className="h-3 w-3" />, label: `${user.company_city}, ${user.company_country}` }
      : user.company_country
        ? { icon: <Globe className="h-3 w-3" />, label: user.company_country }
        : null,
    user.company_current_erp && { icon: <Server className="h-3 w-3" />, label: `ERP: ${user.company_current_erp}` },
  ].filter(Boolean) as { icon: React.ReactNode; label: string }[];

  if (items.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span key={i}
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300 border border-sky-100 dark:border-sky-800">
          {item.icon}
          {item.label}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function AdminVerificationPage() {
  const [activeTab, setActiveTab]         = useState<TabId>('pending');
  const [users, setUsers]                 = useState<ManagerUser[]>([]);
  const [isLoading, setIsLoading]         = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget]   = useState<ManagerUser | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<ManagerUser | null>(null);

  const fetchUsers = useCallback(async (tab: TabId) => {
    setIsLoading(true);
    try {
      const url = TABS.find(t => t.id === tab)?.url ?? '/users/users/';
      const res = await api.get(url) as any;

      let list: ManagerUser[] = Array.isArray(res)
        ? res
        : res?.users ?? res?.pending_managers ?? res?.data ?? [];

      if (tab === 'all')      list = list.filter(u => u.status !== 'rejected');
      if (tab === 'managers') list = list.filter(u => u.status === 'approved' || u.status === 'active');

      setUsers(list);
    } catch (err: any) {
      toast.error(err?.userMessage ?? 'Error loading users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(activeTab); }, [activeTab, fetchUsers]);

  const handleTabChange = (tab: TabId) => { setActiveTab(tab); setUsers([]); };

  const handleApprove = async (user: ManagerUser) => {
    setActionLoading(user.id);
    try {
      await api.post(`/users/signup/review/${user.id}/`, { action: 'approve' });
      toast.success(`✓ ${user.full_name} approved. An email has been sent.`);
      fetchUsers(activeTab);
    } catch (err: any) {
      toast.error(err?.data?.error ?? 'Error during approval');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectTarget) return;
    setActionLoading(rejectTarget.id);
    try {
      await api.post(`/users/signup/review/${rejectTarget.id}/`, { action: 'reject', reason });
      toast.info(`Request from ${rejectTarget.full_name} rejected.`);
      setRejectTarget(null);
      fetchUsers(activeTab);
    } catch (err: any) {
      toast.error(err?.data?.error ?? 'Error during rejection');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspendConfirm = async (reason: string) => {
    if (!suspendTarget) return;
    setActionLoading(suspendTarget.id);
    try {
      await api.patch(`/users/users/${suspendTarget.id}/status/`, {
        status: 'suspended',
        ...(reason ? { reason } : {}),
      });
      toast.info(`${suspendTarget.full_name} suspended.`);
      setSuspendTarget(null);
      fetchUsers(activeTab);
    } catch (err: any) {
      toast.error(err?.data?.error ?? 'Error during suspension');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async (user: ManagerUser) => {
    setActionLoading(user.id);
    try {
      await api.patch(`/users/users/${user.id}/status/`, { status: 'active' });
      toast.success(`${user.full_name} reactivated.`);
      fetchUsers(activeTab);
    } catch (err: any) {
      toast.error(err?.data?.error ?? 'Error during reactivation');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = activeTab === 'pending' ? users.length : 0;

  return (
    <>
      {rejectTarget && (
        <RejectModal manager={rejectTarget} onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)} isLoading={actionLoading === rejectTarget.id} />
      )}
      {suspendTarget && (
        <SuspendModal user={suspendTarget} onConfirm={handleSuspendConfirm}
          onCancel={() => setSuspendTarget(null)} isLoading={actionLoading === suspendTarget.id} />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">User management</h1>
            <p className="text-muted-foreground mt-1">Validate requests and manage accounts</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchUsers(activeTab)} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              {tab.label}
              {tab.id === 'pending' && pendingCount > 0 && (
                <span className="ml-2 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="border rounded-lg p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Loading...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="border rounded-lg p-12 text-center">
            <Filter className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">No users found</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {users.map(user => {
              const isActing    = actionLoading === user.id;
              const isPending   = user.status === 'pending';
              const isSuspended = user.status === 'suspended';
              const canSuspend  = user.role === 'manager' &&
                                  (user.status === 'active' || user.status === 'approved');

              return (
                <div key={user.id} className="border rounded-xl p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-4">

                    {/* Info */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900 shrink-0 mt-0.5">
                        <UserIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {/* Name + badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm">{user.full_name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge(user.role)}`}>
                            {user.role}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(user.status)}`}>
                            {statusLabel(user.status)}
                          </span>
                        </div>

                        {/* Contact row */}
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />{user.email}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />{formatDate(user.created_at)}
                          </span>
                        </div>

                        {/* ✅ Company info pills — visible for managers */}
                        {user.role === 'manager' && <CompanyInfo user={user} />}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 mt-0.5">
                      {isPending && (
                        <>
                          <Button size="sm" onClick={() => handleApprove(user)} disabled={isActing}
                            className="bg-green-600 hover:bg-green-700 text-white gap-1">
                            {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setRejectTarget(user)} disabled={isActing}
                            className="text-red-600 border-red-200 hover:bg-red-50 gap-1">
                            <X className="h-3 w-3" />Reject
                          </Button>
                        </>
                      )}
                      {canSuspend && (
                        <Button size="sm" variant="outline" onClick={() => setSuspendTarget(user)} disabled={isActing}
                          className="text-orange-600 border-orange-200 hover:bg-orange-50 gap-1">
                          {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
                          Suspend
                        </Button>
                      )}
                      {isSuspended && (
                        <Button size="sm" variant="outline" onClick={() => handleReactivate(user)} disabled={isActing}
                          className="text-green-600 border-green-200 hover:bg-green-50 gap-1">
                          {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCheck className="h-3 w-3" />}
                          Reactivate
                        </Button>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}