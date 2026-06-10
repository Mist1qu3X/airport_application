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

  // API импорт
  const [apiUrl, setApiUrl] = useState('');
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [apiSuccess, setApiSuccess] = useState('');

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

  // Автоматическое обновление статусов
  const autoUpdateStatuses = async () => {
    try {
      const res = await api.post('/api/flights/auto-update-statuses');
      if (res.data.updated > 0) {
        toast.info(`Обновлено статусов: ${res.data.updated}`);
        loadFlights();
      }
    } catch (err) {
      console.error('Ошибка автообновления статусов');
    }
  };

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'developer') {
      loadUsers();
      loadFlights();
      loadDashboard();
      loadCities();
      
      // Автообновление статусов при загрузке
      autoUpdateStatuses();
      
      // И каждые 5 минут
      const interval = setInterval(() => {
        autoUpdateStatuses();
      }, 5 * 60 * 1000);
      
      return () => clearInterval(interval);
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
    
    if (!allCities.includes(city)) {
      toast.error(`Город "${city}" не найден в базе данных`);
      return;
    }
    
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
      loadCities();
      autoUpdateStatuses();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    }
  };

  const editFlight = (flight) => {
    // Запрет на редактирование завершённых рейсов
    if (flight.status === 'departed' || flight.status === 'landed') {
      toast.warning('Нельзя редактировать завершённый рейс');
      return;
    }
    
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
    const flight = flights.find(f => f.id === id);
    // Запрет на удаление завершённых рейсов
    if (flight && (flight.status === 'departed' || flight.status === 'landed')) {
      toast.warning('Нельзя удалить завершённый рейс');
      return;
    }
    
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

  // Импорт из внешнего API
  const importFromExternalApi = async () => {
    if (!apiUrl.trim()) {
      setApiError('Введите URL API');
      return;
    }
    
    setApiLoading(true);
    setApiError('');
    setApiSuccess('');
    
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('API должен возвращать массив рейсов');
      }
      
      let imported = 0;
      let errors = 0;
      
      for (const item of data) {
        try {
          const payload = {
            flight_number: item.flight_number || item.flightNumber || item.code,
            airline: item.airline || item.carrier || 'Unknown',
            origin: item.origin || item.departure_airport || item.from,
            destination: item.destination || item.arrival_airport || item.to,
            scheduled_departure: item.scheduled_departure || item.departure_time || item.departure,
            scheduled_arrival: item.scheduled_arrival || item.arrival_time || item.arrival,
            status: 'scheduled',
            free_seats: item.free_seats || item.available_seats || 30,
            capacity: item.capacity || item.total_seats || 150,
            price: item.price || item.fare || 5000,
            stopovers: item.stopovers || []
          };
          
          await api.post('/api/flights', payload);
          imported++;
        } catch (err) {
          errors++;
          console.error('Ошибка импорта рейса:', item, err);
        }
      }
      
      setApiSuccess(`Импортировано: ${imported} рейсов, ошибок: ${errors}`);
      loadFlights();
      loadCities();
      autoUpdateStatuses();
      
    } catch (err) {
      setApiError(err.message);
    } finally {
      setApiLoading(false);
    }
  };

  const importFlights = async () => {
    try {
      const res = await api.post('/api/import/flights');
      toast.success(res.data.msg);
      loadFlights();
      loadCities();
      autoUpdateStatuses();
    } catch (err) {
      toast.error('Ошибка импорта');
    }
  };

  // Ручное обновление статусов
  const syncFlightStatuses = async () => {
    try {
      const res = await api.post('/api/flights/auto-update-statuses');
      toast.success(res.data.msg);
      loadFlights();
    } catch (err) {
      toast.error('Ошибка обновления статусов');
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

  const getStatusText = (status) => {
    switch(status) {
      case 'scheduled': return 'По расписанию';
      case 'boarding': return 'Посадка';
      case 'delayed': return 'Задержан';
      case 'departed': return 'Вылетел';
      case 'landed': return 'Прибыл';
      case 'cancelled': return 'Отменён';
      default: return status;
    }
  };

  const getStatusClass = (status) => {
    switch(status) {
      case 'scheduled': return 'status-ok';
      case 'boarding': return 'status-warn';
      case 'delayed': return 'status-bad';
      case 'departed': return 'status-ok';
      case 'landed': return 'status-ok';
      case 'cancelled': return 'status-bad';
      default: return '';
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
        <button className="btn btn-secondary btn-sm" onClick={syncFlightStatuses}>
          Обновить статусы
        </button>
      </div>

      {/* Блок импорта из внешнего API */}
      <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <h4 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>Импорт рейсов</h4>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="https://api.example.com/flights"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            style={{ flex: 2, minWidth: '250px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
          />
          <button className="btn btn-primary" onClick={importFromExternalApi} disabled={apiLoading}>
            {apiLoading ? 'Загрузка...' : 'Импорт из API'}
          </button>
          <button className="btn btn-secondary" onClick={importFlights} disabled={apiLoading}>
            Сгенерировать тестовые
          </button>
        </div>
        {apiError && <p style={{ color: '#e94560', marginTop: '8px', fontSize: '0.8rem' }}>{apiError}</p>}
        {apiSuccess && <p style={{ color: '#4caf50', marginTop: '8px', fontSize: '0.8rem' }}>{apiSuccess}</p>}
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
                
                {/* Блок статуса с защитой для завершённых рейсов */}
                {editingFlightId && flights.find(f => f.id === editingFlightId)?.status === 'departed' ? (
                  <input type="text" value="Вылетел" disabled style={{ padding: '10px', background: '#f0f0f0', borderRadius: '8px', border: '1px solid #ddd' }} />
                ) : editingFlightId && flights.find(f => f.id === editingFlightId)?.status === 'landed' ? (
                  <input type="text" value="Прибыл" disabled style={{ padding: '10px', background: '#f0f0f0', borderRadius: '8px', border: '1px solid #ddd' }} />
                ) : (
                  <select name="status" value={flightForm.status} onChange={handleFlightChange}>
                    <option value="scheduled">По расписанию</option>
                    <option value="boarding">Посадка</option>
                    <option value="delayed">Задержан</option>
                    <option value="departed">Вылетел</option>
                    <option value="landed">Прибыл</option>
                    <option value="cancelled">Отменён</option>
                  </select>
                )}
              </div>

              {/* Блок пересадок */}
              <div style={{ marginTop: '16px' }}>
                <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>Пересадки</label>
                
                {(() => {
                  try {
                    const stops = JSON.parse(flightForm.stopovers);
                    if (Array.isArray(stops) && stops.length > 0) {
                      return (
                        <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {stops.map((stop, idx) => (
                            <span key={idx} style={{
                              background: '#6c5ce7',
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
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => addStopover(stopoverInput)}>
                      + Добавить
                    </button>
                  </div>
                  
                  {showCitySuggestions && stopoverInput.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'white',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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
                            onClick={() => addStopover(city)}
                            style={{
                              padding: '10px 14px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #eee'
                            }}
                          >
                            ✈ {city}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                <small style={{ color: '#888', marginTop: '4px', display: 'block' }}>
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
                  <th>Рейс</th><th>Авиакомпания</th><th>Маршрут</th><th>Пересадки</th>
                  <th>Вылет</th><th>Статус</th><th>Места</th><th>Цена</th><th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {flights.length === 0 && (
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>Нет рейсов. Нажмите «Импорт рейсов» или создайте новый.</td></tr>
                )}
                {flights.map(f => (
                  <tr key={f.id}>
                    <td><strong>{f.flight_number}</strong></td>
                    <td>{f.airline}</td>
                    <td>{f.origin} → {f.destination}</td>
                    <td>{parseStopovers(JSON.stringify(f.stopovers || []))}</td>
                    <td>{new Date(f.scheduled_departure).toLocaleString('ru-RU')}</td>
                    <td>
                      <span className={`status-badge ${getStatusClass(f.status)}`}>
                        {getStatusText(f.status)}
                      </span>
                    </td>
                    <td>{f.free_seats} / {f.capacity || 30}</td>
                    <td>{f.price?.toLocaleString()} ₽</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {f.status !== 'departed' && f.status !== 'landed' ? (
                          <>
                            <button className="btn btn-outline btn-sm" onClick={() => editFlight(f)}>✎</button>
                            <button className="btn btn-outline btn-sm" onClick={() => deleteFlight(f.id)} style={{ color: '#e94560' }}>✕</button>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: '#888' }}>Завершён</span>
                        )}
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
            <thead><tr><th>ID</th><th>Логин</th><th>Имя</th><th>Роль</th><th>Бонусы</th><th>Сменить роль</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td><strong>{u.username}</strong></td>
                  <td>{u.full_name || '—'}</td>
                  <td><span className={`status-badge ${u.role === 'admin' ? 'status-warn' : u.role === 'developer' ? 'status-bad' : 'status-ok'}`}>{u.role}</span></td>
                  <td>{u.bonuses || 0}</td>
                  <td>
                    {user?.role === 'developer' ? (
                      <select onChange={e => e.target.value && changeRole(u.id, e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px' }}>
                        <option value="">Выбрать...</option>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                        <option value="developer">Developer</option>
                      </select>
                    ) : <span style={{ fontSize: '0.8rem' }}>Только разработчик</span>}
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
                <div>Всего рейсов</div>
              </div>
              <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#e94560' }}>{dashboard.delayed_flights}</div>
                <div>Задержано</div>
              </div>
              <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#4caf50' }}>{dashboard.punctuality}%</div>
                <div>Пунктуальность</div>
              </div>
              <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700 }}>{dashboard.avg_delay_minutes} мин</div>
                <div>Средняя задержка</div>
              </div>
            </div>
          </div>
          {dashboard.top_route?.origin && (
            <div className="card" style={{ padding: '20px' }}>
              <h3>Самый загруженный маршрут</h3>
              <p><strong>{dashboard.top_route.origin}</strong> → <strong>{dashboard.top_route.destination}</strong> ({dashboard.top_route.flights} рейсов)</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}