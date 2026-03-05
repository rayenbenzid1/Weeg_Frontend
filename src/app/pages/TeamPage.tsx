import { useState, useEffect, useCallback } from 'react';
import {
  Users, UserPlus, Shield, Trash2, Loader2,
  Mail, Building2, RefreshCw, AlertTriangle, Search,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { CreateUserDialog } from '../components/CreateUserDialog';
import { ManagePermissionsDialog } from '../components/ManagePermissionsDialog';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../lib/authApi';
import { toast } from 'sonner';

interface Agent {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  branch_name: string | null;
  company_name: string | null;
  created_at: string;
  permissions_list: string[];
}

// ─────────────────────────────────────────────
// DeleteConfirmModal
// ─────────────────────────────────────────────

function DeleteConfirmModal({
  agent, onConfirm, onCancel, isLoading,
}: {
  agent: Agent;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Delete agent account</h3>
            <p className="text-sm text-muted-foreground">{agent.full_name}</p>
          </div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-700 dark:text-red-400">
            ⚠️ This action is <strong>irreversible</strong>. The account of{' '}
            <strong>{agent.full_name}</strong> ({agent.email}) will be permanently
            deleted. All sessions will also be revoked.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            className="flex-1 bg-red-600 hover:bg-red-700 text-white gap-2"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading
              ? <><Loader2 className="h-4 w-4 animate-spin" />Deleting...</>
              : <><Trash2 className="h-4 w-4" />Confirm deletion</>
            }
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TeamPage
// ─────────────────────────────────────────────

export function TeamPage() {
  const { user, createAgent, updateUserPermissions } = useAuth();

  const [agents,               setAgents]               = useState<Agent[]>([]);
  const [isLoading,            setIsLoading]            = useState(true);
  const [nameSearch,           setNameSearch]           = useState('');
  const [showCreateDialog,     setShowCreateDialog]     = useState(false);
  const [showPermissionsDialog,setShowPermissionsDialog]= useState(false);
  const [deleteTarget,         setDeleteTarget]         = useState<Agent | null>(null);
  const [deleteLoading,        setDeleteLoading]        = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────
  const fetchAgents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await authApi.getAgents();
      setAgents(res.agents as Agent[]);
    } catch (err: any) {
      toast.error(err?.message ?? 'Error loading agents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleCreateAgent = async (userData: {
    name: string;
    email: string;
    role: string;
    permissions: string[];
    branchId?: string;
    tempPassword?: string;
  }) => {
    await createAgent(userData);
    await fetchAgents();
    toast.success(`Agent account created for ${userData.name}`);
  };

  const handleUpdatePermissions = async (userId: string, permissions: string[]) => {
    await updateUserPermissions(userId, permissions);
    await fetchAgents();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await authApi.deleteAgent(deleteTarget.id);
      toast.success(`Account of ${deleteTarget.full_name} deleted.`);
      setDeleteTarget(null);
      await fetchAgents();
    } catch (err: any) {
      toast.error(err?.message ?? 'Error during deletion');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────
  const filteredAgents = agents.filter(a =>
    !nameSearch.trim() ||
    a.full_name.toLowerCase().includes(nameSearch.trim().toLowerCase()) ||
    a.email.toLowerCase().includes(nameSearch.trim().toLowerCase())
  );

  const agentsAsUsers = agents.map(a => ({
    id:          a.id,
    name:        a.full_name,
    email:       a.email,
    role:        a.role as any,
    permissions: a.permissions_list ?? [],
    isVerified:  true,
    createdAt:   a.created_at,
  }));

  const statusBadge = (status: string) =>
    ({
      active:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      pending:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    }[status] ?? 'bg-gray-100 text-gray-600');

  const statusLabel = (status: string) =>
    ({ active: 'Active', suspended: 'Suspended', pending: 'Pending' }[status] ?? status);

  // ─────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Delete Modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          agent={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          isLoading={deleteLoading}
        />
      )}

      {/* Create Dialog */}
      <CreateUserDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreateUser={handleCreateAgent}
      />

      {/* Permissions Dialog */}
      <ManagePermissionsDialog
        open={showPermissionsDialog}
        onClose={() => setShowPermissionsDialog(false)}
        users={agentsAsUsers}
        onUpdatePermissions={handleUpdatePermissions}
      />

      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold">My Team</h1>
            <p className="text-muted-foreground mt-1">
              Manage agents of {user?.companyName ?? 'your company'}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={fetchAgents} disabled={isLoading}>
              {isLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Refresh</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowPermissionsDialog(true)}
              disabled={agents.length === 0}
            >
              <Shield className="h-4 w-4 mr-2" />
              Manage permissions
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Create agent
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold">{agents.length}</p>
            <p className="text-sm text-muted-foreground">Total agents</p>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {agents.filter(a => a.status === 'active').length}
            </p>
            <p className="text-sm text-muted-foreground">Active</p>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-red-600">
              {agents.filter(a => a.status === 'suspended').length}
            </p>
            <p className="text-sm text-muted-foreground">Suspended</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name or email…"
            value={nameSearch}
            onChange={e => setNameSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Agent List */}
        {isLoading ? (
          <div className="border rounded-lg p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Loading agents...</p>
          </div>
        ) : agents.length === 0 ? (
          <div className="border rounded-lg p-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold text-lg mb-2">No agents</h3>
            <p className="text-muted-foreground mb-4">
              Create your first agent account to get started.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Create agent
            </Button>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="border rounded-lg p-12 text-center">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold text-lg mb-2">No results</h3>
            <p className="text-muted-foreground">
              No agent matches "<strong>{nameSearch}</strong>".
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredAgents.map(agent => (
              <div key={agent.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between gap-4">

                  {/* Agent info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900 shrink-0">
                      <Users className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{agent.full_name}</p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(agent.status)}`}
                        >
                          {statusLabel(agent.status)}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          {agent.permissions_list?.length ?? 0} permissions
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {agent.email}
                        </span>
                        {agent.company_name && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            {agent.company_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Delete button */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteTarget(agent)}
                      className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </>
  );
}