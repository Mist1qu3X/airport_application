import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function AdminPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'developer') {
      api.get('/api/users').then(res => setUsers(res.data));
      api.get('/api/reports/dashboard').then(res => setDashboard(res.data));
    }
  }, [user]);

  const changeRole = async (userId, role) => {
    await api.put(`/api/users/${userId}/role?role=${role}`);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
  };

  const importFlights = async () => {
    try {
      const res = await api.post('/api/import/flights');
      alert(res.data.msg);
    } catch (err) {
      alert('Ошибка импорта');
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'developer')) return <p>Доступ запрещён</p>;

  return (
    <div>
      <h2>Админ-панель</h2>
      <button onClick={importFlights} style={{ marginBottom: '20px', padding: '10px 20px', background: '#0066cc', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
        Загрузить рейсы из Aviationstack
      </button>

      {dashboard && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <h3>Дашборд</h3>
          <p>Всего рейсов: {dashboard.total_flights}</p>
          <p>Задержано: {dashboard.delayed_flights}</p>
          <p>Пунктуальность: {dashboard.punctuality}%</p>
        </div>
      )}

      <h3>Пользователи</h3>
      <table style={{ width: '100%', background: 'white', borderRadius: '12px', overflow: 'hidden', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ padding: '10px' }}>ID</th>
            <th>Логин</th>
            <th>Имя</th>
            <th>Роль</th>
            <th>Действие</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} style={{ borderTop: '1px solid #eee' }}>
              <td style={{ padding: '10px' }}>{u.id}</td>
              <td>{u.username}</td>
              <td>{u.full_name}</td>
              <td>{u.role}</td>
              <td>
                <select value="" onChange={e => e.target.value && changeRole(u.id, e.target.value)}>
                  <option value="">Изменить роль</option>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                  <option value="developer">developer</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}