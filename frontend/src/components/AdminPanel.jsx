import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function AdminPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('flights');

  // Данные
  const [users, setUsers] = useState([]);
  const [flights, setFlights] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [allCities, setAllCities] = useState([]);

  // Форма рейса
  const emptyFlight = {
    flight_number: '', airline: '', origin: '', destination: '',
    scheduled_departure: '', scheduled_arrival: '',
    status: 'scheduled', free_seats: 30, price: 5000, stopovers: '[]'
  };
  const [flightForm, setFlightForm] = useState(emptyFlight);
  const [editingFlightId, setEditingFlightId] = useState(null);
  const [stopoverInput, setStopoverInput] = useState('');
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

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
      const res = await api.get('/api/flights/all');
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

  const loadCities = async () => {
    try {
      const res = await api.get('/api/flights/all');
      const flightsData = res.data;
      const cities = new Set();
      flightsData.forEach(f => {
        if (f.origin) cities.add(f.origin);
        if (f.destination) cities.add(f.destination);
      });
      setAllCities([...cities].sort());
    } catch (err) {
      console.error('Ошибка загрузки городов');
    }
  };

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'developer') {
      loadUsers();
      loadFlights();
      loadDashboard();
      loadCities();
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
    setStopoverInput('');
  };

  const addStopover = (city) => {
    if (!city || city.trim() === '') return;
    
    let currentStopovers = [];
    try {
      currentStopovers = JSON.parse(flightForm.stopovers);
      if (!Array.isArray(currentStopovers)) currentStopovers = [];
    } catch {
      currentStopovers = [];
    }
    
    // Проверяем, есть ли такой город в базе
    if (!allCities.includes(city)) {
      toast.error(`Город "${city}" не найден в базе данных`);
      return;
    }
    
    // Проверяем, нет ли уже такой пересадки
    if (currentStopovers.some(s => s.airport === city)) {
      toast.warning('Эта пересадка уже добавлена');
      return;
    }
    
    currentStopovers.push({
      airport: city,
      arrival: '',
      departure: ''
    });
    
    setFlightForm({...flightForm, stopovers: JSON.stringify(currentStopovers)});
    setStopoverInput('');
    setShowCitySuggestions(false);
  };

  const removeStopover = (index) => {
    let currentStopovers = [];
    try {
      currentStopovers = JSON.parse(flightForm.stopovers);
      if (!Array.isArray(currentStopovers)) return;
    } catch {
      return;
    }
    
    currentStopovers.splice(index, 1);
    setFlightForm({...flightForm, stopovers: JSON.stringify(currentStopovers)});
  };

  const handleFlightSubmit = async (e) => {
    e.preventDefault();
    try {
      let stopovers = [];
      try {
        stopovers = JSON.parse(flightForm.stopovers);
        if (!Array.isArray(stopovers)) stopovers = [];
      } catch { stopovers = []; }

      const payload = { 
        ...flightForm, 
        stopovers, 
        free_seats: Number(flightForm.free_seats), 
        price: Number(flightForm.price) 
      };

      if (editingFlightId) {
        await api.put(`/api/flights/${editingFlightId}`, payload);
        toast.success('Рейс обновлён');
      } else {
        await api.post('/api/flights', payload);
        toast.success('Рейс создан');
      }
      resetFlightForm();
      loadFlights();
      loadCities(); // обновляем список городов
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
      stopovers: JSON.stringify(flight.stopovers || [])
    });
  };

  const deleteFlight = async (id) => {
    if (!window.confirm('Удалить рейс?')) return;
    try {
      await api.delete(`/api/flights/${id}`);
      toast.success('Рейс удалён');
      loadFlights();
      loadCities();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    }
  };

  const importFlights = async () => {
    try {
      const res = await api.post('/api/import/flights');
      toast.success(res.data.msg);
      loadFlights();
      loadCities();
    } catch (err) {
      toast.error('Ошибка импорта');
    }
  };

  const parseStopovers = (stopoversStr) => {
    try {
      const parsed = JSON.parse(stopoversStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(s => s.airport).join(' → ');
      }
      return '—';
    } catch {
      return '—';
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'developer')) {
    return <p>Доступ запрещён</p>;
  }

  return (
    <div className="admin-page animate-fade-in">
      <h2>Админ-панель</h2>

      {/* Вкладки */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['flights', 'users', 'dashboard'].map(tab => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-outline'} btn-sm`}
            onClick={() => setActiveTab(tab)}
          >
            {{ flights: '✈ Рейсы', users: 'Пользователи', dashboard: 'Дашборд' }[tab]}
          </button>
        ))}
        <button className="btn btn-secondary btn-sm" onClick={importFlights}>
          Импорт рейсов
        </button>
      </div>

      {/* Вкладка Рейсы */}
      {activeTab === 'flights' && (
        <div>
          {/* Форма добавления/редактирования */}
          <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
            <h3>{editingFlightId ? 'Редактировать рейс' : 'Добавить новый рейс'}</h3>
            <form onSubmit={handleFlightSubmit}>
              <div className="admin-form-grid">
                <input name="flight_number" placeholder="Номер рейса" value={flightForm.flight_number} onChange={handleFlightChange} required />
                <input name="airline" placeholder="Авиакомпания" value={flightForm.airline} onChange={handleFlightChange} required />
                <input name="origin" placeholder="Откуда" value={flightForm.origin} onChange={handleFlightChange} required />
                <input name="destination" placeholder="Куда" value={flightForm.destination} onChange={handleFlightChange} required />
                <input name="scheduled_departure" type="datetime-local" value={flightForm.scheduled_departure} onChange={handleFlightChange} required />
                <input name="scheduled_arrival" type="datetime-local" value={flightForm.scheduled_arrival} onChange={handleFlightChange} required />
                <input name="free_seats" type="number" placeholder="Свободных мест" value={flightForm.free_seats} onChange={handleFlightChange} />
                <input name="price" type="number" placeholder="Цена (₽)" value={flightForm.price} onChange={handleFlightChange} />
                <select name="status" value={flightForm.status} onChange={handleFlightChange}>
                  <option value="scheduled">По расписанию</option>
                  <option value="boarding">Посадка</option>
                  <option value="delayed">Задержан</option>
                  <option value="departed">Вылетел</option>
                  <option value="landed">Прибыл</option>
                  <option value="cancelled">Отменён</option>
                </select>
              </div>

              {/* Блок пересадок с автодополнением */}
              <div style={{ marginTop: '16px' }}>
                <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>Пересадки</label>
                
                {/* Список добавленных пересадок */}
                {(() => {
                  try {
                    const stops = JSON.parse(flightForm.stopovers);
                    if (Array.isArray(stops) && stops.length > 0) {
                      return (
                        <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {stops.map((stop, idx) => (
                            <span key={idx} style={{
                              background: 'var(--primary)',
                              color: 'white',
                              padding: '6px 12px',
                              borderRadius: '20px',
                              fontSize: '0.85rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}>
                              ✈ {stop.airport}
                              <span 
                                onClick={() => removeStopover(idx)}
                                style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2rem', lineHeight: 1 }}
                                title="Удалить пересадку"
                              >
                                ×
                              </span>
                            </span>
                          ))}
                        </div>
                      );
                    }
                  } catch { return null; }
                  return null;
                })()}
                
                {/* Поле ввода с автодополнением */}
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      placeholder="Введите город пересадки..."
                      value={stopoverInput}
                      onChange={(e) => {
                        setStopoverInput(e.target.value);
                        setShowCitySuggestions(true);
                      }}
                      onFocus={() => setShowCitySuggestions(true)}
                      style={{ flex: 1 }}
                    />
                    <button 
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => addStopover(stopoverInput)}
                    >
                      + Добавить
                    </button>
                  </div>
                  
                  {/* Выпадающий список подсказок */}
                  {showCitySuggestions && stopoverInput.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'var(--bg-white)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow-md)',
                      zIndex: 20,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      marginTop: '4px'
                    }}>
                      {allCities
                        .filter(city => city.toLowerCase().includes(stopoverInput.toLowerCase()))
                        .slice(0, 10)
                        .map(city => (
                          <div
                            key={city}
                            onClick={() => {
                              addStopover(city);
                            }}
                            style={{
                              padding: '10px 14px',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border)',
                              transition: 'background 0.2s',
                              fontSize: '0.9rem'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,102,204,0.05)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            ✈ {city}
                          </div>
                        ))}
                      {allCities.filter(city => city.toLowerCase().includes(stopoverInput.toLowerCase())).length === 0 && (
                        <div style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                          Город не найден в базе
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <small style={{ color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                  Введите город и нажмите «Добавить».
                </small>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary">
                  {editingFlightId ? 'Сохранить изменения' : 'Создать рейс'}
                </button>
                {editingFlightId && (
                  <button type="button" className="btn btn-outline" onClick={resetFlightForm}>
                    Отмена
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Таблица рейсов */}
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Рейс</th>
                  <th>Авиакомпания</th>
                  <th>Маршрут</th>
                  <th>Пересадки</th>
                  <th>Вылет</th>
                  <th>Статус</th>
                  <th>Места</th>
                  <th>Цена</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {flights.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                      Нет рейсов. Нажмите «Импорт рейсов» или создайте новый.
                    </td>
                  </tr>
                )}
                {flights.map(f => (
                  <tr key={f.id}>
                    <td><strong>{f.flight_number}</strong></td>
                    <td>{f.airline}</td>
                    <td>{f.origin} → {f.destination}</td>
                    <td>{parseStopovers(JSON.stringify(f.stopovers || []))}</td>
                    <td>{new Date(f.scheduled_departure).toLocaleString('ru-RU')}</td>
                    <td>
                      <span className={`status-badge status-${f.status === 'scheduled' ? 'ok' : f.status === 'boarding' ? 'warn' : f.status === 'cancelled' ? 'bad' : 'bad'}`}>
                        {f.status === 'scheduled' ? 'По расписанию' : 
                         f.status === 'boarding' ? 'Посадка' : 
                         f.status === 'delayed' ? 'Задержан' : 
                         f.status === 'departed' ? 'Вылетел' : 
                         f.status === 'landed' ? 'Прибыл' : f.status}
                      </span>
                    </td>
                    <td>{f.free_seats}</td>
                    <td>{f.price?.toLocaleString()} ₽</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => editFlight(f)} title="Редактировать">✎</button>
                        <button 
                          className="btn btn-outline btn-sm" 
                          onClick={() => deleteFlight(f.id)} 
                          style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                          title="Удалить"
                        >
                          ✕
                        </button>
                      </div>
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
                <th>ID</th>
                <th>Логин</th>
                <th>Имя</th>
                <th>Роль</th>
                <th>Бонусы</th>
                <th>Сменить роль</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td><strong>{u.username}</strong></td>
                  <td>{u.full_name || '—'}</td>
                  <td>
                    <span className={`status-badge ${u.role === 'admin' ? 'status-warn' : u.role === 'developer' ? 'status-bad' : 'status-ok'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>{u.bonuses || 0}</td>
                  <td>
                    {user?.role === 'developer' ? (
                      <select 
                        value="" 
                        onChange={e => e.target.value && changeRole(u.id, e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: '6px' }}
                      >
                        <option value="">Выбрать...</option>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                        <option value="developer">Developer</option>
                      </select>
                    ) : (
                      <span style={{ color: 'var(--text-light)', fontSize: '0.8rem' }}>
                        Только разработчик
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Вкладка Дашборд */}
      {activeTab === 'dashboard' && dashboard && (
        <div>
          <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
            <h3>Общая статистика</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginTop: '16px' }}>
              <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700 }}>{dashboard.total_flights}</div>
                <div style={{ color: 'var(--text-secondary)' }}>Всего рейсов</div>
              </div>
              <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--danger)' }}>{dashboard.delayed_flights}</div>
                <div style={{ color: 'var(--text-secondary)' }}>Задержано</div>
              </div>
              <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)' }}>{dashboard.punctuality}%</div>
                <div style={{ color: 'var(--text-secondary)' }}>Пунктуальность</div>
              </div>
              <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700 }}>{dashboard.avg_delay_minutes} мин</div>
                <div style={{ color: 'var(--text-secondary)' }}>Средняя задержка</div>
              </div>
            </div>
          </div>
          
          {dashboard.top_route?.origin && (
            <div className="card" style={{ padding: '20px' }}>
              <h3>Самый загруженный маршрут</h3>
              <p style={{ fontSize: '1.2rem', marginTop: '8px' }}>
                <strong>{dashboard.top_route.origin}</strong> → <strong>{dashboard.top_route.destination}</strong>
              </p>
              <p style={{ color: 'var(--text-secondary)' }}>{dashboard.top_route.flights} рейсов</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'dashboard' && !dashboard && (
        <p>Загрузка данных...</p>
      )}
    </div>
  );
}