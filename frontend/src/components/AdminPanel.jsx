import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function AdminPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('flights'); // flights | users | dashboard

  // Данные
  const [users, setUsers] = useState([]);
  const [flights, setFlights] = useState([]);
  const [dashboard, setDashboard] = useState(null);

  // Форма рейса
  const emptyFlight = {
    flight_number: '', airline: '', origin: '', destination: '',
    scheduled_departure: '', scheduled_arrival: '',
    status: 'scheduled', free_seats: 30, price: 5000, stopovers: '[]'
  };
  const [flightForm, setFlightForm] = useState(emptyFlight);
  const [editingFlightId, setEditingFlightId] = useState(null);

  // Загрузка данных
  const loadUsers = async () => {
    try {
      const res = await api.get('/api/users');
      setUsers(res.data);
    } catch (err) {
      toast.error('Ошибка загрузки пользователей');
    }
  };

  const loadFlights = async () => {
    try {
      // Получаем все рейсы без фильтра статуса
      const res = await api.get('/api/flights', { params: { status: '' } });
      setFlights(res.data);
    } catch (err) {
      toast.error('Ошибка загрузки рейсов');
    }
  };

  const loadDashboard = async () => {
    try {
      const res = await api.get('/api/reports/dashboard');
      setDashboard(res.data);
    } catch (err) {
      toast.error('Ошибка загрузки дашборда');
    }
  };

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'developer') {
      loadUsers();
      loadFlights();
      loadDashboard();
    }
  }, [user]);

  // Смена роли пользователя
  const changeRole = async (userId, role) => {
    try {
      await api.put(`/api/users/${userId}/role?role=${role}`);
      toast.success(`Роль изменена на ${role}`);
      loadUsers();
    } catch (err) {
      toast.error('Ошибка');
    }
  };

  // Управление рейсами
  const handleFlightChange = (e) => {
    setFlightForm({ ...flightForm, [e.target.name]: e.target.value });
  };

  const resetFlightForm = () => {
    setFlightForm(emptyFlight);
    setEditingFlightId(null);
  };

  const handleFlightSubmit = async (e) => {
    e.preventDefault();
    try {
      // Преобразуем stopovers из строки JSON в массив (если введено)
      let stopovers = [];
      try {
        stopovers = JSON.parse(flightForm.stopovers);
      } catch { stopovers = []; }

      const payload = { ...flightForm, stopovers, free_seats: Number(flightForm.free_seats), price: Number(flightForm.price) };

      if (editingFlightId) {
        await api.put(`/api/flights/${editingFlightId}`, payload);
        toast.success('Рейс обновлён');
      } else {
        await api.post('/api/flights', payload);
        toast.success('Рейс создан');
      }
      resetFlightForm();
      loadFlights();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    }
  };

  const editFlight = (flight) => {
    setEditingFlightId(flight.id);
    setFlightForm({
      flight_number: flight.flight_number,
      airline: flight.airline,
      origin: flight.origin,
      destination: flight.destination,
      scheduled_departure: flight.scheduled_departure?.slice(0, 16),
      scheduled_arrival: flight.scheduled_arrival?.slice(0, 16),
      status: flight.status,
      free_seats: flight.free_seats,
      price: flight.price,
      stopovers: JSON.stringify(flight.stopovers)
    });
  };

  const deleteFlight = async (id) => {
    if (!window.confirm('Удалить рейс?')) return;
    try {
      await api.delete(`/api/flights/${id}`);
      toast.success('Рейс удалён');
      loadFlights();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    }
  };

  const importFlights = async () => {
    try {
      const res = await api.post('/api/import/flights');
      toast.success(res.data.msg);
      loadFlights();
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

      {/* Вкладки */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {['flights', 'users', 'dashboard'].map(tab => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-outline'} btn-sm`}
            onClick={() => setActiveTab(tab)}
          >
            {{ flights: 'Рейсы', users: 'Пользователи', dashboard: 'Дашборд' }[tab]}
          </button>
        ))}
        <button className="btn btn-secondary btn-sm" onClick={importFlights}>
          Импорт из API
        </button>
      </div>

      {/* Вкладка Рейсы */}
      {activeTab === 'flights' && (
        <div>
          {/* Форма добавления/редактирования */}
          <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
            <h3>{editingFlightId ? 'Редактировать рейс' : 'Добавить рейс'}</h3>
            <form onSubmit={handleFlightSubmit}>
              <div className="admin-form-grid">
                <input name="flight_number" placeholder="Номер рейса" value={flightForm.flight_number} onChange={handleFlightChange} required />
                <input name="airline" placeholder="Авиакомпания" value={flightForm.airline} onChange={handleFlightChange} required />
                <input name="origin" placeholder="Откуда" value={flightForm.origin} onChange={handleFlightChange} required />
                <input name="destination" placeholder="Куда" value={flightForm.destination} onChange={handleFlightChange} required />
                <input name="scheduled_departure" type="datetime-local" value={flightForm.scheduled_departure} onChange={handleFlightChange} required />
                <input name="scheduled_arrival" type="datetime-local" value={flightForm.scheduled_arrival} onChange={handleFlightChange} required />
                <input name="free_seats" type="number" placeholder="Свободных мест" value={flightForm.free_seats} onChange={handleFlightChange} />
                <input name="price" type="number" placeholder="Цена" value={flightForm.price} onChange={handleFlightChange} />
                <select name="status" value={flightForm.status} onChange={handleFlightChange}>
                  <option value="scheduled">По расписанию</option>
                  <option value="boarding">Посадка</option>
                  <option value="delayed">Задержан</option>
                  <option value="departed">Вылетел</option>
                  <option value="landed">Прибыл</option>
                  <option value="cancelled">Отменён</option>
                </select>
                <input name="stopovers" placeholder="Пересадки (JSON)" value={flightForm.stopovers} onChange={handleFlightChange} />
              </div>
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary">{editingFlightId ? 'Сохранить' : 'Создать'}</button>
                {editingFlightId && <button type="button" className="btn btn-outline" onClick={resetFlightForm}>Отмена</button>}
              </div>
            </form>
          </div>

          {/* Таблица рейсов */}
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Рейс</th><th>Маршрут</th><th>Вылет</th><th>Статус</th><th>Места</th><th>Цена</th><th></th>
                </tr>
              </thead>
              <tbody>
                {flights.map(f => (
                  <tr key={f.id}>
                    <td>{f.flight_number}</td>
                    <td>{f.origin} → {f.destination}</td>
                    <td>{new Date(f.scheduled_departure).toLocaleString('ru-RU')}</td>
                    <td><span className={`status-badge status-${f.status === 'scheduled' ? 'ok' : f.status === 'boarding' ? 'warn' : 'bad'}`}>{f.status}</span></td>
                    <td>{f.free_seats}</td>
                    <td>{f.price} ₽</td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => editFlight(f)}>✎</button>
                      <button className="btn btn-outline btn-sm" onClick={() => deleteFlight(f.id)} style={{ color: 'var(--danger)', borderColor: 'var(--danger)', marginLeft: '4px' }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Вкладка Пользователи */}
      {activeTab === 'users' && (
        <div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th><th>Логин</th><th>Имя</th><th>Роль</th><th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.id}</td>
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
      )}

      {/* Вкладка Дашборд */}
      {activeTab === 'dashboard' && dashboard && (
        <div className="card" style={{ padding: '20px' }}>
          <h3>Дашборд</h3>
          <p>Всего рейсов: <strong>{dashboard.total_flights}</strong></p>
          <p>Задержано: <strong style={{ color: 'var(--danger)' }}>{dashboard.delayed_flights}</strong></p>
          <p>Пунктуальность: <strong style={{ color: 'var(--success)' }}>{dashboard.punctuality}%</strong></p>
          <p>Средняя задержка: {dashboard.avg_delay_minutes} мин</p>
          {dashboard.top_route?.origin && (
            <p>Самый загруженный маршрут: {dashboard.top_route.origin} → {dashboard.top_route.destination} ({dashboard.top_route.flights} рейсов)</p>
          )}
        </div>
      )}
    </div>
  );
}