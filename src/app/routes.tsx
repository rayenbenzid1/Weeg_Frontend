import { createBrowserRouter, Navigate } from 'react-router';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { MainLayout } from './layouts/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import { DataImportPage } from './pages/DataImportPage';
import { KPIEnginePage } from './pages/KPIEnginePage';
import { TransactionsPage } from './pages/TransactionsPage';
import { InventoryPage } from './pages/InventoryPage';
import { AlertsPage } from './pages/AlertsPage';
import { AgingPage } from './pages/AgingPage';
import { ReportsPage } from './pages/ReportsPage';
import { AIInsightsPage } from './pages/AIInsightsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminVerificationPage } from './pages/AdminVerificationPage';
import { ProfilePage } from './pages/ProfilePage';
import { TeamPage } from './pages/TeamPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/signup',
    element: <SignupPage />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/dashboard',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'team',
        element: <TeamPage />,
      },
      {
        path: 'import',
        element: <DataImportPage />,
      },
      {
        path: 'kpi',
        element: <KPIEnginePage />,
      },
      {
        path: 'sales',
        element: <TransactionsPage />,
      },
      {
        path: 'inventory',
        element: <InventoryPage />,
      },
      {
        path: 'alerts',
        element: <AlertsPage />,
      },
      {
        path: 'aging',
        element: <AgingPage />,
      },
      {
        path: 'reports',
        element: <ReportsPage />,
      },
      {
        path: 'ai-insights',
        element: <AIInsightsPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'admin-verification',
        element: <AdminVerificationPage />,
      },
      {
        path: 'profile',
        element: <ProfilePage />,
      },

    ],
  },
]);