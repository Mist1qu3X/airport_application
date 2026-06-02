import { useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function SeatMap({ flight, onClose }) {
  const { user } = useAuth();
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [useBonuses, setUseBonuses] = useState(false);
  const [loading, setLoading] = useState(false);
  const rows = 10, cols = 6;
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  
  const maxBonuses = Math.floor(flight.price * 0.5);
  const bonusesAvailable = user?.bonuses || 0;
  const finalPrice = useBonuses ? flight.price - Math.min(maxBonuses, bonusesAvailable) : flight.price;

  const handlePurchase = async () => {
    if (!selectedSeat) return;
    setLoading(true);
    try {
      const res = await api.post('/api/tickets/purchase', {
        flight_id: flight.id,
        seat_number: selectedSeat,
        use_bonuses: useBonuses ? Math.min(maxBonuses, bonusesAvailable) : 0
      });
      alert(`Билет куплен! Начислено бонусов: ${res.data.bonuses_earned}`);
      onClose();
    } catch (err) {
      alert(err.response?.data?.detail || 'Ошибка при покупке');
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal seat-modal" onClick={e => e.stopPropagation()}>
        {/* Заголовок */}
        <div className="modal-header">
          <h3>{flight.flight_number} — Выбор места</h3>
          <p>{flight.origin} → {flight.destination}</p>
          <p style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--primary)', marginTop: '6px' }}>
            {finalPrice.toLocaleString()} ₽
          </p>
        </div>

        {/* Легенда */}
        <div className="seat-legend">
          <span><div className="leg free"></div> Свободно</span>
          <span><div className="leg selected"></div> Выбрано</span>
          <span><div className="leg occupied"></div> Занято</span>
        </div>

        {/* Схема салона */}
        <div className="cabin">
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} className="seat-row">
              <div className="seat-group">
                {letters.slice(0, 3).map((l, c) => {
                  const num = r * cols + c + 1;
                  return (
                    <div key={l} 
                      className={`seat ${selectedSeat === num ? 'selected' : ''}`}
                      onClick={() => setSelectedSeat(num)}
                    >
                      {l}
                    </div>
                  );
                })}
              </div>
              <div className="aisle"></div>
              <div className="seat-group">
                {letters.slice(3, 6).map((l, c) => {
                  const num = r * cols + c + 4;
                  return (
                    <div key={l} 
                      className={`seat ${selectedSeat === num ? 'selected' : ''}`}
                      onClick={() => setSelectedSeat(num)}
                    >
                      {l}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Бонусы */}
        {bonusesAvailable > 0 && (
          <div style={{ 
            marginBottom: '12px', 
            padding: '10px 14px', 
            background: '#f8f9fa', 
            borderRadius: '8px',
            fontSize: '0.9rem'
          }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              cursor: 'pointer',
              color: 'var(--text-primary)'
            }}>
              <input
                type="checkbox"
                checked={useBonuses}
                onChange={e => setUseBonuses(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <span>Использовать бонусы</span>
              <span style={{ color: 'var(--secondary)', fontWeight: '600', marginLeft: 'auto' }}>
                –{Math.min(maxBonuses, bonusesAvailable)} ₽
              </span>
            </label>
            <div style={{ marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-light)' }}>
              Доступно: {bonusesAvailable} бонусов · Можно списать до 50% стоимости
            </div>
          </div>
        )}

        {/* Кнопки */}
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onClose}>Отмена</button>
          <button 
            className="btn btn-secondary" 
            onClick={handlePurchase} 
            disabled={!selectedSeat || loading}
          >
            {loading ? 'Покупка...' : selectedSeat ? `Купить за ${finalPrice.toLocaleString()} ₽` : 'Выберите место'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}