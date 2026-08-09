import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { LoginPage } from '@/pages/LoginPage';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { SystemSettingsPage } from '@/pages/SystemSettingsPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function RedirectWithQuery({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <DashboardPage view="dashboard" />
          </RequireAuth>
        }
      />
      <Route
        path="/analytics"
        element={
          <RequireAuth>
            <DashboardPage view="analytics" />
          </RequireAuth>
        }
      />
      <Route
        path="/my-prs"
        element={
          <RequireAuth>
            <DashboardPage view="my-prs" />
          </RequireAuth>
        }
      />
      <Route
        path="/my-reviews"
        element={
          <RequireAuth>
            <DashboardPage view="my-reviews" />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings/system"
        element={
          <RequireAuth>
            <SystemSettingsPage />
          </RequireAuth>
        }
      />
      <Route path="/people" element={<RedirectWithQuery to="/settings/system" />} />
      <Route path="/trends" element={<Navigate to="/analytics" replace />} />
    </Routes>
  );
}
