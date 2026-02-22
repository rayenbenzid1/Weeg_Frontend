import { useState } from 'react';
import { useAuth, AVAILABLE_PERMISSIONS } from '../contexts/AuthContext';
import { User, Mail, Calendar, Shield, Key, Check, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showPasswords, setShowPasswords] = useState({ old: false, new: false, confirm: false });
  const [isSaving, setIsSaving] = useState(false);
  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    new_password_confirm: '',
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrors({});

    if (!passwordData.old_password) {
      setPasswordErrors(err => ({ ...err, old_password: 'Champ obligatoire' }));
      return;
    }
    if (passwordData.new_password.length < 8) {
      setPasswordErrors(err => ({ ...err, new_password: 'Minimum 8 caractères' }));
      return;
    }
    if (passwordData.new_password !== passwordData.new_password_confirm) {
      setPasswordErrors(err => ({ ...err, new_password_confirm: 'Les mots de passe ne correspondent pas' }));
      return;
    }
    if (passwordData.old_password === passwordData.new_password) {
      setPasswordErrors(err => ({ ...err, new_password: 'Le nouveau mot de passe doit être différent' }));
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/users/change-password/', passwordData);
      toast.success('Mot de passe modifié. Reconnectez-vous dans 2 secondes...');
      setPasswordData({ old_password: '', new_password: '', new_password_confirm: '' });
      setShowPasswordForm(false);
      setTimeout(async () => {
        await logout();
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      const data = err?.data ?? {};
      if (data.error) {
        setPasswordErrors({ old_password: data.error });
      } else if (data.old_password) {
        setPasswordErrors({ old_password: Array.isArray(data.old_password) ? data.old_password[0] : data.old_password });
      } else if (data.new_password) {
        setPasswordErrors({ new_password: Array.isArray(data.new_password) ? data.new_password[0] : data.new_password });
      } else if (data.new_password_confirm) {
        setPasswordErrors({ new_password_confirm: Array.isArray(data.new_password_confirm) ? data.new_password_confirm[0] : data.new_password_confirm });
      } else {
        toast.error(err?.userMessage ?? 'Erreur lors du changement de mot de passe');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getUserPermissions = () => {
    if (!user) return [];
    if (user.permissions.includes('all')) return AVAILABLE_PERMISSIONS;
    return AVAILABLE_PERMISSIONS.filter(p => user.permissions.includes(p.id));
  };

  const userPermissions = getUserPermissions();

  const groupedPermissions = userPermissions.reduce((acc, permission) => {
    if (!acc[permission.category]) acc[permission.category] = [];
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_PERMISSIONS>);

  const categoryLabels: Record<string, string> = {
    data: 'Gestion des données',
    analytics: 'Analytiques & Rapports',
    sales: 'Ventes & Inventaire',
    system: 'Accès système',
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mon Profil</h1>
        <p className="text-muted-foreground mt-2">Consultez et gérez vos informations</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="border rounded-lg p-6 space-y-6">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 mb-4">
                <User className="h-12 w-12 text-white" />
              </div>
              <h2 className="text-xl font-bold">{user.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
              <span className={`mt-3 px-3 py-1 rounded-full text-sm font-medium capitalize ${
                user.role === 'admin'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                  : user.role === 'manager'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
              }`}>
                {user.role}
              </span>
            </div>

            <div className="space-y-3 pt-6 border-t">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Email :</span>
                <span className="font-medium flex-1 truncate">{user.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Inscrit :</span>
                <span className="font-medium">{formatDate(user.createdAt)}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Statut :</span>
                <span className="font-medium text-green-600">Actif</span>
              </div>
            </div>

            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                setShowPasswordForm(!showPasswordForm);
                setPasswordErrors({});
                setPasswordData({ old_password: '', new_password: '', new_password_confirm: '' });
              }}
            >
              <Key className="h-4 w-4 mr-2" />
              {showPasswordForm ? 'Annuler' : 'Changer le mot de passe'}
            </Button>
          </div>
        </div>

        {/* Details Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Change Password Form — CONNECTED TO API */}
          {showPasswordForm && (
            <div className="border rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-1">Changer le mot de passe</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Après modification, toutes vos sessions seront fermées.
              </p>
              <form onSubmit={handlePasswordChange} className="space-y-4">

                {/* Mot de passe actuel */}
                <div className="space-y-2">
                  <Label htmlFor="old_password">Mot de passe actuel *</Label>
                  <div className="relative">
                    <Input
                      id="old_password"
                      type={showPasswords.old ? 'text' : 'password'}
                      value={passwordData.old_password}
                      onChange={e => setPasswordData({ ...passwordData, old_password: e.target.value })}
                      className={`pr-10 ${passwordErrors.old_password ? 'border-red-500' : ''}`}
                    />
                    <button type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPasswords(s => ({ ...s, old: !s.old }))}>
                      {showPasswords.old ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordErrors.old_password && <p className="text-xs text-red-500">{passwordErrors.old_password}</p>}
                </div>

                {/* Nouveau mot de passe */}
                <div className="space-y-2">
                  <Label htmlFor="new_password">Nouveau mot de passe *</Label>
                  <div className="relative">
                    <Input
                      id="new_password"
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordData.new_password}
                      onChange={e => setPasswordData({ ...passwordData, new_password: e.target.value })}
                      className={`pr-10 ${passwordErrors.new_password ? 'border-red-500' : ''}`}
                    />
                    <button type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPasswords(s => ({ ...s, new: !s.new }))}>
                      {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordErrors.new_password && <p className="text-xs text-red-500">{passwordErrors.new_password}</p>}
                  <p className="text-xs text-muted-foreground">Minimum 8 caractères</p>
                </div>

                {/* Confirmation */}
                <div className="space-y-2">
                  <Label htmlFor="new_password_confirm">Confirmer le nouveau mot de passe *</Label>
                  <div className="relative">
                    <Input
                      id="new_password_confirm"
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordData.new_password_confirm}
                      onChange={e => setPasswordData({ ...passwordData, new_password_confirm: e.target.value })}
                      className={`pr-10 ${passwordErrors.new_password_confirm ? 'border-red-500' : ''}`}
                    />
                    <button type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPasswords(s => ({ ...s, confirm: !s.confirm }))}>
                      {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordErrors.new_password_confirm && <p className="text-xs text-red-500">{passwordErrors.new_password_confirm}</p>}
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving
                      ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Modification...</>
                      : 'Modifier le mot de passe'
                    }
                  </Button>
                  <Button type="button" variant="outline"
                    onClick={() => { setShowPasswordForm(false); setPasswordErrors({}); }}>
                    Annuler
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Permissions */}
          <div className="border rounded-lg p-6">
            <div className="mb-6">
              <h3 className="font-semibold text-lg">Mes Permissions</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {user.role === 'admin'
                  ? 'Vous avez un accès administrateur complet'
                  : `Vous avez ${userPermissions.length} permission${userPermissions.length > 1 ? 's' : ''}`
                }
              </p>
            </div>

            {userPermissions.length === 0 && user.role !== 'admin' ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune permission assignée pour le moment.
              </p>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedPermissions).map(([category, permissions]) => (
                  <div key={category}>
                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                      {categoryLabels[category]}
                    </h4>
                    <div className="grid gap-2">
                      {permissions.map((permission) => (
                        <div key={permission.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                          <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{permission.label}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{permission.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}