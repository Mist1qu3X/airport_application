import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await login(username, password);
      navigate('/');
    } catch { alert('Ошибка входа'); }
  };

  return (
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="auth-card card animate-fade-in">
        <h2>Вход</h2>
        <div className="form-group">
          <label>Логин</label>
          <input value={username} onChange={e => setUsername(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Пароль</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Войти</button>
      </form>
    </div>
  );
}