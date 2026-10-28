import React, { createContext, useState, useContext, useEffect } from 'react';
import { neonAuth } from '@/api/neonAuthClient';
import { neon } from '@/api/neonDataClient';
import { ensureWorkspaceSeed } from '@/api/seedWorkspace';
import { toast } from '@/components/ui/use-toast';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isInitializingWorkspace, setIsInitializingWorkspace] = useState(false);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      setAppPublicSettings(null);
      setIsLoadingPublicSettings(false);
      await checkUserAuth();
    } catch (error) {
      console.error('Neon Auth initialization failed:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const { data, error } = await neonAuth.getSession({ query: {} });
      if (error) {
        throw error;
      }
      const currentUser = data?.user ?? null;
      if (currentUser) {
        setIsInitializingWorkspace(true);
        const membership = await neon.workspace.ensureMembership();
        const profile = await neon.auth.me();
        setUser({
          ...currentUser,
          ...(profile || {}),
          role: membership.role,
          approval_status: membership.approval_status,
          workspace_owner_id: membership.workspace_owner_id,
        });
        setIsAuthenticated(true);
        setAuthError(null);
        if (membership.role === 'admin' && membership.approval_status === 'approved') {
          try {
            await ensureWorkspaceSeed();
          } catch (error) {
            console.error('Neon workspace initialization failed:', error);
            toast({
              title: 'Neon workspace setup failed',
              description: error.message || 'Check the Neon schema migration and Data API configuration.',
              variant: 'destructive',
            });
          }
        }
        setIsInitializingWorkspace(false);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setAuthError(null);
        setIsInitializingWorkspace(false);
      }
    } catch (error) {
      console.error('Neon Auth session check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setIsInitializingWorkspace(false);
      setAuthError({ type: 'unknown', message: error.message || 'Unable to verify your session.' });
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const refreshUserProfile = async () => {
    const { data, error } = await neonAuth.getSession({ query: {} });
    if (error) throw error;
    if (!data?.user) throw new Error('Your sign-in has expired. Sign in again to update your profile.');

    const profile = await neon.auth.me();
    setUser((current) => ({
      ...current,
      ...data.user,
      ...(profile || {}),
      role: current?.role,
      approval_status: current?.approval_status,
      workspace_owner_id: current?.workspace_owner_id,
    }));
    return profile;
  };

  const logout = async (shouldRedirect = true) => {
    const { error } = await neonAuth.signOut({});
    if (error) {
      throw error;
    }
    setUser(null);
    setIsAuthenticated(false);
    setAuthChecked(true);
    if (shouldRedirect) window.location.assign('/login');
  };

  const navigateToLogin = () => {
    const returnTo = window.location.pathname + window.location.search;
    const query = returnTo === '/' ? '' : `?returnTo=${encodeURIComponent(returnTo)}`;
    window.location.assign(`/login${query}`);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isInitializingWorkspace,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      refreshUserProfile,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
