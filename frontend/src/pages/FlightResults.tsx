import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { flightsApi } from '../api/services';
import type { Flight, FlightStatus } from '../api/types';
import SeatMap from '../pages/SeatMap';
import PriceCalendar from '../pages/PriceCalendar';
import { formatMoscowDate, formatMoscowTime } from '../utils/date';

interface TimeOption {
  value: string;
  label: string;
}

const TIME_OPTIONS: TimeOption[] = [
  { value: 'any', label: 'Любое' },
  { value: 'morning', label: 'Утро (6:00-12:00)' },
  { value: 'day', label: 'День (12:00-18:00)' },
  { value: 'evening', label: 'Вечер (18:00-0:00)' },
  { value: 'night', label: 'Ночь (0:00-6:00)' },
];

type SortBy = 'price' | 'time' | 'duration';

export default function FlightResults() {
  const [searchParams] = useSearchParams();
  const [allFlights, setAllFlights] = useState<Flight[]>([]);
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('price');
  const [loading, setLoading] = useState(true);
  
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [timeFilter, setTimeFilter] = useState('any');
  const [maxStops, setMaxStops] = useState('any');
  const [selectedAirlines, setSelectedAirlines] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadFlights();
  }, [searchParams]);

  const loadFlights = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      const origin = searchParams.get('origin');
      const destination = searchParams.get('destination');
      const date = searchParams.get('date');
      
      if (origin) params.origin = origin;
      if (destination) params.destination = destination;
      if (date) params.date = date;
      
      const data = await flightsApi.search(params);
      setAllFlights(data);
    } catch (error) {
      console.error('Ошибка загрузки рейсов:', error);
      setAllFlights([]);
    } finally {
      setLoading(false);
    }
  };

  const airlines = useMemo(() => {
    return [...new Set(allFlights.map(f => f.airline))];
  }, [allFlights]);

  const flights = useMemo(() => {
    let filtered = [...allFlights];

    if (priceMin) filtered = filtered.filter(f => f.price >= Number(priceMin));
    if (priceMax) filtered = filtered.filter(f => f.price <= Number(priceMax));

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

    if (maxStops !== 'any') {
      filtered = filtered.filter(f => {
        const stopsCount = f.stopovers?.length || 0;
        if (maxStops === '0') return stopsCount === 0;
        if (maxStops === '1') return stopsCount === 1;
        if (maxStops === '2') return stopsCount >= 2;
        return true;
      });
    }

    if (selectedAirlines.length > 0) {
      filtered = filtered.filter(f => selectedAirlines.includes(f.airline));
    }

    switch (sortBy) {
      case 'price':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'time':
        filtered.sort((a, b) => 
          new Date(a.scheduled_departure).getTime() - new Date(b.scheduled_departure).getTime()
        );
        break;
      case 'duration':
        filtered.sort((a, b) => {
          const durA = new Date(a.scheduled_arrival).getTime() - new Date(a.scheduled_departure).getTime();
          const durB = new Date(b.scheduled_arrival).getTime() - new Date(b.scheduled_departure).getTime();
          return durA - durB;
        });
        break;
    }

    return filtered;
  }, [allFlights, priceMin, priceMax, timeFilter, maxStops, selectedAirlines, sortBy]);

  const resetFilters = () => {
    setPriceMin('');
    setPriceMax('');
    setTimeFilter('any');
    setMaxStops('any');
    setSelectedAirlines([]);
    setSortBy('price');
  };

  const toggleAirline = (airline: string) => {
    setSelectedAirlines(prev => 
      prev.includes(airline) ? prev.filter(a => a !== airline) : [...prev, airline]
    );
  };

  const getDuration = (dep: string, arr: string): string => {
    const depTime = new Date(dep).getTime();
    const arrTime = new Date(arr).getTime();
    let diffMs = arrTime - depTime;
    if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours} ч ${minutes} мин`;
  };

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

  const getStatusText = (status: FlightStatus): string => {
    switch (status) {
      case 'scheduled': return 'По расписанию';
      case 'boarding': return 'Посадка';
      case 'delayed': return 'Задержан';
      case 'departed': return 'Вылетел';
      case 'landed': return 'Прибыл';
      case 'cancelled': return 'Отменён';
      default: return status;
    }
  };

  return (
    <div className="results-page animate-slide-up">
      <div className="results-header">
        <h2>Результаты поиска ({flights.length})</h2>
        <div className="sort-buttons">
          <button className={`sort-btn ${sortBy === 'price' ? 'active' : ''}`} onClick={() => setSortBy('price')}>Самые дешёвые</button>
          <button className={`sort-btn ${sortBy === 'time' ? 'active' : ''}`} onClick={() => setSortBy('time')}>По времени</button>
          <button className={`sort-btn ${sortBy === 'duration' ? 'active' : ''}`} onClick={() => setSortBy('duration')}>По длительности</button>
        </div>
      </div>

      <button className="btn btn-outline" style={{ marginBottom: '12px' }} onClick={() => setShowFilters(!showFilters)}>
        {showFilters ? 'Скрыть фильтры ▲' : 'Фильтры ▼'}
      </button>

      {showFilters && (
        <div className="card filters-panel">
          <div className="filters-grid">
            <div className="filter-group">
              <label>Цена (₽)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" placeholder="От" value={priceMin} onChange={e => setPriceMin(e.target.value)} style={{ width: '100%' }} />
                <input type="number" placeholder="До" value={priceMax} onChange={e => setPriceMax(e.target.value)} style={{ width: '100%' }} />
              </div>
            </div>
            <div className="filter-group">
              <label>Время вылета</label>
              <select value={timeFilter} onChange={e => setTimeFilter(e.target.value)}>
                {TIME_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
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

          <button className="btn btn-outline" onClick={resetFilters} style={{ marginTop: '12px' }}>
            Сбросить все фильтры
          </button>
        </div>
      )}

      {searchParams.get('origin') && searchParams.get('destination') && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <PriceCalendar origin={searchParams.get('origin')!} destination={searchParams.get('destination')!} />
        </div>
      )}

      {loading ? (
        <div className="flights-list">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton-card card">
              <div className="skeleton-line" style={{ width: '30%' }} />
              <div className="skeleton-line" style={{ width: '60%' }} />
              <div className="skeleton-line" style={{ width: '40%' }} />
              <div className="skeleton-line" style={{ width: '50%' }} />
            </div>
          ))}
        </div>
      ) : flights.length === 0 ? (
        <div className="empty-state card">
          <h3>Рейсы не найдены</h3>
          <p>Попробуйте изменить параметры поиска</p>
        </div>
      ) : (
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
                    <div className="time">{formatMoscowTime(f.scheduled_departure)}</div>
                    <div className="city">{f.origin}</div>
                    <div className="date">{formatMoscowDate(f.scheduled_departure)}</div>
                  </div>
                  <div className="duration-line">
                    <div className="duration">{getDuration(f.scheduled_departure, f.scheduled_arrival)}</div>
                    <div className="line" />
                    {f.stopovers && f.stopovers.length > 0 && (
                      <div className="stops">{f.stopovers.length} {f.stopovers.length === 1 ? 'пересадка' : 'пересадки'}</div>
                    )}
                  </div>
                  <div className="arrival">
                    <div className="time">{formatMoscowTime(f.scheduled_arrival)}</div>
                    <div className="city">{f.destination}</div>
                    <div className="date">{formatMoscowDate(f.scheduled_arrival)}</div>
                  </div>
                </div>
                <div className="flight-status">
                  <span className={`status-badge ${getStatusClass(f.status)}`}>
                    {getStatusText(f.status)}
                  </span>
                  <div className="seats">{f.free_seats} мест</div>
                </div>
              </div>
              <div className="flight-price">
                <div className="price-amount">{f.price.toLocaleString()} ₽</div>
                <div className="price-hint">за одного пассажира</div>
                <Link to={`/flight/${f.id}`} className="btn btn-outline btn-sm" style={{ marginRight: '8px' }}>Подробнее</Link>
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedFlight(f)}>Выбрать</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedFlight && <SeatMap flight={selectedFlight} onClose={() => setSelectedFlight(null)} />}
    </div>
  );
}