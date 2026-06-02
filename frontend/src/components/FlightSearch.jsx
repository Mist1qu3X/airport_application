import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlane } from '@fortawesome/free-solid-svg-icons';
import FavoriteRoutes from './FavoriteRoutes';

const popularDirections = [
  { from: 'Москва', to: 'Сочи', price: 4200 },
  { from: 'Москва', to: 'Стамбул', price: 8900 },
  { from: 'Санкт-Петербург', to: 'Москва', price: 3500 },
  { from: 'Москва', to: 'Дубай', price: 12500 },
  { from: 'Новосибирск', to: 'Владивосток', price: 7800 },
];

export default function FlightSearch() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

  const handleSearch = () => {
    setIsSearching(true);
    const params = new URLSearchParams();
    if (origin) params.set('origin', origin);
    if (destination) params.set('destination', destination);
    if (date) params.set('date', date);
    if (passengers > 1) params.set('passengers', passengers);
    
    setTimeout(() => {
      navigate(`/results?${params.toString()}`);
      setIsSearching(false);
    }, 600);
  };

  const swap = () => {
    const tmp = origin;
    setOrigin(destination);
    setDestination(tmp);
  };

  return (
    <div className="search-page animate-fade-in">
      <div className="search-hero">
        <h1 className="search-title">
          <span className={`plane-icon ${isSearching ? 'flying' : ''}`}>
            <FontAwesomeIcon icon={faPlane} />
          </span>
          Поиск дешёвых авиабилетов
        </h1>
        <p className="search-subtitle">Сравните цены на авиабилеты и найдите лучшие предложения</p>
      </div>

      <FavoriteRoutes />

      <div className="search-box card">
        <div className="search-inputs">
          <div className="search-field">
            <label>Откуда</label>
            <input placeholder="Город или аэропорт" value={origin} onChange={e => setOrigin(e.target.value)} />
          </div>
          <button className="swap-btn" onClick={swap} title="Поменять местами">⇄</button>
          <div className="search-field">
            <label>Куда</label>
            <input placeholder="Город или аэропорт" value={destination} onChange={e => setDestination(e.target.value)} />
          </div>
          <div className="search-field">
            <label>Дата вылета</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="search-field">
            <label>Пассажиры</label>
            <select value={passengers} onChange={e => setPassengers(e.target.value)}>
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} пассажир</option>)}
            </select>
          </div>
        </div>
        <button className="btn btn-secondary search-btn" onClick={handleSearch} disabled={isSearching}>
          {isSearching ? 'Ищем...' : 'Найти билеты'}
        </button>
      </div>

      <div className="popular-section">
        <h2 className="section-title">Популярные направления</h2>
        <div className="popular-grid">
          {popularDirections.map((d, i) => (
            <div key={i} className="popular-card card" onClick={() => {
              setOrigin(d.from);
              setDestination(d.to);
            }}>
              <div className="popular-route">{d.from} → {d.to}</div>
              <div className="popular-price">от {d.price} ₽</div>
              <div className="popular-hint">Найти билеты →</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}