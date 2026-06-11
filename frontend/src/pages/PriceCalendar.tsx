// src/components/PriceCalendar.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pricesApi } from '../api/services';
import type { CalendarPricesResponse, CalendarPriceDay } from '../api/types';

interface PriceCalendarProps {
  origin: string;
  destination: string;
}

type PriceLevel = 'low' | 'mid' | 'high';

export default function PriceCalendar({ origin, destination }: PriceCalendarProps) {
  const [prices, setPrices] = useState<Record<string, CalendarPriceDay>>({});
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (origin && destination) {
      fetchPrices();
    }
  }, [origin, destination, currentMonth]);

  const fetchPrices = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await pricesApi.getCalendar({
        origin,
        destination,
        year: currentMonth.getFullYear(),
        month: currentMonth.getMonth() + 1
      });
      setPrices(data.prices || {});
    } catch (err) {
      setError('Не удалось загрузить цены');
      setPrices({});
    } finally {
      setLoading(false);
    }
  };

  const prevMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentMonth(newDate);
  };

  const nextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentMonth(newDate);
  };

  const handleDayClick = (day: number) => {
    const priceData = prices[String(day)];
    if (!priceData) return;
    
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${month}-${dayStr}`;
    
    navigate(
      `/results?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&date=${dateStr}`
    );
  };

  const monthName = currentMonth.toLocaleDateString('ru-RU', { 
    month: 'long', 
    year: 'numeric' 
  });
  
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  
  // Корректировка для российского календаря (Пн - первый день)
  const firstDay = new Date(
    currentMonth.getFullYear(), 
    currentMonth.getMonth(), 
    1
  ).getDay() || 7;
  
  const daysInMonth = new Date(
    currentMonth.getFullYear(), 
    currentMonth.getMonth() + 1, 
    0
  ).getDate();
  
  const priceValues = Object.values(prices).map(p => p.min_price);
  const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : 0;
  const maxPrice = priceValues.length > 0 ? Math.max(...priceValues) : 0;
  
  const getPriceColor = (price: number): PriceLevel => {
    if (maxPrice === minPrice || !price) return 'low';
    const ratio = (price - minPrice) / (maxPrice - minPrice);
    if (ratio < 0.33) return 'low';
    if (ratio < 0.66) return 'mid';
    return 'high';
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const isPastDay = (day: number): boolean => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return date < today;
  };

  return (
    <div className="card price-calendar-card">
      <div className="calendar-header">
        <button 
          onClick={prevMonth} 
          className="btn btn-outline btn-sm"
          type="button"
        >
          ←
        </button>
        <h3 className="calendar-month-title">{monthName}</h3>
        <button 
          onClick={nextMonth} 
          className="btn btn-outline btn-sm"
          type="button"
        >
          →
        </button>
      </div>
      
      {error && (
        <div className="calendar-error">{error}</div>
      )}

      <div className="calendar-legend">
        <span>
          <span className="legend-dot low" /> Низкая
        </span>
        <span>
          <span className="legend-dot mid" /> Средняя
        </span>
        <span>
          <span className="legend-dot high" /> Высокая
        </span>
      </div>

      {loading ? (
        <p className="calendar-loading">Загрузка...</p>
      ) : (
        <>
          <div className="calendar-grid">
            {weekDays.map(day => (
              <div key={day} className="calendar-weekday">{day}</div>
            ))}
            
            {Array.from({ length: firstDay - 1 }, (_, i) => (
              <div key={`empty-${i}`} className="calendar-day empty" />
            ))}
            
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const priceData = prices[String(day)];
              const isPast = isPastDay(day);
              const hasData = !!priceData;
              const colorClass = hasData ? getPriceColor(priceData.min_price) : '';
              
              return (
                <div 
                  key={day}
                  className={`calendar-day ${hasData ? 'has-flights' : ''} ${isPast ? 'past' : ''} ${colorClass}`}
                  onClick={() => hasData && !isPast && handleDayClick(day)}
                  title={
                    hasData 
                      ? `Мин. цена: ${priceData.min_price.toLocaleString()} ₽\nРейсов: ${priceData.flights_count}` 
                      : 'Нет рейсов'
                  }
                >
                  <span className="day-number">{day}</span>
                  {hasData && (
                    <span className="day-price">
                      {priceData.min_price.toLocaleString()} ₽
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {Object.keys(prices).length > 0 && (
            <div className="calendar-summary">
              Цены от {minPrice.toLocaleString()} до {maxPrice.toLocaleString()} ₽
            </div>
          )}
          
          {Object.keys(prices).length === 0 && !loading && !error && (
            <p className="calendar-empty">Нет рейсов в этом месяце</p>
          )}
        </>
      )}
    </div>
  );
}