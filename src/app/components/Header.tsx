import { Bell, Search, User, Moon, Sun, UserPlus, Shield, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import { toast } from 'sonner';
import { CreateUserDialog } from './CreateUserDialog';
import { ManagePermissionsDialog } from './ManagePermissionsDialog';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router';

interface HeaderProps {
  onMenuClick: () => void;
}

interface UserAccountData {
  name: string;
  email: string;
  role: string;
  permissions: string[];
  branchId?: string;
  tempPassword?: string;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const { user, users, logout, createAgent, updateUserPermissions } = useAuth();
  const navigate = useNavigate();
  const alertCount = 6;
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [managePermissionsOpen, setManagePermissionsOpen] = useState(false);

  const handleCreateUser = async (userData: UserAccountData): Promise<void> => {
    await createAgent(userData);
    toast.success('Agent créé avec succès');
  };

  // ← async now, matches Promise<void> expected by ManagePermissionsDialog
  const handleUpdatePermissions = async (userId: string, permissions: string[]): Promise<void> => {
    await updateUserPermissions(userId, permissions);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center gap-4 px-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={onMenuClick}
              className="lg:hidden -ml-2 inline-flex items-center justify-center rounded-md p-2 text-foreground hover:bg-accent"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
                <span className="text-white font-bold text-sm">F</span>
              </div>
              <span className="hidden sm:inline-block text-lg font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                FASI
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search products, customers, invoices..."
                className="pl-10 bg-muted/50"
              />
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-full"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative rounded-full p-2 hover:bg-accent transition-colors">
                  <Bell className="h-5 w-5" />
                  {alertCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-red-500 text-white text-xs">
                      {alertCount}
                    </Badge>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-96 overflow-y-auto">
                  <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-red-500">🔴</span>
                      <span className="text-sm font-medium flex-1">Low Stock Alert</span>
                      <span className="text-xs text-muted-foreground">2h ago</span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      Desk Office Chair stock below minimum threshold
                    </p>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-red-500">💰</span>
                      <span className="text-sm font-medium flex-1">Overdue Payment</span>
                      <span className="text-xs text-muted-foreground">5h ago</span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      Digital Services LLC has overdue payment
                    </p>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-yellow-500">📈</span>
                      <span className="text-sm font-medium flex-1">High Sales</span>
                      <span className="text-xs text-muted-foreground">1d ago</span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      AirPods Pro sales increased by 300%
                    </p>
                  </DropdownMenuItem>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="justify-center text-indigo-600 cursor-pointer">
                  View all notifications
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full pl-2 pr-3 py-1 hover:bg-accent transition-colors">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900">
                    <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="hidden md:flex flex-col items-start">
                    <span className="text-sm font-medium">{user?.name || 'User'}</span>
                    <span className="text-xs text-muted-foreground capitalize">{user?.role || 'Role'}</span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                {(user?.role === 'manager' || user?.role === 'admin') && (
                  <DropdownMenuItem>Team</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {(user?.role === 'manager' || user?.role === 'admin') && (
                  <>
                    <DropdownMenuItem onClick={() => setCreateUserOpen(true)} className="gap-2">
                      <UserPlus className="h-4 w-4" />
                      Create User Account
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setManagePermissionsOpen(true)} className="gap-2">
                      <Shield className="h-4 w-4" />
                      Manage Permissions
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem className="text-red-600" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <CreateUserDialog
        open={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
        onCreateUser={handleCreateUser}
      />

      <ManagePermissionsDialog
        open={managePermissionsOpen}
        onClose={() => setManagePermissionsOpen(false)}
        users={users}
        onUpdatePermissions={handleUpdatePermissions}
      />
    </>
  );
}