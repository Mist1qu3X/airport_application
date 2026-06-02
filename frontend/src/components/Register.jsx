import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await register(username, password, fullName);
      navigate('/');
    } catch (err) {
      alert('Ошибка регистрации');
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '400px', margin: '40px auto', background: 'white', padding: '30px', borderRadius: '12px' }}>
      <h2>Регистрация</h2>
      <input placeholder="Логин" value={username} onChange={e => setUsername(e.target.value)} required
        style={{ width: '100%', padding: '10px', margin: '10px 0', borderRadius: '8px', border: '1px solid #ddd' }} />
      <input type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} required
        style={{ width: '100%', padding: '10px', margin: '10px 0', borderRadius: '8px', border: '1px solid #ddd' }} />
      <input placeholder="Полное имя" value={fullName} onChange={e => setFullName(e.target.value)}
        style={{ width: '100%', padding: '10px', margin: '10px 0', borderRadius: '8px', border: '1px solid #ddd' }} />
      <button type="submit" style={{ width: '100%', padding: '12px', background: '#0066cc', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
        Зарегистрироваться
      </button>
    </form>
  );
}