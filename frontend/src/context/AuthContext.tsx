import { createContext, useContext, useMemo, useState, ReactNode } from 'react';

type AuthContextValue = {
  token: string | null;
  setToken: (token: string | null) => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem('token'));

  const setToken = (next: string | null) => {
    if (next) {
      localStorage.setItem('token', next);
    } else {
      localStorage.removeItem('token');
    }
    setTokenState(next);
  };

  const value = useMemo(
    () => ({ token, setToken, isAuthenticated: !!token }),
    [token],
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
