import { useState, useEffect } from 'react';
import { User, Building, Bell, Shield, Globe, Loader2, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';

export function SettingsPage() {
  const { user, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // ── Profile form — loaded from API ──────────────────────────────────────
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
  });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  // Load real profile data on mount
  useEffect(() => {
    api.get<{
      first_name: string;
      last_name: string;
      phone_number: string | null;
    }>('/users/profile/')
      .then(data => {
        setProfileForm({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          phone_number: data.phone_number || '',
        });
      })
      .catch(() => {
        // Fallback to user context
        const nameParts = user?.name?.split(' ') ?? [];
        setProfileForm({
          first_name: nameParts[0] || '',
          last_name: nameParts.slice(1).join(' ') || '',
          phone_number: '',
        });
      })
      .finally(() => setLoadingProfile(false));
  }, []);

  const handleSaveProfile = async () => {
    if (!profileForm.first_name.trim()) {
      toast.error('Le prénom est obligatoire');
      return;
    }
    if (!profileForm.last_name.trim()) {
      toast.error('Le nom est obligatoire');
      return;
    }
    setSavingProfile(true);
    try {
      await api.patch('/users/profile/', profileForm);
      await refreshProfile();
      toast.success('Profil mis à jour avec succès');
    } catch (err: any) {
      const data = err?.data ?? {};
      const msg = data.first_name?.[0] || data.last_name?.[0] || data.phone_number?.[0]
        || err?.userMessage || 'Erreur lors de la mise à jour du profil';
      toast.error(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Change password form ─────────────────────────────────────────────────
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    new_password_confirm: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    old: false,
    new: false,
    confirm: false,
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  const handleChangePassword = async () => {
    setPasswordErrors({});

    if (!passwordForm.old_password) {
      setPasswordErrors(e => ({ ...e, old_password: 'Champ obligatoire' }));
      return;
    }
    if (passwordForm.new_password.length < 8) {
      setPasswordErrors(e => ({ ...e, new_password: 'Minimum 8 caractères' }));
      return;
    }
    if (passwordForm.new_password !== passwordForm.new_password_confirm) {
      setPasswordErrors(e => ({ ...e, new_password_confirm: 'Les mots de passe ne correspondent pas' }));
      return;
    }
    if (passwordForm.old_password === passwordForm.new_password) {
      setPasswordErrors(e => ({ ...e, new_password: 'Le nouveau mot de passe doit être différent' }));
      return;
    }

    setSavingPassword(true);
    try {
      await api.post('/users/change-password/', passwordForm);
      toast.success('Mot de passe modifié. Reconnectez-vous dans 2 secondes...');
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
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground mt-1">Gérez votre compte et vos préférences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="company">Société</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Sécurité</TabsTrigger>
          <TabsTrigger value="integrations">Intégrations</TabsTrigger>
        </TabsList>

        {/* ── PROFILE ── */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <User className="h-5 w-5" />
                <div>
                  <CardTitle>Informations personnelles</CardTitle>
                  <CardDescription>Mettez à jour vos informations de profil</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingProfile ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Prénom *</Label>
                      <Input
                        id="firstName"
                        value={profileForm.first_name}
                        onChange={e => setProfileForm(f => ({ ...f, first_name: e.target.value }))}
                        placeholder="Votre prénom"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Nom *</Label>
                      <Input
                        id="lastName"
                        value={profileForm.last_name}
                        onChange={e => setProfileForm(f => ({ ...f, last_name: e.target.value }))}
                        placeholder="Votre nom"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="opacity-60 cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground">L'email ne peut pas être modifié</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Numéro de téléphone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={profileForm.phone_number}
                      onChange={e => setProfileForm(f => ({ ...f, phone_number: e.target.value }))}
                      placeholder="+213 6XX XXX XXX"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Rôle</Label>
                    <Input
                      value={user?.role || ''}
                      disabled
                      className="opacity-60 capitalize cursor-not-allowed"
                    />
                  </div>

                  <Button onClick={handleSaveProfile} disabled={savingProfile}>
                    {savingProfile
                      ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Enregistrement...</>
                      : 'Sauvegarder'
                    }
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── COMPANY ── */}
        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Building className="h-5 w-5" />
                <div>
                  <CardTitle>Informations de la société</CardTitle>
                  <CardDescription>Détails de votre organisation</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nom de la société</Label>
                <Input value={user?.companyName || 'Non assignée'} disabled className="opacity-60 cursor-not-allowed" />
              </div>
              <div className="space-y-2">
                <Label>Succursale</Label>
                <Input value={user?.branchName || 'Non assignée'} disabled className="opacity-60 cursor-not-allowed" />
              </div>
              <p className="text-xs text-muted-foreground">
                Les informations de société sont gérées par l'administrateur.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── NOTIFICATIONS ── */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5" />
                <div>
                  <CardTitle>Préférences de notifications</CardTitle>
                  <CardDescription>Choisissez les notifications que vous recevez</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {[
                  { id: 'email-alerts', label: 'Alertes Email', desc: 'Notifications par email pour les alertes critiques', default: true },
                  { id: 'low-stock', label: 'Alertes de stock', desc: 'Notification quand le stock est faible', default: true },
                  { id: 'overdue', label: 'Paiements en retard', desc: 'Alertes pour les paiements clients en retard', default: true },
                  { id: 'ai-insights', label: 'Insights IA', desc: "Recommandations basées sur l'IA", default: true },
                  { id: 'weekly-report', label: 'Rapport hebdomadaire', desc: 'Résumé de performance hebdomadaire', default: false },
                ].map(item => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor={item.id}>{item.label}</Label>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch id={item.id} defaultChecked={item.default} />
                  </div>
                ))}
              </div>
              <Button>Sauvegarder les préférences</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── SECURITY — CONNECTED TO API ── */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5" />
                <div>
                  <CardTitle>Changer le mot de passe</CardTitle>
                  <CardDescription>
                    Après modification, toutes vos sessions seront fermées et vous devrez vous reconnecter.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Old password */}
              <div className="space-y-2">
                <Label htmlFor="old-password">Mot de passe actuel *</Label>
                <div className="relative">
                  <Input
                    id="old-password"
                    type={showPasswords.old ? 'text' : 'password'}
                    value={passwordForm.old_password}
                    onChange={e => setPasswordForm(f => ({ ...f, old_password: e.target.value }))}
                    className={passwordErrors.old_password ? 'border-red-500 pr-10' : 'pr-10'}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPasswords(s => ({ ...s, old: !s.old }))}
                  >
                    {showPasswords.old ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordErrors.old_password && (
                  <p className="text-xs text-red-500">{passwordErrors.old_password}</p>
                )}
              </div>

              {/* New password */}
              <div className="space-y-2">
                <Label htmlFor="new-password">Nouveau mot de passe *</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordForm.new_password}
                    onChange={e => setPasswordForm(f => ({ ...f, new_password: e.target.value }))}
                    className={passwordErrors.new_password ? 'border-red-500 pr-10' : 'pr-10'}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPasswords(s => ({ ...s, new: !s.new }))}
                  >
                    {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordErrors.new_password && (
                  <p className="text-xs text-red-500">{passwordErrors.new_password}</p>
                )}
                <p className="text-xs text-muted-foreground">Minimum 8 caractères</p>
              </div>

              {/* Confirm password */}
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmer le nouveau mot de passe *</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordForm.new_password_confirm}
                    onChange={e => setPasswordForm(f => ({ ...f, new_password_confirm: e.target.value }))}
                    className={passwordErrors.new_password_confirm ? 'border-red-500 pr-10' : 'pr-10'}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPasswords(s => ({ ...s, confirm: !s.confirm }))}
                  >
                    {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordErrors.new_password_confirm && (
                  <p className="text-xs text-red-500">{passwordErrors.new_password_confirm}</p>
                )}
              </div>

              <Button onClick={handleChangePassword} disabled={savingPassword}>
                {savingPassword
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Modification en cours...</>
                  : 'Modifier le mot de passe'
                }
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── INTEGRATIONS ── */}
        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5" />
                <div>
                  <CardTitle>Intégrations</CardTitle>
                  <CardDescription>Connectez des services externes</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { name: 'QuickBooks', description: 'Synchronisation des données financières', connected: true },
                { name: 'Shopify', description: 'Intégration e-commerce', connected: true },
                { name: 'Stripe', description: 'Traitement des paiements', connected: false },
                { name: 'Mailchimp', description: 'Marketing par email', connected: false },
              ].map((integration) => (
                <div key={integration.name} className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <h4 className="font-medium">{integration.name}</h4>
                    <p className="text-sm text-muted-foreground">{integration.description}</p>
                  </div>
                  <Button variant={integration.connected ? 'outline' : 'default'}>
                    {integration.connected ? 'Déconnecter' : 'Connecter'}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}