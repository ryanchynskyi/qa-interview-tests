import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthResponse, AuthUser, LoginRequest, RegisterRequest } from '@qa-hub/shared';
import { api, onSession, refreshSession, setAccessToken } from '../api';

export type AuthState =
  { status: 'loading' } | { status: 'guest' } | { status: 'user'; user: AuthUser };

interface AuthContextValue {
  state: AuthState;
  login: (body: LoginRequest) => Promise<void>;
  register: (body: Omit<RegisterRequest, 'timeZone'>) => Promise<void>;
  logout: () => Promise<void>;
  /** After a profile edit (name, time zone). */
  updateUser: (user: AuthUser) => void;
  /** After the account was deleted: the server already cleared the cookie. */
  forget: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    // Any session change (refresh, expiry) flows through here.
    onSession((s) => setState(s ? { status: 'user', user: s.user } : { status: 'guest' }));
    // Restore the session from the httpOnly refresh cookie, if there is one. If the API
    // can't be reached at all, continue as a guest; nothing on the server is lost.
    refreshSession().catch(() => setState({ status: 'guest' }));
  }, []);

  const start = (s: AuthResponse) => {
    setAccessToken(s.accessToken);
    setState({ status: 'user', user: s.user });
  };

  const value: AuthContextValue = {
    state,
    login: async (body) => start(await api.login(body)),
    register: async (body) =>
      start(
        await api.register({
          ...body,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        }),
      ),
    updateUser: (user) => setState((s) => (s.status === 'user' ? { status: 'user', user } : s)),
    forget: () => {
      setAccessToken(null);
      setState({ status: 'guest' });
    },
    logout: async () => {
      try {
        await api.logout();
      } finally {
        setAccessToken(null);
        setState({ status: 'guest' });
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() outside <AuthProvider>');
  return ctx;
}
