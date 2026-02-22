import { useState } from 'react';
import { Shield, User, Mail, Check, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { User as UserAccount, AVAILABLE_PERMISSIONS, DEFAULT_AGENT_PERMISSIONS } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { api } from '../lib/api';

interface ManagePermissionsDialogProps {
  open: boolean;
  onClose: () => void;
  users: UserAccount[];
  onUpdatePermissions: (userId: string, permissions: string[]) => Promise<void>;
}

export function ManagePermissionsDialog({
  open,
  onClose,
  users,
  onUpdatePermissions,
}: ManagePermissionsDialogProps) {
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [loadingUser, setLoadingUser] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleUserSelect = async (user: UserAccount) => {
    setSelectedUser(user);
    setLoadingUser(true);
    try {
      // Use the existing /agents/ endpoint which returns permissions_list
      const res = await api.get<{
        agents: Array<{ id: string; permissions_list?: string[] }>;
      }>('/users/agents/');
      const found = res.agents.find(a => a.id === user.id);
      setSelectedPermissions(found?.permissions_list ?? []);
    } catch {
      setSelectedPermissions(user.permissions ?? []);
      toast.error('Impossible de charger les permissions actuelles');
    } finally {
      setLoadingUser(false);
    }
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permissionId)
        ? prev.filter(p => p !== permissionId)
        : [...prev, permissionId]
    );
  };

  const selectAllInCategory = (category: string) => {
    const ids = AVAILABLE_PERMISSIONS.filter(p => p.category === category).map(p => p.id);
    const allSelected = ids.every(p => selectedPermissions.includes(p));
    setSelectedPermissions(prev =>
      allSelected ? prev.filter(p => !ids.includes(p)) : [...new Set([...prev, ...ids])]
    );
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    if (selectedPermissions.length === 0) {
      toast.error('Veuillez sélectionner au moins une permission');
      return;
    }
    setIsSaving(true);
    try {
      await onUpdatePermissions(selectedUser.id, selectedPermissions);
      toast.success(`Permissions mises à jour pour ${selectedUser.name}`);
      setSelectedUser(null);
      setSelectedPermissions([]);
    } catch (err: any) {
      const data = err?.data ?? {};
      const msg = data.permissions_list
        ? (Array.isArray(data.permissions_list) ? data.permissions_list[0] : data.permissions_list)
        : (err?.userMessage ?? 'Erreur lors de la mise à jour');
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const groupedPermissions = AVAILABLE_PERMISSIONS.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_PERMISSIONS>);

  const categoryLabels: Record<string, string> = {
    data: 'Data Management',
    analytics: 'Analytics & Reports',
    sales: 'Sales & Inventory',
    system: 'System Access',
  };

  const editableUsers = users.filter(u => u.role !== 'admin');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[1600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Gérer les permissions</DialogTitle>
          <DialogDescription>
            Sélectionnez un utilisateur pour modifier ses permissions
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6 flex-1 overflow-hidden min-h-0">
          {/* User List */}
          <div className="h-[240px] flex flex-col border-b pb-6 overflow-hidden">
            <div className="mb-4">
              <Label>Sélectionner un utilisateur</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {editableUsers.length} utilisateurs
              </p>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-hidden">
              <div className="flex gap-3 pb-2">
                {editableUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className={`w-[320px] shrink-0 text-left p-3 rounded-lg border transition-colors ${
                      selectedUser?.id === user.id
                        ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-950 dark:border-indigo-700'
                        : 'hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${
                        user.role === 'manager'
                          ? 'bg-purple-100 dark:bg-purple-900'
                          : 'bg-blue-100 dark:bg-blue-900'
                      }`}>
                        <User className={`h-5 w-5 ${
                          user.role === 'manager'
                            ? 'text-purple-600 dark:text-purple-400'
                            : 'text-blue-600 dark:text-blue-400'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-1">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            user.role === 'manager'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                          }`}>
                            {user.role}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Permissions Panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedUser ? (
              <>
                <div className="p-4 bg-muted rounded-lg mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                        selectedUser.role === 'manager'
                          ? 'bg-purple-100 dark:bg-purple-900'
                          : 'bg-blue-100 dark:bg-blue-900'
                      }`}>
                        <Shield className={`h-6 w-6 ${
                          selectedUser.role === 'manager'
                            ? 'text-purple-600 dark:text-purple-400'
                            : 'text-blue-600 dark:text-blue-400'
                        }`} />
                      </div>
                      <div>
                        <p className="font-semibold">{selectedUser.name}</p>
                        <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {loadingUser ? (
                        <Loader2 className="h-4 w-4 animate-spin ml-auto" />
                      ) : (
                        <>
                          <p className="text-sm font-medium">{selectedPermissions.length} permissions</p>
                          <p className="text-xs text-muted-foreground capitalize">{selectedUser.role}</p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline"
                      onClick={() => setSelectedPermissions(DEFAULT_AGENT_PERMISSIONS)}
                      disabled={loadingUser}>
                      Agent par défaut
                    </Button>
                    <Button type="button" size="sm" variant="outline"
                      onClick={() => setSelectedPermissions(AVAILABLE_PERMISSIONS.map(p => p.id))}
                      disabled={loadingUser}>
                      Tout sélectionner
                    </Button>
                    <Button type="button" size="sm" variant="outline"
                      onClick={() => setSelectedPermissions([])}
                      disabled={loadingUser}>
                      Tout effacer
                    </Button>
                  </div>
                </div>

                {loadingUser ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                    {Object.entries(groupedPermissions).map(([category, permissions]) => (
                      <div key={category} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">{categoryLabels[category]}</h4>
                          <Button
                            type="button" size="sm" variant="ghost"
                            onClick={() => selectAllInCategory(category)}
                            className="h-auto py-1 text-xs"
                          >
                            {permissions.every(p => selectedPermissions.includes(p.id))
                              ? 'Tout désélectionner'
                              : 'Tout sélectionner'}
                          </Button>
                        </div>
                        <div className="grid gap-2">
                          {permissions.map((permission) => (
                            <label
                              key={permission.id}
                              className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors"
                            >
                              <div className="flex items-center h-5">
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.includes(permission.id)}
                                  onChange={() => togglePermission(permission.id)}
                                  className="h-4 w-4 rounded border-gray-300"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">{permission.label}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {permission.description}
                                </div>
                              </div>
                              {selectedPermissions.includes(permission.id) && (
                                <Check className="h-4 w-4 text-green-600 shrink-0" />
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                  <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                    Annuler
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving || loadingUser}>
                    {isSaving
                      ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enregistrement...</>
                      : 'Sauvegarder'
                    }
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center">
                <div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                    <Shield className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="font-medium">Sélectionnez un utilisateur</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choisissez un utilisateur pour gérer ses permissions
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}