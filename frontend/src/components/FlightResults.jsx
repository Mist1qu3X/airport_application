import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api';
import SeatMap from './SeatMap';

const TIME_OPTIONS = [
  { value: 'any', label: 'Любое' },
  { value: 'morning', label: 'Утро (6:00-12:00)' },
  { value: 'day', label: 'День (12:00-18:00)' },
  { value: 'evening', label: 'Вечер (18:00-0:00)' },
  { value: 'night', label: 'Ночь (0:00-6:00)' },
];

export default function FlightResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [flights, setFlights] = useState([]);
  const [allFlights, setAllFlights] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [sortBy, setSortBy] = useState('price');
  
  // Фильтры
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [timeFilter, setTimeFilter] = useState('any');
  const [maxStops, setMaxStops] = useState('any');
  const [airlines, setAirlines] = useState([]);
  const [selectedAirlines, setSelectedAirlines] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    api.get('/api/flights', { params: Object.fromEntries(searchParams) })
      .then(res => {
        setAllFlights(res.data);
        // Собираем уникальные авиакомпании
        const uniqueAirlines = [...new Set(res.data.map(f => f.airline))];
        setAirlines(uniqueAirlines);
      })
      .catch(console.error);
  }, [searchParams]);

  // Применяем все фильтры
  useEffect(() => {
    let filtered = [...allFlights];

    // Фильтр по цене
    if (priceMin) filtered = filtered.filter(f => f.price >= Number(priceMin));
    if (priceMax) filtered = filtered.filter(f => f.price <= Number(priceMax));

    // Фильтр по времени
    if (timeFilter !== 'any') {
      filtered = filtered.filter(f => {
        const hour = new Date(f.scheduled_departure).getHours();
        switch (timeFilter) {
          case 'morning': return hour >= 6 && hour < 12;
          case 'day': return hour >= 12 && hour < 18;
          case 'evening': return hour >= 18 && hour < 24;
          case 'night': return hour >= 0 && hour < 6;
          default: return true;
        }
      });
    }

    // Фильтр по пересадкам
    if (maxStops !== 'any') {
      filtered = filtered.filter(f => {
        if (maxStops === '0') return !f.stopovers || f.stopovers.length === 0;
        if (maxStops === '1') return f.stopovers && f.stopovers.length === 1;
        if (maxStops === '2') return f.stopovers && f.stopovers.length >= 2;
        return true;
      });
    }

    // Фильтр по авиакомпаниям
    if (selectedAirlines.length > 0) {
      filtered = filtered.filter(f => selectedAirlines.includes(f.airline));
    }

    // Сортировка
    if (sortBy === 'price') filtered.sort((a, b) => a.price - b.price);
    if (sortBy === 'time') filtered.sort((a, b) => new Date(a.scheduled_departure) - new Date(b.scheduled_departure));
    if (sortBy === 'duration') {
      filtered.sort((a, b) => {
        const durA = new Date(a.scheduled_arrival) - new Date(a.scheduled_departure);
        const durB = new Date(b.scheduled_arrival) - new Date(b.scheduled_departure);
        return durA - durB;
      });
    }

    setFlights(filtered);
  }, [allFlights, priceMin, priceMax, timeFilter, maxStops, selectedAirlines, sortBy]);

  const resetFilters = () => {
    setPriceMin('');
    setPriceMax('');
    setTimeFilter('any');
    setMaxStops('any');
    setSelectedAirlines([]);
    setSortBy('price');
  };

  const toggleAirline = (airline) => {
    setSelectedAirlines(prev => 
      prev.includes(airline) ? prev.filter(a => a !== airline) : [...prev, airline]
    );
  };

  const formatTime = (iso) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const formatDate = (iso) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' });
  const duration = (dep, arr) => {
    const depTime = new Date(dep);
    const arrTime = new Date(arr);
    let diffMs = arrTime - depTime;
    
    // Если разница отрицательная (пересекает полночь), добавляем 24 часа
    if (diffMs < 0) {
      diffMs += 24 * 60 * 60 * 1000;
    }
    
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours} ч ${minutes} мин`;
  };

  return (
    <div className="results-page animate-slide-up">
      <div className="results-header">
        <h2>Результаты поиска ({flights.length})</h2>
        <div className="sort-buttons">
          <button className={`sort-btn ${sortBy === 'price' ? 'active' : ''}`} onClick={() => setSortBy('price')}>
            Самые дешёвые
          </button>
          <button className={`sort-btn ${sortBy === 'time' ? 'active' : ''}`} onClick={() => setSortBy('time')}>
            По времени
          </button>
          <button className={`sort-btn ${sortBy === 'duration' ? 'active' : ''}`} onClick={() => setSortBy('duration')}>
            По длительности
          </button>
        </div>
      </div>

      {/* Кнопка показать/скрыть фильтры */}
      <button 
        className="btn btn-outline" 
        style={{ marginBottom: '12px' }}
        onClick={() => setShowFilters(!showFilters)}
      >
        {showFilters ? 'Скрыть фильтры ▲' : 'Фильтры ▼'}
      </button>

      {/* Панель фильтров */}
      {showFilters && (
        <div className="card filters-panel">
          <div className="filters-grid">
            {/* Цена */}
            <div className="filter-group">
              <label>Цена (₽)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="number" 
                  placeholder="От" 
                  value={priceMin} 
                  onChange={e => setPriceMin(e.target.value)}
                  style={{ width: '100%' }}
                />
                <input 
                  type="number" 
                  placeholder="До" 
                  value={priceMax} 
                  onChange={e => setPriceMax(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Время вылета */}
            <div className="filter-group">
              <label>Время вылета</label>
              <select value={timeFilter} onChange={e => setTimeFilter(e.target.value)}>
                {TIME_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Пересадки */}
            <div className="filter-group">
              <label>Пересадки</label>
              <select value={maxStops} onChange={e => setMaxStops(e.target.value)}>
                <option value="any">Любое количество</option>
                <option value="0">Без пересадок</option>
                <option value="1">1 пересадка</option>
                <option value="2">2 и более</option>
              </select>
            </div>
          </div>

          {/* Авиакомпании */}
          {airlines.length > 0 && (
            <div className="filter-group" style={{ marginTop: '12px' }}>
              <label>Авиакомпании</label>
              <div className="airlines-checkboxes">
                {airlines.map(airline => (
                  <label key={airline} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedAirlines.includes(airline)}
                      onChange={() => toggleAirline(airline)}
                    />
                    {airline}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Кнопка сброса */}
          <button className="btn btn-outline" onClick={resetFilters} style={{ marginTop: '12px' }}>
            Сбросить все фильтры
          </button>
        </div>
      )}

      {/* Список рейсов */}
      {flights.length === 0 && (
        <div className="empty-state card">
          <div className="empty-icon">🔍</div>
          <h3>Рейсы не найдены</h3>
          <p>Попробуйте изменить параметры поиска</p>
        </div>
      )}

      <div className="flights-list">
        {flights.map(f => (
          <div key={f.id} className="flight-card card animate-slide-up">
            <div className="flight-main">
              <div className="flight-airline">
                <span className="airline-logo">{f.airline[0]}</span>
                <div>
                  <div className="airline-name">{f.airline}</div>
                  <div className="flight-number">{f.flight_number}</div>
                </div>
              </div>
              <div className="flight-times">
                <div className="departure">
                  <div className="time">{formatTime(f.scheduled_departure)}</div>
                  <div className="city">{f.origin}</div>
                  <div className="date">{formatDate(f.scheduled_departure)}</div>
                </div>
                <div className="duration-line">
                  <div className="duration">{duration(f.scheduled_departure, f.scheduled_arrival)}</div>
                  <div className="line"></div>
                  {f.stopovers && f.stopovers.length > 0 && (
                    <div className="stops">{f.stopovers.length} пересадка</div>
                  )}
                </div>
                <div className="arrival">
                  <div className="time">{formatTime(f.scheduled_arrival)}</div>
                  <div className="city">{f.destination}</div>
                  <div className="date">{formatDate(f.scheduled_arrival)}</div>
                </div>
              </div>
              <div className="flight-status">
                <span className={`status-badge status-${f.status === 'scheduled' ? 'ok' : f.status === 'boarding' ? 'warn' : 'bad'}`}>
                  {f.status === 'scheduled' ? 'По расписанию' : f.status === 'boarding' ? 'Посадка' : f.status}
                </span>
                <div className="seats">{f.free_seats} мест</div>
              </div>
            </div>
            <div className="flight-price">
              <div className="price-amount">{f.price.toLocaleString()} ₽</div>
              <div className="price-hint">за одного пассажира</div>
              <Link to={`/flight/${f.id}`} className="btn btn-outline btn-sm" style={{ marginRight: '8px' }}>
                Подробнее
              </Link>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedFlight(f)}>
                Выбрать
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedFlight && <SeatMap flight={selectedFlight} onClose={() => setSelectedFlight(null)} />}
    </div>
  );
}