import {
  LayoutDashboard,
  Upload,
  TrendingUp,
  ShoppingCart,
  Package,
  AlertTriangle,
  Users,
  FileText,
  Sparkles,
  Settings,
  X,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'view-dashboard' },
  { id: 'import', label: 'Data Import', icon: Upload, permission: 'import-data' },
  { id: 'kpi', label: 'KPI Engine', icon: TrendingUp, permission: 'view-kpi' },
  { id: 'sales', label: 'Sales & Purchases', icon: ShoppingCart, permission: 'view-sales' },
  { id: 'inventory', label: 'Multi-Branch Inventory', icon: Package, permission: 'view-inventory' },
  { id: 'alerts', label: 'Smart Alerts', icon: AlertTriangle, permission: 'receive-notifications' },
  { id: 'aging', label: 'Aging Receivables', icon: Users, permission: 'view-aging' },
  { id: 'reports', label: 'Reports', icon: FileText, permission: 'view-reports' },
  { id: 'ai-insights', label: 'AI Insights', icon: Sparkles, permission: 'ai-insights' },
  { id: 'settings', label: 'Settings', icon: Settings, permission: 'view-profile' },
];

const adminMenuItems = [
  { id: 'admin-verification', label: 'Verify Managers', icon: ShieldCheck },
];

export function Sidebar({ currentPage, onNavigate, isOpen, onClose }: SidebarProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Helper function to check if user has permission
  const hasPermission = (permission: string) => {
    if (!user) return false;
    if (user.role === 'manager') return true; //managers have all permissions
    return user.permissions.includes(permission);
  };

  // Filter menu items based on permissions
  const visibleMenuItems = menuItems.filter(item => hasPermission(item.permission));

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-screen w-64 transform bg-card border-r transition-transform duration-300 ease-in-out lg:relative lg:z-auto lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo Area */}
          <div className="flex h-16 items-center justify-between border-b px-6 lg:justify-center">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
                <span className="text-white font-bold text-sm">F</span>
              </div>
              <span className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                FASI
              </span>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden rounded-md p-2 hover:bg-accent"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              {visibleMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      onClose();
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Admin Menu Items */}
            {isAdmin && (
              <>
                <div className="my-4 border-t" />
                <div className="px-3 mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Admin
                  </p>
                </div>
                <div className="space-y-1">
                  {adminMenuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPage === item.id;
                    
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onNavigate(item.id);
                          onClose();
                        }}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        )}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </nav>

          {/* Footer */}
          <div className="border-t p-4">
            <div className="rounded-lg bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950 dark:to-violet-950 p-4">
              <div className="flex items-start gap-2 mb-2">
                <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-foreground">AI Powered</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Get intelligent insights and recommendations
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}