import { useState } from 'react';
import { Check, Building } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { AVAILABLE_PERMISSIONS, DEFAULT_AGENT_PERMISSIONS, useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

interface UserAccount {
  name: string;
  email: string;
  role: string;
  permissions: string[];
  branchId?: string;
  tempPassword?: string;
}

interface CreateUserDialogProps {
  open: boolean;
  onClose: () => void;
  onCreateUser: (userData: UserAccount) => Promise<void>; // ← now async
}

export function CreateUserDialog({ open, onClose, onCreateUser }: CreateUserDialogProps) {
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    tempPassword: '',
  });
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(DEFAULT_AGENT_PERMISSIONS);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (selectedPermissions.length === 0) {
      toast.error('Veuillez sélectionner au moins une permission');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateUser({
        name: formData.name,
        email: formData.email,
        role: 'agent',
        permissions: selectedPermissions,
        tempPassword: formData.tempPassword || undefined,
      });
      // Only reset + close on success
      setFormData({ name: '', email: '', tempPassword: '' });
      setSelectedPermissions(DEFAULT_AGENT_PERMISSIONS);
      onClose();
    } catch (err: any) {
      const data = err?.data ?? {};
      if (data.email) {
        toast.error(`Email : ${Array.isArray(data.email) ? data.email[0] : data.email}`);
      } else if (data.non_field_errors) {
        toast.error(Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : data.non_field_errors);
      } else {
        toast.error(err?.userMessage ?? 'Erreur lors de la création du compte');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permissionId) ? prev.filter(p => p !== permissionId) : [...prev, permissionId]
    );
  };

  const selectAllInCategory = (category: string) => {
    const ids = AVAILABLE_PERMISSIONS.filter(p => p.category === category).map(p => p.id);
    const allSelected = ids.every(p => selectedPermissions.includes(p));
    setSelectedPermissions(prev =>
      allSelected ? prev.filter(p => !ids.includes(p)) : [...new Set([...prev, ...ids])]
    );
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Créer un compte Agent</DialogTitle>
          <DialogDescription>
            Créez un compte agent pour votre société. L'agent sera automatiquement rattaché à votre société.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 flex-1 overflow-hidden">
          {/* Info société — lecture seule */}
          {user?.companyName && (
            <div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
              <Building className="h-4 w-4 text-indigo-600 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Société</p>
                <p className="text-sm font-medium">{user.companyName}</p>
              </div>
              <span className="ml-auto text-xs text-muted-foreground italic">
                Hérité automatiquement
              </span>
            </div>
          )}

          {/* Informations de base */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom complet *</Label>
              <Input
                id="name"
                placeholder="Nom de l'agent"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Adresse email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="agent@societe.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Mot de passe temporaire */}
          <div className="space-y-2">
            <Label htmlFor="tempPassword">Mot de passe temporaire</Label>
            <Input
              id="tempPassword"
              type="text"
              placeholder="Laisser vide pour le mot de passe par défaut"
              value={formData.tempPassword}
              onChange={(e) => setFormData({ ...formData, tempPassword: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Par défaut : Agent@123456</p>
          </div>

          {/* Sélection rapide de permissions */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">Sélection rapide :</span>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setSelectedPermissions(DEFAULT_AGENT_PERMISSIONS)}>
                Agent par défaut
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setSelectedPermissions(AVAILABLE_PERMISSIONS.map(p => p.id))}>
                Tout sélectionner
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setSelectedPermissions([])}>
                Tout effacer
              </Button>
            </div>
          </div>

          {/* Permissions */}
          <div className="flex-1 overflow-y-auto border rounded-lg p-4 space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Permissions ({selectedPermissions.length} sélectionnées)</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Sélectionnez les permissions accordées à cet agent dans le système
              </p>
            </div>

            {Object.entries(groupedPermissions).map(([category, permissions]) => (
              <div key={category} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">{categoryLabels[category]}</h4>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => selectAllInCategory(category)}
                    className="h-auto py-1 text-xs"
                  >
                    {permissions.every(p => selectedPermissions.includes(p.id)) ? 'Tout désélectionner' : 'Tout sélectionner'}
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
                        <div className="text-xs text-muted-foreground mt-0.5">{permission.description}</div>
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

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Création...' : 'Créer le compte agent'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}