import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import WebofolioBrand from '@/components/branding/WebofolioBrand';
import { Button } from '@/components/ui/button';

const DefaultFallback = () => (
  <div role="status" aria-label="Loading Webofolio" className="fixed inset-0 flex flex-col items-center justify-center gap-5">
    <WebofolioBrand subtitle="Agency operations" markClassName="h-12 w-12" />
    <div className="h-7 w-7 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
  </div>
);

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { user, isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth, logout } = useAuth();
  const [logoutError, setLogoutError] = useState('');

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    return unauthenticatedElement;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  if (user?.approval_status !== 'approved') {
    const rejected = user?.approval_status === 'rejected';
    const signOut = async () => {
      setLogoutError('');
      try {
        await logout();
      } catch (error) {
        setLogoutError(error?.message || 'Could not sign out. Please try again.');
      }
    };
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-5">
        <section className="w-full max-w-md rounded-2xl border border-border bg-card p-7 text-center shadow-sm">
          <WebofolioBrand subtitle="Agency workspace" markClassName="mx-auto h-11 w-11" />
          <h1 className="mt-7 font-display text-2xl">{rejected ? 'Access not approved' : 'Waiting for administrator approval'}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {rejected
              ? 'Your account is not approved to access this workspace. Contact your administrator if you think this is an error.'
              : 'Your account is ready. An administrator must approve your access before you can view assigned work.'}
          </p>
          {!rejected && <span className="mt-5 inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-800">Approval pending</span>}
          {logoutError && <p role="alert" className="mt-4 text-sm text-destructive">{logoutError}</p>}
          {!rejected && <Button className="mt-5 w-full" onClick={checkUserAuth}>Check approval status</Button>}
          <Button className="mt-2 w-full" variant="outline" onClick={signOut}>Sign out</Button>
        </section>
      </main>
    );
  }

  return <Outlet />;
}

export function AdminRoute() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <Outlet /> : <Navigate to="/" replace />;
}
