// src/pages/AdminPanel.tsx
import { useEffect, useState, FormEvent, ChangeEvent } from 'react';
import { toast } from 'react-toastify';
import { flightsApi, adminApi, dashboardApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import type { 
  Flight, 
  FlightCreate, 
  FlightUpdate, 
  FlightStatus,
  UserShort, 
  DashboardMetrics 
} from '../api/types';
import { toMoscowTime, toUtcFromMoscow, toMoscowDateTimeLocal } from '../utils/date';

type AdminTab = 'flights' | 'users' | 'dashboard';

interface FlightFormData {
  flight_number: string;
  airline: string;
  origin: string;
  destination: string;
  scheduled_departure: string; // локальное время в формате YYYY-MM-DDTHH:MM
  scheduled_arrival: string;
  status: FlightStatus;
  capacity: number;
  price: number;
  stopovers: string;
}

const EMPTY_FLIGHT_FORM: FlightFormData = {
  flight_number: '',
  airline: '',
  origin: '',
  destination: '',
  scheduled_departure: '',
  scheduled_arrival: '',
  status: 'scheduled',
  capacity: 180,
  price: 5000,
  stopovers: '[]'
};

const STATUS_OPTIONS: { value: FlightStatus; label: string }[] = [
  { value: 'scheduled', label: 'По расписанию' },
  { value: 'boarding', label: 'Посадка' },
  { value: 'delayed', label: 'Задержан' },
  { value: 'departed', label: 'Вылетел' },
  { value: 'landed', label: 'Прибыл' },
  { value: 'cancelled', label: 'Отменён' },
];

export default function AdminPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('flights');

  const [users, setUsers] = useState<UserShort[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [dashboard, setDashboard] = useState<DashboardMetrics | null>(null);
  const [allCities, setAllCities] = useState<string[]>([]);

  const [apiUrl, setApiUrl] = useState('');
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [apiSuccess, setApiSuccess] = useState('');

  const [flightForm, setFlightForm] = useState<FlightFormData>(EMPTY_FLIGHT_FORM);
  const [editingFlightId, setEditingFlightId] = useState<number | null>(null);
  const [stopoverInput, setStopoverInput] = useState('');
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

  const loadUsers = async () => {
    try {
      const data = await adminApi.getUsers();
      setUsers(data);
    } catch { toast.error('Ошибка загрузки пользователей'); }
  };

  const loadFlights = async () => {
    try {
      const data = await flightsApi.getAll();
      setFlights(data);
    } catch { toast.error('Ошибка загрузки рейсов'); }
  };

  const loadDashboard = async () => {
    try {
      const data = await dashboardApi.getMetrics();
      setDashboard(data);
    } catch { toast.error('Ошибка загрузки дашборда'); }
  };

  const loadCities = async () => {
    try {
      const data = await flightsApi.getAll();
      const cities = new Set<string>();
      data.forEach(f => {
        if (f.origin) cities.add(f.origin);
        if (f.destination) cities.add(f.destination);
      });
      setAllCities([...cities].sort());
    } catch { console.error('Ошибка загрузки городов'); }
  };

  const autoUpdateStatuses = async () => {
    try {
      const res = await flightsApi.autoUpdateStatuses();
      if (res.updated > 0) {
        toast.info(`Обновлено статусов: ${res.updated}`);
        loadFlights();
      }
    } catch { console.error('Ошибка автообновления статусов'); }
  };

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'developer') {
      loadUsers();
      loadFlights();
      loadDashboard();
      loadCities();
      autoUpdateStatuses();
      const interval = setInterval(autoUpdateStatuses, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const changeRole = async (userId: number, role: string) => {
    try {
      await adminApi.changeRole(userId, role);
      toast.success(`Роль изменена на ${role}`);
      loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  const handleFlightChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFlightForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const resetFlightForm = () => {
    setFlightForm(EMPTY_FLIGHT_FORM);
    setEditingFlightId(null);
    setStopoverInput('');
    setShowCitySuggestions(false);
  };

  const addStopover = (city: string) => {
    if (!city.trim()) return;
    let stops: Array<{ airport: string; arrival: string; departure: string }> = [];
    try { stops = JSON.parse(flightForm.stopovers); } catch {}
    if (!Array.isArray(stops)) stops = [];
    if (!allCities.includes(city)) { toast.error(`Город "${city}" не найден`); return; }
    if (stops.some(s => s.airport === city)) { toast.warning('Пересадка уже добавлена'); return; }
    stops.push({ airport: city, arrival: '', departure: '' });
    setFlightForm(prev => ({ ...prev, stopovers: JSON.stringify(stops) }));
    setStopoverInput('');
    setShowCitySuggestions(false);
  };

  const removeStopover = (index: number) => {
    let stops: Array<{ airport: string; arrival: string; departure: string }> = [];
    try { stops = JSON.parse(flightForm.stopovers); } catch { return; }
    stops.splice(index, 1);
    setFlightForm(prev => ({ ...prev, stopovers: JSON.stringify(stops) }));
  };

  const handleFlightSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      let stopovers: Array<{ airport: string; arrival: string; departure: string }> = [];
      try { stopovers = JSON.parse(flightForm.stopovers); } catch {}
      if (!Array.isArray(stopovers)) stopovers = [];

      // Конвертируем локальное московское время в UTC для отправки на сервер
      const payload: FlightCreate | FlightUpdate = {
        flight_number: flightForm.flight_number,
        airline: flightForm.airline,
        origin: flightForm.origin,
        destination: flightForm.destination,
        scheduled_departure: toUtcFromMoscow(flightForm.scheduled_departure),
        scheduled_arrival: toUtcFromMoscow(flightForm.scheduled_arrival),
        status: flightForm.status,
        capacity: Number(flightForm.capacity),
        price: Number(flightForm.price),
        stopovers: stopovers.length > 0 ? stopovers : undefined
      };

      if (editingFlightId) {
        await flightsApi.update(editingFlightId, payload as FlightUpdate);
        toast.success('Рейс обновлён');
      } else {
        await flightsApi.create(payload as FlightCreate);
        toast.success('Рейс создан');
      }
      resetFlightForm();
      loadFlights();
      loadCities();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  const editFlight = (flight: Flight) => {
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
      scheduled_departure: toMoscowDateTimeLocal(flight.scheduled_departure),
      scheduled_arrival: toMoscowDateTimeLocal(flight.scheduled_arrival),
      status: flight.status,
      capacity: flight.capacity || 180,
      price: flight.price,
      stopovers: JSON.stringify(flight.stopovers || [])
    });
  };

  const deleteFlight = async (id: number) => {
    const flight = flights.find(f => f.id === id);
    if (flight && (flight.status === 'departed' || flight.status === 'landed')) {
      toast.warning('Нельзя удалить завершённый рейс');
      return;
    }
    if (!window.confirm('Удалить рейс?')) return;
    try {
      await flightsApi.delete(id);
      toast.success('Рейс удалён');
      loadFlights();
      loadCities();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  const importFromExternalApi = async () => {
    if (!apiUrl.trim()) { setApiError('Введите URL API'); return; }
    setApiLoading(true);
    setApiError('');
    setApiSuccess('');
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Массив рейсов ожидается');
      let imported = 0, errors = 0;
      for (const item of data) {
        try {
          const payload: FlightCreate = {
            flight_number: item.flight_number || item.flightNumber || item.code || `EXT${imported}`,
            airline: item.airline || item.carrier || 'Unknown',
            origin: item.origin || item.departure_airport || item.from || 'Unknown',
            destination: item.destination || item.arrival_airport || item.to || 'Unknown',
            scheduled_departure: item.scheduled_departure || item.departure_time || item.departure || new Date().toISOString(),
            scheduled_arrival: item.scheduled_arrival || item.arrival_time || item.arrival || new Date().toISOString(),
            status: 'scheduled',
            capacity: item.capacity || item.total_seats || 150,
            price: item.price || item.fare || 5000,
            stopovers: item.stopovers || []
          };
          await flightsApi.create(payload);
          imported++;
        } catch { errors++; }
      }
      setApiSuccess(`Импортировано: ${imported}, ошибок: ${errors}`);
      loadFlights();
      loadCities();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Ошибка');
    } finally { setApiLoading(false); }
  };

  const importTestFlights = async () => {
    try {
      const res = await flightsApi.importTestFlights();
      toast.success(res.msg);
      loadFlights();
      loadCities();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка импорта');
    }
  };

  const syncFlightStatuses = async () => {
    try {
      const res = await flightsApi.autoUpdateStatuses();
      toast.success(res.msg);
      loadFlights();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  const getStopoversText = (stopovers: Array<{ airport: string }>) =>
    stopovers?.length ? stopovers.map(s => s.airport).join(' → ') : '—';

  const getStatusText = (status: FlightStatus): string =>
    STATUS_OPTIONS.find(o => o.value === status)?.label || status;

  const getStatusClass = (status: FlightStatus): string => {
    switch (status) {
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
    return <div className="admin-page"><p>Доступ запрещён</p></div>;
  }

  return (
    <div className="admin-page animate-fade-in">
      <h2>Админ-панель</h2>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {(['flights', 'users', 'dashboard'] as AdminTab[]).map(tab => (
          <button key={tab} className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-outline'} btn-sm`} onClick={() => setActiveTab(tab)}>
            {{ flights: '✈ Рейсы', users: 'Пользователи', dashboard: 'Дашборд' }[tab]}
          </button>
        ))}
        <button className="btn btn-secondary btn-sm" onClick={syncFlightStatuses}>Обновить статусы</button>
      </div>

      {/* блок импорта */}
      <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <h4 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>Импорт рейсов</h4>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input type="text" placeholder="https://api.example.com/flights" value={apiUrl} onChange={e => setApiUrl(e.target.value)}
            style={{ flex: 2, minWidth: '250px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />
          <button className="btn btn-primary" onClick={importFromExternalApi} disabled={apiLoading}>{apiLoading ? 'Загрузка...' : 'Импорт из API'}</button>
          <button className="btn btn-secondary" onClick={importTestFlights} disabled={apiLoading}>Сгенерировать тестовые</button>
        </div>
        {apiError && <p style={{ color: '#e94560', marginTop: '8px', fontSize: '0.8rem' }}>{apiError}</p>}
        {apiSuccess && <p style={{ color: '#4caf50', marginTop: '8px', fontSize: '0.8rem' }}>{apiSuccess}</p>}
      </div>

      {activeTab === 'flights' && (
        <div>
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
                <input name="capacity" type="number" placeholder="Вместимость" value={flightForm.capacity} onChange={handleFlightChange} />
                <input name="price" type="number" placeholder="Цена (₽)" value={flightForm.price} onChange={handleFlightChange} />
                {editingFlightId && flights.find(f => f.id === editingFlightId)?.status === 'departed' ? (
                  <input type="text" value="Вылетел" disabled style={{ padding: '10px', background: '#f0f0f0', borderRadius: '8px' }} />
                ) : editingFlightId && flights.find(f => f.id === editingFlightId)?.status === 'landed' ? (
                  <input type="text" value="Прибыл" disabled style={{ padding: '10px', background: '#f0f0f0', borderRadius: '8px' }} />
                ) : (
                  <select name="status" value={flightForm.status} onChange={handleFlightChange}>
                    {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                )}
              </div>

              {/* блок пересадок */}
              <div style={{ marginTop: '16px' }}>
                <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>Пересадки</label>
                {(() => {
                  try {
                    const stops = JSON.parse(flightForm.stopovers);
                    if (Array.isArray(stops) && stops.length > 0) {
                      return (
                        <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {stops.map((stop: { airport: string }, idx: number) => (
                            <span key={idx} style={{ background: '#6c5ce7', color: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              ✈ {stop.airport}
                              <span onClick={() => removeStopover(idx)} style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2rem', lineHeight: 1 }}>×</span>
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
                    <input placeholder="Введите город пересадки..." value={stopoverInput} onChange={e => { setStopoverInput(e.target.value); setShowCitySuggestions(true); }} onFocus={() => setShowCitySuggestions(true)} style={{ flex: 1 }} />
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => addStopover(stopoverInput)}>+ Добавить</button>
                  </div>
                  {showCitySuggestions && stopoverInput.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 20, maxHeight: '200px', overflowY: 'auto', marginTop: '4px' }}>
                      {allCities.filter(city => city.toLowerCase().includes(stopoverInput.toLowerCase())).slice(0, 10).map(city => (
                        <div key={city} onClick={() => addStopover(city)} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>✈ {city}</div>
                      ))}
                    </div>
                  )}
                </div>
                <small style={{ color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>Введите город и нажмите «Добавить»</small>
              </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary">{editingFlightId ? 'Сохранить изменения' : 'Создать рейс'}</button>
                {editingFlightId && <button type="button" className="btn btn-outline" onClick={resetFlightForm}>Отмена</button>}
              </div>
            </form>
          </div>

          <div className="table-responsive">
            <table className="admin-table">
              <thead><tr><th>Рейс</th><th>Авиакомпания</th><th>Маршрут</th><th>Пересадки</th><th>Вылет</th><th>Статус</th><th>Места</th><th>Цена</th><th>Действия</th></tr></thead>
              <tbody>
                {flights.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: '20px' }}>Нет рейсов</td></tr>}
                {flights.map(f => (
                  <tr key={f.id}>
                    <td><strong>{f.flight_number}</strong></td>
                    <td>{f.airline}</td>
                    <td>{f.origin} → {f.destination}</td>
                    <td>{getStopoversText(f.stopovers)}</td>
                    <td>{toMoscowTime(f.scheduled_departure)}</td>
                    <td><span className={`status-badge ${getStatusClass(f.status)}`}>{getStatusText(f.status)}</span></td>
                    <td>{f.free_seats} / {f.capacity || 30}</td>
                    <td>{f.price?.toLocaleString()} ₽</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {f.status !== 'departed' && f.status !== 'landed' ? (
                          <>
                            <button className="btn btn-outline btn-sm" onClick={() => editFlight(f)} title="Редактировать">✎</button>
                            <button className="btn btn-outline btn-sm" onClick={() => deleteFlight(f.id)} style={{ color: '#e94560' }} title="Удалить">✕</button>
                          </>
                        ) : <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Завершён</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="table-responsive">
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
                      <select onChange={e => e.target.value && changeRole(u.id, e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px' }} defaultValue="">
                        <option value="" disabled>Выбрать...</option>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                        <option value="developer">Developer</option>
                      </select>
                    ) : <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Только разработчик</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'dashboard' && dashboard && (
        <div>
          <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
            <h3>Общая статистика</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginTop: '16px' }}>
              <div className="card" style={{ padding: '16px', textAlign: 'center' }}><div style={{ fontSize: '2rem', fontWeight: 700 }}>{dashboard.total_flights}</div><div>Всего рейсов</div></div>
              <div className="card" style={{ padding: '16px', textAlign: 'center' }}><div style={{ fontSize: '2rem', fontWeight: 700, color: '#e94560' }}>{dashboard.delayed_flights}</div><div>Задержано</div></div>
              <div className="card" style={{ padding: '16px', textAlign: 'center' }}><div style={{ fontSize: '2rem', fontWeight: 700, color: '#4caf50' }}>{dashboard.punctuality}%</div><div>Пунктуальность</div></div>
              <div className="card" style={{ padding: '16px', textAlign: 'center' }}><div style={{ fontSize: '2rem', fontWeight: 700 }}>{dashboard.avg_delay_minutes} мин</div><div>Средняя задержка</div></div>
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