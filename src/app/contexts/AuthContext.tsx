import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../../api/client';

export type User = {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'instructor' | 'admin';
  username?: string | null;
  avatar?: string | null;
  bio?: string | null;
  notifications_enabled?: number;
};

const MAIN_SITE = import.meta.env.VITE_MAIN_SITE_URL || 'https://aziral.com';

type AuthContextType = {
  user: User | null;
  token: null; // cookie-based, no token exposed in client
  loading: boolean;
  logout: () => void;
  updateUser: (u: User) => void;
  refetch: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const data = await authApi.me();
      setUser(data as User);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check SSO cookie on mount
  useEffect(() => { fetchMe(); }, [fetchMe]);

  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener('azr:banned', handler);
    return () => window.removeEventListener('azr:banned', handler);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    authApi.logout().catch(() => {});
    window.location.href = MAIN_SITE;
  }, []);

  const updateUser = useCallback((u: User) => setUser(u), []);

  return (
    <AuthContext.Provider value={{ user, token: null, loading, logout, updateUser, refetch: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
