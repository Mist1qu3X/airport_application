// src/contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../api/services';
import type { UserProfile, Token } from '../api/types';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('token');
  });

  // Загрузка профиля при наличии токена
  useEffect(() => {
    if (token) {
      loadProfile();
    }
  }, [token]);

  const loadProfile = async () => {
    try {
      const profile = await authApi.getProfile();
      setUser(profile);
    } catch (error) {
      console.error('Ошибка загрузки профиля:', error);
      logout();
    }
  };

  const saveToken = (tokenData: Token) => {
    localStorage.setItem('token', tokenData.access_token);
    setToken(tokenData.access_token);
  };

  const login = async (username: string, password: string) => {
    const tokenData = await authApi.login(username, password);
    saveToken(tokenData);
    await loadProfile();
  };

  const register = async (username: string, password: string, fullName?: string) => {
    const tokenData = await authApi.register({
      username,
      password,
      full_name: fullName || '',
    });
    saveToken(tokenData);
    await loadProfile();
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedUser: UserProfile) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}