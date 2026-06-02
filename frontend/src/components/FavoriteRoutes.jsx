import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

export default function FavoriteRoutes() {
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('favoriteRoutes');
    return saved ? JSON.parse(saved) : [];
  });
  const [showAdd, setShowAdd] = useState(false);
  const [newRoute, setNewRoute] = useState({ origin: '', destination: '' });
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem('favoriteRoutes', JSON.stringify(favorites));
  }, [favorites]);

  const addFavorite = () => {
    if (!newRoute.origin || !newRoute.destination) {
      toast.error('Заполните оба поля');
      return;
    }
    const route = {
      id: Date.now(),
      origin: newRoute.origin,
      destination: newRoute.destination,
      createdAt: new Date().toISOString(),
      lastPrice: Math.floor(Math.random() * 5000) + 3000 // заглушка
    };
    setFavorites([...favorites, route]);
    setNewRoute({ origin: '', destination: '' });
    setShowAdd(false);
    toast.success('Маршрут добавлен в избранное');
  };

  const removeFavorite = (id) => {
    setFavorites(favorites.filter(f => f.id !== id));
    toast.info('Маршрут удалён из избранного');
  };

  const searchRoute = (origin, destination) => {
    navigate(`/results?origin=${origin}&destination=${destination}`);
  };

  const checkPriceChange = (route) => {
    const newPrice = Math.floor(Math.random() * 5000) + 3000;
    const diff = newPrice - route.lastPrice;
    if (diff < -500) {
      toast.success(`Цена на ${route.origin} → ${route.destination} снизилась на ${Math.abs(diff)} ₽!`);
    } else if (diff > 500) {
      toast.warning(`Цена на ${route.origin} → ${route.destination} выросла на ${diff} ₽`);
    }
    // Обновляем цену
    setFavorites(favorites.map(f => 
      f.id === route.id ? { ...f, lastPrice: newPrice } : f
    ));
  };

  return (
    <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3>⭐ Избранные маршруты</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Отмена' : '+ Добавить'}
        </button>
      </div>

      {showAdd && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            placeholder="Откуда"
            value={newRoute.origin}
            onChange={e => setNewRoute({ ...newRoute, origin: e.target.value })}
            style={{ flex: 1 }}
          />
          <input
            placeholder="Куда"
            value={newRoute.destination}
            onChange={e => setNewRoute({ ...newRoute, destination: e.target.value })}
            style={{ flex: 1 }}
          />
          <button className="btn btn-secondary btn-sm" onClick={addFavorite}>
            Сохранить
          </button>
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
                  Последняя цена: {route.lastPrice.toLocaleString()} ₽
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