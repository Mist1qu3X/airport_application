import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
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
    toast.success(`Роль изменена на ${role}`);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
  };

  const importFlights = async () => {
    try {
      const res = await api.post('/api/import/flights');
      toast.success(res.data.msg);
    } catch (err) {
      toast.error('Ошибка импорта');
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'developer')) {
    return <p>Доступ запрещён</p>;
  }

  return (
    <div className="admin-page animate-fade-in">
      <h2>Админ-панель</h2>
      
      <button 
        className="btn btn-primary" 
        onClick={importFlights}
        style={{ marginBottom: '20px' }}
      >
        Загрузить рейсы из Aviationstack
      </button>

      {dashboard && (
        <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
          <h3>Дашборд</h3>
          <p>Всего рейсов: <strong>{dashboard.total_flights}</strong></p>
          <p>Задержано: <strong style={{ color: 'var(--danger)' }}>{dashboard.delayed_flights}</strong></p>
          <p>Пунктуальность: <strong style={{ color: 'var(--success)' }}>{dashboard.punctuality}%</strong></p>
        </div>
      )}

      <h3>Пользователи</h3>
      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Логин</th>
            <th>Имя</th>
            <th>Роль</th>
            <th>Действие</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.username}</td>
              <td>{u.full_name}</td>
              <td>
                <span className={`status-badge ${u.role === 'admin' ? 'status-warn' : u.role === 'developer' ? 'status-bad' : 'status-ok'}`}>
                  {u.role}
                </span>
              </td>
              <td>
                <select 
                  value="" 
                  onChange={e => e.target.value && changeRole(u.id, e.target.value)}
                  style={{ padding: '4px 8px' }}
                >
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