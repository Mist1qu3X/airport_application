import { createContext, useState, useContext, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/api/profile')
        .then(res => setUser(res.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/api/login', null, { params: { username, password } });
    localStorage.setItem('token', res.data.access_token);
    const profile = await api.get('/api/profile');
    setUser(profile.data);
    return profile.data;
  };

  const register = async (username, password, fullName) => {
    const res = await api.post('/api/register', { username, password, full_name: fullName });
    localStorage.setItem('token', res.data.access_token);
    const profile = await api.get('/api/profile');
    setUser(profile.data);
    return profile.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);