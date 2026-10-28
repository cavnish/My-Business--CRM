import { lazy, Suspense, useState } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute, { AdminRoute } from '@/components/ProtectedRoute';
import AppShell from '@/components/layout/AppShell';
import LocalDemo from '@/pages/LocalDemo';
import WebofolioBrand from '@/components/branding/WebofolioBrand';

const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const MyDay = lazy(() => import('@/pages/MyDay'));
const Companies = lazy(() => import('@/pages/Companies'));
const CompanyDetail = lazy(() => import('@/pages/CompanyDetail'));
const Leads = lazy(() => import('@/pages/Leads'));
const Projects = lazy(() => import('@/pages/Projects'));
const ProjectDetail = lazy(() => import('@/pages/ProjectDetail'));
const Tasks = lazy(() => import('@/pages/Tasks'));
const Seo = lazy(() => import('@/pages/Seo'));
const Social = lazy(() => import('@/pages/Social'));
const Payments = lazy(() => import('@/pages/Payments'));
const Bills = lazy(() => import('@/pages/Bills'));
const Calendar = lazy(() => import('@/pages/Calendar'));
const Settings = lazy(() => import('@/pages/Settings'));
const Team = lazy(() => import('@/pages/Team'));
const Goals = lazy(() => import('@/pages/Goals'));

const PageLoading = () => (
  <div role="status" aria-label="Loading Webofolio" className="fixed inset-0 flex flex-col items-center justify-center gap-5">
    <WebofolioBrand subtitle="Agency operations" markClassName="h-12 w-12" />
    <span className="sr-only">Loading page</span>
    <div className="h-7 w-7 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isInitializingWorkspace, isLoadingPublicSettings, authError, navigateToLogin, checkUserAuth, logout } = useAuth();
  const [recoveryError, setRecoveryError] = useState('');

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth || isInitializingWorkspace) {
    return <PageLoading />;
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    } else {
      return (
        <main role="alert" className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center">
            <h1 className="text-lg font-semibold">Unable to verify your session</h1>
            <p className="mt-2 text-sm text-muted-foreground">{authError.message}</p>
            {recoveryError && <p role="alert" className="mt-3 text-sm text-destructive">{recoveryError}</p>}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" className="rounded-md border border-border px-4 py-2 text-sm" onClick={checkUserAuth}>
                Try again
              </button>
              <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                onClick={async () => {
                  setRecoveryError('');
                  try {
                    await logout(false);
                    navigateToLogin();
                  } catch (error) {
                    setRecoveryError(error?.message || 'Could not refresh your sign-in. Please try again.');
                  }
                }}
              >
                Sign out and sign in again
              </button>
            </div>
          </div>
        </main>
      );
    }
  }

  // Render the main app
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/settings" element={<Settings />} />
            <Route element={<AdminRoute />}>
              <Route path="/my-day" element={<MyDay />} />
              <Route path="/companies" element={<Companies />} />
              <Route path="/companies/:id" element={<CompanyDetail />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/seo" element={<Seo />} />
              <Route path="/social" element={<Social />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/bills" element={<Bills />} />
              <Route path="/team" element={<Team />} />
              <Route path="/goals" element={<Goals />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};


function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <ScrollToTop />
        <AppContent />
        <Toaster />
      </Router>
    </QueryClientProvider>
  )
}

function AppContent() {
  const location = useLocation();

  if (import.meta.env.DEV && location.pathname === '/demo') {
    return <LocalDemo />;
  }

  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

export default App