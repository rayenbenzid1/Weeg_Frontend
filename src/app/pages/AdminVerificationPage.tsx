import { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import {
  Check, X, Mail, Calendar, User as UserIcon, Building2,
  Loader2, RefreshCw, Ban, UserCheck, Filter
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
            <h3 className="font-semibold text-lg">Rejeter la demande</h3>
            <p className="text-sm text-muted-foreground">{manager.full_name}</p>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Motif du rejet <span className="text-red-500">*</span></label>
          <textarea
            className="w-full min-h-[100px] rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Expliquez la raison du rejet..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="flex gap-2">
          <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            onClick={() => onConfirm(reason)} disabled={isLoading || !reason.trim()}>
            {isLoading
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Rejet...</>
              : <><X className="h-4 w-4 mr-2" />Confirmer</>}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>Annuler</Button>
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
            <h3 className="font-semibold text-lg">Suspendre le compte</h3>
            <p className="text-sm text-muted-foreground">{user.full_name}</p>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Motif (optionnel)</label>
          <textarea
            className="w-full min-h-[80px] rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Raison de la suspension..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="flex gap-2">
          <Button className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
            onClick={() => onConfirm(reason)} disabled={isLoading}>
            {isLoading
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />...</>
              : <><Ban className="h-4 w-4 mr-2" />Suspendre</>}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>Annuler</Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Affichage lisible du statut
const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    pending:   'En attente',
    active:    'Validé',
    approved:  'Validé',
    suspended: 'Suspendu',
    rejected:  'Rejeté',
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
  new Date(d).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' });

// ---------------------------------------------------------------------------
// Tabs config
// ---------------------------------------------------------------------------

type TabId = 'pending' | 'managers' | 'agents' | 'suspended' | 'all';

const TABS: { id: TabId; label: string; url: string }[] = [
  { id: 'pending',   label: 'En attente', url: '/users/users/?status=pending'   },
  // managers validés = approved ou active
  { id: 'managers',  label: 'Managers',   url: '/users/users/?role=manager&status=approved' },
  { id: 'agents',    label: 'Agents',     url: '/users/users/?role=agent'       },
  { id: 'suspended', label: 'Suspendus',  url: '/users/users/?status=suspended' },
  // "Tous" exclut les rejetés
  { id: 'all',       label: 'Tous',       url: '/users/users/'                  },
];

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

  // -------------------------------------------------------------------------
  // Fetch
  // -------------------------------------------------------------------------

  const fetchUsers = useCallback(async (tab: TabId) => {
    setIsLoading(true);
    try {
      const url = TABS.find(t => t.id === tab)?.url ?? '/users/users/';
      const res = await api.get(url) as any;

      let list: ManagerUser[] = Array.isArray(res)
        ? res
        : res?.users ?? res?.pending_managers ?? res?.data ?? [];

      // Onglet "Tous" : exclure les rejetés
      if (tab === 'all') {
        list = list.filter(u => u.status !== 'rejected');
      }

      // Onglet "Managers" : le backend filtre par approved mais si active aussi présent on inclut
      setUsers(list);
    } catch (err: any) {
      toast.error(err?.userMessage ?? 'Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(activeTab); }, [activeTab, fetchUsers]);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setUsers([]);
  };

  // -------------------------------------------------------------------------
  // Approve / Reject
  // -------------------------------------------------------------------------

  const handleApprove = async (user: ManagerUser) => {
    setActionLoading(user.id);
    try {
      await api.post(`/users/signup/review/${user.id}/`, { action: 'approve' });
      toast.success(`✓ ${user.full_name} approuvé. Un email lui a été envoyé.`);
      fetchUsers(activeTab);
    } catch (err: any) {
      toast.error(err?.data?.error ?? "Erreur lors de l'approbation");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectTarget) return;
    setActionLoading(rejectTarget.id);
    try {
      await api.post(`/users/signup/review/${rejectTarget.id}/`, { action: 'reject', reason });
      toast.info(`Demande de ${rejectTarget.full_name} rejetée.`);
      setRejectTarget(null);
      fetchUsers(activeTab);
    } catch (err: any) {
      toast.error(err?.data?.error ?? 'Erreur lors du rejet');
    } finally {
      setActionLoading(null);
    }
  };

  // -------------------------------------------------------------------------
  // Suspend / Reactivate — uniquement les managers, pas les agents
  // -------------------------------------------------------------------------

  const handleSuspendConfirm = async (reason: string) => {
    if (!suspendTarget) return;
    setActionLoading(suspendTarget.id);
    try {
      await api.patch(`/users/users/${suspendTarget.id}/status/`, {
        status: 'suspended',
        ...(reason ? { reason } : {}),
      });
      toast.info(`${suspendTarget.full_name} suspendu.`);
      setSuspendTarget(null);
      fetchUsers(activeTab);
    } catch (err: any) {
      toast.error(err?.data?.error ?? 'Erreur lors de la suspension');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async (user: ManagerUser) => {
    setActionLoading(user.id);
    try {
      await api.patch(`/users/users/${user.id}/status/`, { status: 'active' });
      toast.success(`${user.full_name} réactivé.`);
      fetchUsers(activeTab);
    } catch (err: any) {
      toast.error(err?.data?.error ?? 'Erreur lors de la réactivation');
    } finally {
      setActionLoading(null);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const pendingCount = activeTab === 'pending' ? users.length : 0;

  return (
    <>
      {rejectTarget && (
        <RejectModal
          manager={rejectTarget}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
          isLoading={actionLoading === rejectTarget.id}
        />
      )}
      {suspendTarget && (
        <SuspendModal
          user={suspendTarget}
          onConfirm={handleSuspendConfirm}
          onCancel={() => setSuspendTarget(null)}
          isLoading={actionLoading === suspendTarget.id}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestion des utilisateurs</h1>
            <p className="text-muted-foreground mt-1">Validez les demandes et gérez les comptes</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchUsers(activeTab)} disabled={isLoading}>
            {isLoading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Actualiser</span>
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
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
            <p className="text-muted-foreground text-sm">Chargement...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="border rounded-lg p-12 text-center">
            <Filter className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {users.map(user => {
              const isActing    = actionLoading === user.id;
              const isPending   = user.status === 'pending';
              const isSuspended = user.status === 'suspended';
              // Seuls les managers actifs/approuvés peuvent être suspendus par l'admin
              const canSuspend  = user.role === 'manager' &&
                                  (user.status === 'active' || user.status === 'approved');

              return (
                <div key={user.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between gap-4">
                    {/* Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900 shrink-0">
                        <UserIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{user.full_name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge(user.role)}`}>
                            {user.role}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(user.status)}`}>
                            {statusLabel(user.status)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />{user.email}
                          </span>
                          {user.company_name && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Building2 className="h-3 w-3" />{user.company_name}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />{formatDate(user.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Pending : Approuver / Rejeter */}
                      {isPending && (
                        <>
                          <Button size="sm" onClick={() => handleApprove(user)} disabled={isActing}
                            className="bg-green-600 hover:bg-green-700 text-white gap-1">
                            {isActing
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <Check className="h-3 w-3" />}
                            Approuver
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setRejectTarget(user)} disabled={isActing}
                            className="text-red-600 border-red-200 hover:bg-red-50 gap-1">
                            <X className="h-3 w-3" />Rejeter
                          </Button>
                        </>
                      )}

                      {/* Manager validé : Suspendre */}
                      {canSuspend && (
                        <Button size="sm" variant="outline" onClick={() => setSuspendTarget(user)} disabled={isActing}
                          className="text-orange-600 border-orange-200 hover:bg-orange-50 gap-1">
                          {isActing
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Ban className="h-3 w-3" />}
                          Suspendre
                        </Button>
                      )}

                      {/* Suspendu : Réactiver */}
                      {isSuspended && (
                        <Button size="sm" variant="outline" onClick={() => handleReactivate(user)} disabled={isActing}
                          className="text-green-600 border-green-200 hover:bg-green-50 gap-1">
                          {isActing
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <UserCheck className="h-3 w-3" />}
                          Réactiver
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