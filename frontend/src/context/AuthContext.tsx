import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import { useQuery } from '@apollo/client';
import { ME_QUERY } from '@/graphql/auth';

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  role: string;
  permissions: string[];
};

type AuthContextValue = {
  token: string | null;
  setToken: (token: string | null) => void;
  isAuthenticated: boolean;
  user: CurrentUser | null;
  can: (permission: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem('token'));

  const { data } = useQuery<{ me: CurrentUser }>(ME_QUERY, {
    skip: !token,
    fetchPolicy: 'cache-first',
  });

  const setToken = useCallback((next: string | null) => {
    if (next) {
      localStorage.setItem('token', next);
    } else {
      localStorage.removeItem('token');
    }
    setTokenState(next);
  }, []);

  const user = data?.me ?? null;

  const value = useMemo(
    () => ({
      token,
      setToken,
      isAuthenticated: !!token,
      user,
      can: (permission: string) => user?.permissions.includes(permission) ?? false,
    }),
    [token, setToken, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
