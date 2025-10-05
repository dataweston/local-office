'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type AuthState = {
  token: string | null;
  email: string | null;
  baseUrl: string;
};

type AuthContextValue = {
  token: string | null;
  email: string | null;
  baseUrl: string;
  isAuthenticated: boolean;
  signIn: (options: { token: string; email?: string | null; baseUrl?: string }) => void;
  signOut: () => void;
  updateBaseUrl: (baseUrl: string) => void;
};

const STORAGE_KEY = 'local-office.auth';
const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/mock';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ token: null, email: null, baseUrl: DEFAULT_BASE_URL });
  const [isHydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<AuthState>;
        setState((current) => ({
          token: parsed.token ?? current.token,
          email: parsed.email ?? current.email ?? null,
          baseUrl: parsed.baseUrl ?? current.baseUrl
        }));
      } catch (error) {
        console.warn('Failed to parse auth state', error);
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [isHydrated, state]);

  const signIn = useCallback(({ token, email, baseUrl }: { token: string; email?: string | null; baseUrl?: string }) => {
    setState({ token, email: email ?? null, baseUrl: baseUrl || DEFAULT_BASE_URL });
  }, []);

  const signOut = useCallback(() => {
    setState({ token: null, email: null, baseUrl: DEFAULT_BASE_URL });
  }, []);

  const updateBaseUrl = useCallback((baseUrl: string) => {
    setState((current) => ({ ...current, baseUrl }));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    token: state.token,
    email: state.email,
    baseUrl: state.baseUrl,
    isAuthenticated: Boolean(state.token),
    signIn,
    signOut,
    updateBaseUrl
  }), [signIn, signOut, state.baseUrl, state.email, state.token, updateBaseUrl]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
