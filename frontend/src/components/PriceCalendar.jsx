import { useEffect, useState } from 'react';
import api from '../api';

export default function PriceCalendar({ origin, destination }) {
  const [prices, setPrices] = useState({});
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (origin && destination) {
      fetchPrices();
    }
  }, [origin, destination, currentMonth]);

  const fetchPrices = async () => {
    setLoading(true);
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Генерируем цены на каждый день месяца (заглушка)
    const mockPrices = {};
    const basePrice = Math.floor(Math.random() * 5000) + 3000;
    
    for (let day = 1; day <= daysInMonth; day++) {
      // Случайная цена ±30% от базовой
      const variance = (Math.random() - 0.5) * basePrice * 0.6;
      mockPrices[day] = Math.round(basePrice + variance);
    }
    
    setPrices(mockPrices);
    setLoading(false);
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const monthName = currentMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  
  // Дни недели
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  
  // Первый день месяца
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() || 7;
  
  // Количество дней
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  
  // Находим мин и макс для тепловой карты
  const priceValues = Object.values(prices);
  const minPrice = Math.min(...priceValues);
  const maxPrice = Math.max(...priceValues);
  
  // Функция цвета ячейки
  const getPriceColor = (price) => {
    const ratio = (price - minPrice) / (maxPrice - minPrice);
    // Зелёный (низкая) -> Жёлтый (средняя) -> Красный (высокая)
    if (ratio < 0.33) return `rgba(0, 166, 80, ${0.3 + ratio * 2})`;
    if (ratio < 0.66) return `rgba(255, 204, 0, ${0.3 + (ratio - 0.33) * 2})`;
    return `rgba(230, 0, 0, ${0.2 + (ratio - 0.66) * 2})`;
  };

  return (
    <div className="price-calendar card animate-fade-in">
      <div className="calendar-header">
        <button onClick={prevMonth} className="btn btn-outline btn-sm">←</button>
        <h3 style={{ textTransform: 'capitalize' }}>{monthName}</h3>
        <button onClick={nextMonth} className="btn btn-outline btn-sm">→</button>
      </div>
      
      <div className="calendar-legend">
        <span><span className="legend-dot" style={{ background: '#00a650' }}></span> Дёшево</span>
        <span><span className="legend-dot" style={{ background: '#ffcc00' }}></span> Средне</span>
        <span><span className="legend-dot" style={{ background: '#e60000' }}></span> Дорого</span>
      </div>

      {loading ? (
        <p>Загрузка цен...</p>
      ) : (
        <div className="calendar-grid">
          {weekDays.map(day => (
            <div key={day} className="calendar-weekday">{day}</div>
          ))}
          
          {/* Пустые ячейки до первого дня */}
          {Array.from({ length: firstDay - 1 }, (_, i) => (
            <div key={`empty-${i}`} className="calendar-day empty"></div>
          ))}
          
          {/* Дни месяца */}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const price = prices[day];
            return (
              <div 
                key={day} 
                className="calendar-day"
                style={price ? { background: getPriceColor(price) } : {}}
              >
                <span className="day-number">{day}</span>
                {price && <span className="day-price">{price.toLocaleString()} ₽</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}