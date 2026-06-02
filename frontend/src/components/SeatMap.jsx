import { useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';

const BUSINESS_ROWS = [1, 2, 3, 4]; // ряды бизнес-класса
const ECONOMY_ROWS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
const EXTRA_LEGROOM_SEATS = ['5A', '5B', '5C', '5D', '5E', '5F', '12A', '12B', '12C', '12D', '12E', '12F']; // места с увеличенным пространством (пример: первый ряд эконома + ещё ряд)
const BUSINESS_PRICE_MULTIPLIER = 1.5;
const EXTRA_LEGROOM_MULTIPLIER = 1.2;

export default function SeatMap({ flight, onClose }) {
  const { user } = useAuth();
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [useBonuses, setUseBonuses] = useState(false);
  const [loading, setLoading] = useState(false);

  const rows = [...BUSINESS_ROWS, ...ECONOMY_ROWS];
  const cols = 6;
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Функция вычисления цены места
  const getSeatPrice = (row) => {
    let basePrice = flight.price;
    if (BUSINESS_ROWS.includes(row)) return Math.round(basePrice * BUSINESS_PRICE_MULTIPLIER);
    if (EXTRA_LEGROOM_SEATS.some(s => s.startsWith(`${row}`))) return Math.round(basePrice * EXTRA_LEGROOM_MULTIPLIER);
    return basePrice;
  };

  const seatCode = (row, letter) => `${row}${letter}`;
  const isBusiness = (row) => BUSINESS_ROWS.includes(row);
  const isExtraLegroom = (row, letter) => EXTRA_LEGROOM_SEATS.includes(seatCode(row, letter));

  const maxBonuses = Math.floor(flight.price * 0.5);
  const bonusesAvailable = user?.bonuses || 0;
  const finalPrice = selectedSeat
    ? useBonuses
      ? Math.max(0, getSeatPrice(selectedSeat.row) - Math.min(maxBonuses, bonusesAvailable))
      : getSeatPrice(selectedSeat.row)
    : 0;

  const handlePurchase = async () => {
    if (!selectedSeat) return;
    setLoading(true);
    const seatNum = (selectedSeat.row - 1) * cols + letters.indexOf(selectedSeat.letter) + 1;
    try {
      const res = await api.post('/api/tickets/purchase', {
        flight_id: flight.id,
        seat_number: seatNum,
        use_bonuses: useBonuses ? Math.min(maxBonuses, bonusesAvailable) : 0
      });
      toast.success(`Билет куплен! Начислено бонусов: ${res.data.bonuses_earned}`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal seat-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{flight.flight_number} — Выбор места</h3>
          <p>{flight.origin} → {flight.destination}</p>
        </div>

        <div className="seat-legend">
          <span><div className="leg free"></div> Эконом</span>
          <span><div className="leg business-legend"></div> Бизнес</span>
          <span><div className="leg extra-legroom"></div> Доп. пространство</span>
          <span><div className="leg selected"></div> Выбрано</span>
        </div>

        <div className="cabin">
          {rows.map(row => {
            const isBiz = isBusiness(row);
            return (
              <div key={row} className="seat-row">
                <div className="seat-group">
                  {letters.slice(0, 3).map(letter => {
                    const selected = selectedSeat?.row === row && selectedSeat?.letter === letter;
                    const extra = isExtraLegroom(row, letter);
                    const price = getSeatPrice(row);
                    return (
                      <div
                        key={letter}
                        className={`seat ${isBiz ? 'business' : ''} ${extra ? 'extra-legroom' : ''} ${selected ? 'selected' : ''}`}
                        onClick={() => setSelectedSeat({ row, letter, price })}
                      >
                        <span className="seat-letter">{letter}</span>
                        <span className="seat-price">{price.toLocaleString()} ₽</span>
                      </div>
                    );
                  })}
                </div>
                <div className="aisle"></div>
                <div className="seat-group">
                  {letters.slice(3, 6).map(letter => {
                    const selected = selectedSeat?.row === row && selectedSeat?.letter === letter;
                    const extra = isExtraLegroom(row, letter);
                    const price = getSeatPrice(row);
                    return (
                      <div
                        key={letter}
                        className={`seat ${isBiz ? 'business' : ''} ${extra ? 'extra-legroom' : ''} ${selected ? 'selected' : ''}`}
                        onClick={() => setSelectedSeat({ row, letter, price })}
                      >
                        <span className="seat-letter">{letter}</span>
                        <span className="seat-price">{price.toLocaleString()} ₽</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {bonusesAvailable > 0 && (
          <div className="bonus-block">
            <label>
              <input type="checkbox" checked={useBonuses} onChange={e => setUseBonuses(e.target.checked)} />
              Использовать бонусы (до {Math.min(maxBonuses, bonusesAvailable)} ₽)
            </label>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onClose}>Отмена</button>
          <button className="btn btn-secondary" onClick={handlePurchase} disabled={!selectedSeat || loading}>
            {loading ? 'Покупка...' : selectedSeat ? `Купить за ${finalPrice.toLocaleString()} ₽` : 'Выберите место'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}