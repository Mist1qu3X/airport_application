// src/components/SeatMap.tsx
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { ticketsApi } from '../api/services';
import { useAuth } from '../contexts/AuthContext';
import type { Flight } from '../api/types';

interface SeatMapProps {
  flight: Flight;
  onClose: () => void;
}

interface SelectedSeat {
  row: number;
  letter: string;
  price: number;
}

const BUSINESS_ROWS = [1, 2, 3, 4];
const EXTRA_LEGROOM_SEATS = [
  '5A', '5B', '5C', '5D', '5E', '5F',
  '12A', '12B', '12C', '12D', '12E', '12F'
];
const BUSINESS_PRICE_MULTIPLIER = 1.5;
const EXTRA_LEGROOM_MULTIPLIER = 1.2;

const COLS = 6;
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function SeatMap({ flight, onClose }: SeatMapProps) {
  const { user } = useAuth();
  const [selectedSeat, setSelectedSeat] = useState<SelectedSeat | null>(null);
  const [useBonuses, setUseBonuses] = useState(false);
  const [loading, setLoading] = useState(false);

  const totalSeats = flight.capacity || 30;
  const rowsCount = Math.ceil(totalSeats / COLS);
  const rows = Array.from({ length: rowsCount }, (_, i) => i + 1);

  const soldSeats = flight.sold_seats || [];
  
  const isBusinessRow = (row: number): boolean => BUSINESS_ROWS.includes(row);
  
  const isExtraLegroomSeat = (row: number, letter: string): boolean => 
    EXTRA_LEGROOM_SEATS.includes(`${row}${letter}`);
  
  const getSeatPrice = (row: number): number => {
    const basePrice = flight.price;
    if (isBusinessRow(row)) return Math.round(basePrice * BUSINESS_PRICE_MULTIPLIER);
    if (LETTERS.some(l => isExtraLegroomSeat(row, l))) return Math.round(basePrice * EXTRA_LEGROOM_MULTIPLIER);
    return basePrice;
  };

  const seatExists = (row: number, letter: string): boolean => {
    const seatNumber = (row - 1) * COLS + LETTERS.indexOf(letter) + 1;
    return seatNumber <= totalSeats;
  };

  const getSeatNumber = (row: number, letter: string): number => 
    (row - 1) * COLS + LETTERS.indexOf(letter) + 1;

  const isSeatOccupied = (row: number, letter: string): boolean => {
    const seatNum = getSeatNumber(row, letter);
    return soldSeats.includes(seatNum);
  };

  const maxBonuses = Math.floor(flight.price * 0.5);
  const bonusesAvailable = user?.bonuses || 0;
  
  const finalPrice = selectedSeat
    ? useBonuses
      ? Math.max(0, selectedSeat.price - Math.min(maxBonuses, bonusesAvailable))
      : selectedSeat.price
    : 0;

  const handlePurchase = async () => {
    if (!selectedSeat) return;
    
    setLoading(true);
    const seatNumber = getSeatNumber(selectedSeat.row, selectedSeat.letter);
    
    try {
      const res = await ticketsApi.purchase({
        flight_id: flight.id,
        seat_number: seatNumber,
        use_bonuses: useBonuses ? Math.min(maxBonuses, bonusesAvailable) : 0
      });
      
      toast.success(`Билет куплен! Начислено бонусов: ${res.bonuses_earned}`);
      onClose();
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка при покупке';
      toast.error(message);
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
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Вместимость: {totalSeats} мест • Свободно: {flight.free_seats}
          </p>
        </div>

        <div className="seat-legend">
          <span><div className="leg free" /> Свободно</span>
          <span><div className="leg business-legend" /> Бизнес</span>
          <span><div className="leg extra-legroom" /> Доп. пространство</span>
          <span><div className="leg selected" /> Выбрано</span>
          <span><div className="leg occupied" /> Занято</span>
        </div>

        <div className="cabin">
          {rows.map(row => {
            const isBiz = isBusinessRow(row);
            return (
              <div key={row} className={`seat-row ${isBiz ? 'business-row' : ''}`}>
                <div className="row-number">{row}</div>
                <div className="seat-group">
                  {LETTERS.slice(0, 3).map(letter => {
                    if (!seatExists(row, letter)) {
                      return <div key={letter} className="seat empty" />;
                    }
                    
                    const selected = selectedSeat?.row === row && selectedSeat?.letter === letter;
                    const extra = isExtraLegroomSeat(row, letter);
                    const price = getSeatPrice(row);
                    const occupied = isSeatOccupied(row, letter);
                    
                    return (
                      <div
                        key={letter}
                        className={`seat ${isBiz ? 'business' : ''} ${extra ? 'extra-legroom' : ''} ${selected ? 'selected' : ''} ${occupied ? 'occupied' : ''}`}
                        onClick={() => !occupied && setSelectedSeat({ row, letter, price })}
                        title={`Место ${row}${letter} • ${price.toLocaleString()} ₽${occupied ? ' (занято)' : ''}`}
                      >
                        <span className="seat-letter">{letter}</span>
                        <span className="seat-price">{price.toLocaleString()} ₽</span>
                      </div>
                    );
                  })}
                </div>
                <div className="aisle" />
                <div className="seat-group">
                  {LETTERS.slice(3, 6).map(letter => {
                    if (!seatExists(row, letter)) {
                      return <div key={letter} className="seat empty" />;
                    }
                    
                    const selected = selectedSeat?.row === row && selectedSeat?.letter === letter;
                    const extra = isExtraLegroomSeat(row, letter);
                    const price = getSeatPrice(row);
                    const occupied = isSeatOccupied(row, letter);
                    
                    return (
                      <div
                        key={letter}
                        className={`seat ${isBiz ? 'business' : ''} ${extra ? 'extra-legroom' : ''} ${selected ? 'selected' : ''} ${occupied ? 'occupied' : ''}`}
                        onClick={() => !occupied && setSelectedSeat({ row, letter, price })}
                        title={`Место ${row}${letter} • ${price.toLocaleString()} ₽${occupied ? ' (занято)' : ''}`}
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
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={useBonuses} 
                onChange={e => setUseBonuses(e.target.checked)} 
              />
              <span>
                Использовать бонусы (до {Math.min(maxBonuses, bonusesAvailable).toLocaleString()} ₽)
              </span>
            </label>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              У вас {bonusesAvailable.toLocaleString()} бонусов
            </p>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onClose}>
            Отмена
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handlePurchase} 
            disabled={!selectedSeat || loading}
          >
            {loading 
              ? 'Покупка...' 
              : selectedSeat 
                ? `Купить за ${finalPrice.toLocaleString()} ₽` 
                : 'Выберите место'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}