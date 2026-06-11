// src/components/FavoriteRoutes.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { pricesApi } from '../api/services';
import type { CalendarPriceDay } from '../api/types';

const POPULAR_CITIES = [
  'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань',
  'Сочи', 'Владивосток', 'Калининград', 'Мурманск', 'Хабаровск',
  'Якутск', 'Махачкала', 'Симферополь', 'Челябинск', 'Тюмень',
  'Анталья', 'Стамбул', 'Дубай', 'Гоа', 'Минск',
  'Краснодар', 'Воронеж', 'Пермь', 'Уфа', 'Омск'
];

interface FavoriteRoute {
  id: number;
  origin: string;
  destination: string;
  createdAt: string;
  lastPrice: number;
}

export default function FavoriteRoutes() {
  const [favorites, setFavorites] = useState<FavoriteRoute[]>(() => {
    try {
      const saved = localStorage.getItem('favoriteRoutes');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  const [showAdd, setShowAdd] = useState(false);
  const [newRoute, setNewRoute] = useState({ origin: '', destination: '' });
  const [suggestions, setSuggestions] = useState<{ origin: string[]; destination: string[] }>({
    origin: [],
    destination: []
  });
  
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem('favoriteRoutes', JSON.stringify(favorites));
  }, [favorites]);

  const isValidCity = (city: string) => 
    POPULAR_CITIES.some(c => c.toLowerCase() === city.toLowerCase());

  const getSuggestions = (value: string): string[] => {
    if (value.length < 1) return [];
    return POPULAR_CITIES.filter(city =>
      city.toLowerCase().includes(value.toLowerCase())
    ).slice(0, 5);
  };

  const fetchMinPrice = async (origin: string, destination: string): Promise<number | null> => {
    try {
      const now = new Date();
      const data = await pricesApi.getCalendar({
        origin,
        destination,
        year: now.getFullYear(),
        month: now.getMonth() + 1
      });
      
      const prices = data.prices || {};
      const priceValues = Object.values(prices).map((p: CalendarPriceDay) => p.min_price);
      
      if (priceValues.length === 0) return null;
      return Math.min(...priceValues);
    } catch {
      return null;
    }
  };

  const addFavorite = async () => {
    const origin = newRoute.origin.trim();
    const destination = newRoute.destination.trim();

    if (!origin || !destination) {
      toast.error('Заполните оба поля');
      return;
    }
    
    if (origin.toLowerCase() === destination.toLowerCase()) {
      toast.error('Город отправления и назначения не могут совпадать');
      return;
    }
    
    if (!isValidCity(origin)) {
      toast.error(`Город "${origin}" не найден. Выберите из популярных направлений.`);
      return;
    }
    
    if (!isValidCity(destination)) {
      toast.error(`Город "${destination}" не найден. Выберите из популярных направлений.`);
      return;
    }

    const isDuplicate = favorites.some(
      f => f.origin.toLowerCase() === origin.toLowerCase() &&
        f.destination.toLowerCase() === destination.toLowerCase()
    );
    
    if (isDuplicate) {
      toast.warning('Этот маршрут уже в избранном');
      return;
    }

    const minPrice = await fetchMinPrice(origin, destination);
    
    const route: FavoriteRoute = {
      id: Date.now(),
      origin,
      destination,
      createdAt: new Date().toISOString(),
      lastPrice: minPrice || 0
    };

    setFavorites([...favorites, route]);
    setNewRoute({ origin: '', destination: '' });
    setShowAdd(false);
    toast.success(`Маршрут ${origin} → ${destination} добавлен в избранное`);
  };

  const removeFavorite = (id: number) => {
    setFavorites(favorites.filter(f => f.id !== id));
    toast.info('Маршрут удалён из избранного');
  };

  const searchRoute = (origin: string, destination: string) => {
    navigate(`/results?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`);
  };

  const checkPriceChange = async (route: FavoriteRoute) => {
    const currentMinPrice = await fetchMinPrice(route.origin, route.destination);
    
    if (currentMinPrice === null) {
      toast.info('Не удалось получить актуальную цену');
      return;
    }

    const oldPrice = route.lastPrice;
    
    if (oldPrice === 0) {
      setFavorites(prev => prev.map(f =>
        f.id === route.id ? { ...f, lastPrice: currentMinPrice } : f
      ));
      toast.info(`Текущая минимальная цена: ${currentMinPrice.toLocaleString()} ₽`);
      return;
    }

    const diff = currentMinPrice - oldPrice;
    
    if (diff < -500) {
      toast.success(
        `Цена снизилась на ${Math.abs(diff).toLocaleString()} ₽! ` +
        `Было ${oldPrice.toLocaleString()} → стало ${currentMinPrice.toLocaleString()}`
      );
    } else if (diff > 500) {
      toast.warning(
        `Цена выросла на ${diff.toLocaleString()} ₽. ` +
        `Было ${oldPrice.toLocaleString()} → стало ${currentMinPrice.toLocaleString()}`
      );
    } else {
      toast.info(
        `Цена практически не изменилась (${oldPrice.toLocaleString()} → ${currentMinPrice.toLocaleString()})`
      );
    }

    setFavorites(prev => prev.map(f =>
      f.id === route.id ? { ...f, lastPrice: currentMinPrice } : f
    ));
  };

  return (
    <div className="card animate-fade-in" style={{ padding: '20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3>⭐ Избранные маршруты</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Отмена' : '+ Добавить'}
        </button>
      </div>

      {showAdd && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                placeholder="Откуда (например: Москва)"
                value={newRoute.origin}
                onChange={e => {
                  setNewRoute({ ...newRoute, origin: e.target.value });
                  setSuggestions({ ...suggestions, origin: getSuggestions(e.target.value) });
                }}
                style={{ width: '100%' }}
              />
              {suggestions.origin.length > 0 && (
                <div className="suggestions-dropdown">
                  {suggestions.origin.map(city => (
                    <div
                      key={city}
                      className="suggestion-item"
                      onClick={() => {
                        setNewRoute({ ...newRoute, origin: city });
                        setSuggestions({ ...suggestions, origin: [] });
                      }}
                    >
                      {city}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                placeholder="Куда (например: Сочи)"
                value={newRoute.destination}
                onChange={e => {
                  setNewRoute({ ...newRoute, destination: e.target.value });
                  setSuggestions({ ...suggestions, destination: getSuggestions(e.target.value) });
                }}
                style={{ width: '100%' }}
              />
              {suggestions.destination.length > 0 && (
                <div className="suggestions-dropdown">
                  {suggestions.destination.map(city => (
                    <div
                      key={city}
                      className="suggestion-item"
                      onClick={() => {
                        setNewRoute({ ...newRoute, destination: city });
                        setSuggestions({ ...suggestions, destination: [] });
                      }}
                    >
                      {city}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="btn btn-secondary btn-sm" onClick={addFavorite}>
              Сохранить
            </button>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
            Популярные города: {POPULAR_CITIES.slice(0, 10).join(', ')}...
          </p>
        </div>
      )}

      {favorites.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>
          Нет избранных маршрутов. Добавьте направление, чтобы отслеживать цены.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {favorites.map(route => (
            <div key={route.id} className="favorite-item">
              <div>
                <div style={{ fontWeight: '600' }}>{route.origin} → {route.destination}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {route.lastPrice > 0
                    ? `Мин. цена: ${route.lastPrice.toLocaleString()} ₽`
                    : 'Цена не определена'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => searchRoute(route.origin, route.destination)}
                >
                  Найти
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => checkPriceChange(route)}
                  title="Проверить изменение цены"
                >
                  🔍
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => removeFavorite(route.id)}
                  style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}