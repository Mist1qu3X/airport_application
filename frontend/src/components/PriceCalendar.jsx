import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function PriceCalendar({ origin, destination }) {
  const [prices, setPrices] = useState({});
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
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
      const res = await api.get('/api/flights/prices', {
        params: {
          origin,
          destination,
          year: currentMonth.getFullYear(),
          month: currentMonth.getMonth() + 1
        }
      });
      setPrices(res.data.prices || {});
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

  const handleDayClick = (day) => {
    const priceData = prices[String(day)];  // важно: ключи теперь строки!
    if (!priceData) return;
    
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const dateStr = date.toISOString().split('T')[0];
    navigate(`/results?origin=${origin}&destination=${destination}&date=${dateStr}`);
  };

  const monthName = currentMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() || 7;
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  
  const priceValues = Object.values(prices).map(p => p.price);
  const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : 0;
  const maxPrice = priceValues.length > 0 ? Math.max(...priceValues) : 0;
  
  const getPriceColor = (price) => {
    if (maxPrice === minPrice || !price) return '#e8f5e9';
    const ratio = (price - minPrice) / (maxPrice - minPrice);
    if (ratio < 0.33) return '#c8e6c9';
    if (ratio < 0.66) return '#fff9c4';
    return '#ffcdd2';
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const isPastDay = (day) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return date < today;
  };

  return (
    <div className="card" style={{ padding: '20px', maxWidth: '380px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <button onClick={prevMonth} className="btn btn-outline btn-sm">←</button>
        <h3 style={{ margin: 0, textTransform: 'capitalize', fontSize: '1.1rem' }}>{monthName}</h3>
        <button onClick={nextMonth} className="btn btn-outline btn-sm">→</button>
      </div>
      
      {error && (
        <div style={{ color: 'var(--danger)', textAlign: 'center', marginBottom: '12px', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', fontSize: '0.75rem', justifyContent: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#c8e6c9', display: 'inline-block' }}></span>
          Низкая
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#fff9c4', display: 'inline-block' }}></span>
          Средняя
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#ffcdd2', display: 'inline-block' }}></span>
          Высокая
        </span>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: '20px', fontSize: '0.9rem' }}>Загрузка...</p>
      ) : (
        <>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)', 
            gap: '2px',
            textAlign: 'center'
          }}>
            {/* Дни недели */}
            {weekDays.map(day => (
              <div key={day} style={{ 
                fontSize: '0.7rem', 
                fontWeight: 600, 
                color: '#999', 
                padding: '2px 0' 
              }}>
                {day}
              </div>
            ))}
            
            {/* Пустые ячейки */}
            {Array.from({ length: firstDay - 1 }, (_, i) => (
              <div key={`empty-${i}`} style={{ aspectRatio: '1' }}></div>
            ))}
            
            {/* Дни месяца */}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const priceData = prices[String(day)];  // ключ — строка!
              const isPast = isPastDay(day);
              const hasData = !!priceData;
              
              return (
                <div 
                  key={day}
                  onClick={() => hasData && !isPast && handleDayClick(day)}
                  style={{
                    aspectRatio: '1',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    background: hasData ? getPriceColor(priceData.price) : 'transparent',
                    cursor: hasData && !isPast ? 'pointer' : 'default',
                    opacity: isPast ? 0.4 : 1,
                    transition: 'transform 0.15s',
                    padding: '1px',
                    border: hasData ? '1px solid rgba(0,0,0,0.08)' : '1px solid transparent',
                    fontSize: '0.8rem',
                    minWidth: 0,
                    overflow: 'hidden'
                  }}
                  onMouseEnter={e => {
                    if (hasData && !isPast) e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  title={hasData ? `Мин. цена: ${priceData.min_price.toLocaleString()} ₽\nРейсов: ${priceData.flights_count}` : 'Нет рейсов'}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.8rem', lineHeight: 1 }}>{day}</span>
                  {hasData && (
                    <span style={{ fontSize: '0.6rem', fontWeight: 500, lineHeight: 1, whiteSpace: 'nowrap' }}>
                      {priceData.min_price.toLocaleString()} ₽
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {Object.keys(prices).length > 0 && (
            <div style={{ 
              marginTop: '10px', 
              padding: '6px 10px', 
              background: 'var(--bg-primary)', 
              borderRadius: '6px',
              textAlign: 'center',
              fontSize: '0.8rem'
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                Цены от {minPrice.toLocaleString()} до {maxPrice.toLocaleString()} ₽
              </span>
            </div>
          )}
          
          {Object.keys(prices).length === 0 && !loading && !error && (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '15px', fontSize: '0.85rem' }}>
              Нет рейсов в этом месяце
            </p>
          )}
        </>
      )}
    </div>
  );
}