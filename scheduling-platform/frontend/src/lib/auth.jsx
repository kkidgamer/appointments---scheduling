import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = api.getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      const data = await api.me();
      setUser(data.user);
      setBusiness(data.business);
    } catch {
      api.setToken(null);
      setUser(null);
      setBusiness(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    api.setToken(data.token);
    setUser(data.user);
    setBusiness(data.business);
  };

  const logout = () => {
    api.setToken(null);
    setUser(null);
    setBusiness(null);
  };

  return (
    <AuthContext.Provider value={{ user, business, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
