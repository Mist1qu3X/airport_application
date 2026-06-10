import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import SeatMap from './SeatMap';

const WEATHER_API_KEY = '7ebfa78e0b72baaca9dbbc9a9b7a03db';
const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5/weather?units=metric&q=';

export default function FlightDetail() {
  const { id } = useParams();
  const [flight, setFlight] = useState(null);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState(null);
  const [showSeatMap, setShowSeatMap] = useState(false);

  useEffect(() => {
    api.get(`/api/flights/${id}`)
      .then(res => {
        setFlight(res.data);
        if (res.data.destination) fetchWeather(res.data.destination);
      })
      .catch(console.error);
  }, [id]);

  const fetchWeather = async (city) => {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const response = await fetch(`${WEATHER_API_URL}${encodeURIComponent(city)}&appid=${WEATHER_API_KEY}`);
      if (!response.ok) throw new Error('Город не найден');
      const data = await response.json();
      setWeather({
        temp: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        condition: data.weather[0].description,
        icon: data.weather[0].icon,
        humidity: data.main.humidity,
        wind: Math.round(data.wind.speed),
        pressure: data.main.pressure,
        visibility: data.visibility,
        clouds: data.clouds.all
      });
    } catch (err) {
      setWeatherError(err.message);
      setWeather({
        temp: 20, feelsLike: 18, condition: 'ясно', icon: '01d',
        humidity: 65, wind: 5, pressure: 1013, visibility: 10000, clouds: 20
      });
    } finally {
      setWeatherLoading(false);
    }
  };

  const translateWeather = (condition) => {
    const translations = {
      'clear sky': 'Ясно',
      'few clouds': 'Малооблачно',
      'scattered clouds': 'Облачно с прояснениями',
      'broken clouds': 'Облачно',
      'overcast clouds': 'Пасмурно',
      'light rain': 'Небольшой дождь',
      'moderate rain': 'Дождь',
      'heavy rain': 'Сильный дождь',
      'thunderstorm': 'Гроза',
      'snow': 'Снег',
      'mist': 'Туман',
      'haze': 'Дымка',
    };
    return translations[condition] || condition;
  };

  if (!flight) return <div className="loading-screen">Загрузка...</div>;

  const formatDate = (iso) => new Date(iso).toLocaleDateString('ru-RU', { 
    day: 'numeric', month: 'long', year: 'numeric' 
  });
  const formatTime = (iso) => new Date(iso).toLocaleTimeString('ru-RU', { 
    hour: '2-digit', minute: '2-digit' 
  });
  const duration = (dep, arr) => {
    const depTime = new Date(dep);
    const arrTime = new Date(arr);
    let diffMs = arrTime - depTime;
    if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours} ч ${minutes} мин`;
  };

  const calculatePunctuality = () => {
    if (flight.status === 'delayed' && flight.estimated_departure && flight.scheduled_departure) {
      const delayMs = new Date(flight.estimated_departure) - new Date(flight.scheduled_departure);
      const delayMin = Math.round(delayMs / 60000);
      if (delayMin <= 15) return { percent: '95%', rating: 'Высокая', color: 'var(--success)', delay: delayMin };
      if (delayMin <= 30) return { percent: '75%', rating: 'Средняя', color: 'var(--warning)', delay: delayMin };
      if (delayMin <= 60) return { percent: '50%', rating: 'Низкая', color: 'var(--danger)', delay: delayMin };
      return { percent: '25%', rating: 'Очень низкая', color: 'var(--danger)', delay: delayMin };
    }
    if (flight.status === 'scheduled' || flight.status === 'boarding') {
      return { percent: '95%', rating: 'Высокая', color: 'var(--success)', delay: 0 };
    }
    if (flight.status === 'departed' || flight.status === 'landed') {
      if (flight.estimated_departure && flight.scheduled_departure) {
        const delayMs = new Date(flight.estimated_departure) - new Date(flight.scheduled_departure);
        const delayMin = Math.round(delayMs / 60000);
        if (delayMin <= 0) return { percent: '98%', rating: 'Отлично', color: 'var(--success)', delay: 0 };
        if (delayMin <= 15) return { percent: '90%', rating: 'Хорошо', color: 'var(--success)', delay: delayMin };
        if (delayMin <= 30) return { percent: '70%', rating: 'Средне', color: 'var(--warning)', delay: delayMin };
        return { percent: '40%', rating: 'Плохо', color: 'var(--danger)', delay: delayMin };
      }
      return { percent: '90%', rating: 'Хорошо', color: 'var(--success)', delay: 0 };
    }
    return { percent: '—', rating: 'Нет данных', color: 'var(--text-light)', delay: 0 };
  };

  const punctualityData = calculatePunctuality();

  return (
    <div className="flight-detail-page animate-fade-in">
      <Link to="/results" className="btn btn-outline btn-sm" style={{ marginBottom: '20px' }}>
        ← Назад к поиску
      </Link>

      <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
        <div className="detail-header">
          <div>
            <div className="airline-logo" style={{ width: '48px', height: '48px', fontSize: '1.3rem', marginBottom: '8px' }}>
              {flight.airline?.[0] || 'A'}
            </div>
            <h2>{flight.airline}</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Рейс {flight.flight_number}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className={`status-badge status-${flight.status === 'scheduled' ? 'ok' : flight.status === 'boarding' ? 'warn' : flight.status === 'cancelled' ? 'bad' : flight.status === 'delayed' ? 'bad' : 'ok'}`}>
              {flight.status === 'scheduled' ? 'По расписанию' : 
               flight.status === 'boarding' ? 'Посадка' : 
               flight.status === 'delayed' ? 'Задержан' : 
               flight.status === 'departed' ? 'Вылетел' : 
               flight.status === 'landed' ? 'Прибыл' : flight.status}
            </span>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary)', marginTop: '8px' }}>
              {flight.price?.toLocaleString()} ₽
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
        <h3>Маршрут</h3>
        <div className="route-timeline">
          <div className="route-point">
            <div className="route-time">{formatTime(flight.scheduled_departure)}</div>
            <div className="route-date">{formatDate(flight.scheduled_departure)}</div>
            <div className="route-city">{flight.origin}</div>
          </div>
          
          <div className="route-line-container">
            <div className="route-duration">{duration(flight.scheduled_departure, flight.scheduled_arrival)}</div>
            <div className="route-line"></div>
            {flight.stopovers && flight.stopovers.length > 0 && (
              <div className="route-stops">
                {flight.stopovers.map((stop, i) => (
                  <div key={i} className="stopover">
                    <div className="stop-dot"></div>
                    <div className="stop-info">
                      {stop.airport} ({stop.arrival ? formatTime(stop.arrival) : '—'} - {stop.departure ? formatTime(stop.departure) : '—'})
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="route-point">
            <div className="route-time">{formatTime(flight.scheduled_arrival)}</div>
            <div className="route-date">{formatDate(flight.scheduled_arrival)}</div>
            <div className="route-city">{flight.destination}</div>
          </div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="card" style={{ padding: '20px' }}>
          <h3>О самолёте</h3>
          <div className="info-list">
            <div className="info-item"><span>Модель</span><span>Boeing 737-800</span></div>
            <div className="info-item"><span>Регистрация</span><span>RA-12345</span></div>
            <div className="info-item"><span>Возраст</span><span>5.2 года</span></div>
            <div className="info-item"><span>Схема салона</span><span>3-3 (эконом)</span></div>
            <div className="info-item"><span>Крейсерская скорость</span><span>850 км/ч</span></div>
            <div className="info-item"><span>Дальность полёта</span><span>5 500 км</span></div>
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <h3>Погода в {flight.destination}</h3>
          {weatherLoading ? (
            <p>Загрузка погоды...</p>
          ) : weather ? (
            <div className="weather-info">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                {weather.icon && (
                  <img 
                    src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                    alt={weather.condition}
                    style={{ width: '64px', height: '64px' }}
                  />
                )}
                <div>
                  <div style={{ fontSize: '2.5rem', fontWeight: '700' }}>{weather.temp}°C</div>
                  <div style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{translateWeather(weather.condition)}</div>
                </div>
              </div>
              <div className="info-list" style={{ marginTop: '12px' }}>
                <div className="info-item"><span>Ощущается как</span><span>{weather.feelsLike}°C</span></div>
                <div className="info-item"><span>Влажность</span><span>{weather.humidity}%</span></div>
                <div className="info-item"><span>Ветер</span><span>{weather.wind} м/с</span></div>
                <div className="info-item"><span>Давление</span><span>{weather.pressure} гПа</span></div>
                <div className="info-item"><span>Видимость</span><span>{weather.visibility ? `${(weather.visibility / 1000).toFixed(1)} км` : 'Н/Д'}</span></div>
                <div className="info-item"><span>Облачность</span><span>{weather.clouds}%</span></div>
              </div>
              {weatherError && <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '8px' }}>* Показаны примерные данные</p>}
            </div>
          ) : <p>Не удалось загрузить погоду</p>}
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <h3>Статистика рейса</h3>
          <div className="punctuality-meter">
            <div className="meter-label">Пунктуальность</div>
            <div className="meter-bar"><div className="meter-fill" style={{ width: punctualityData.percent, background: punctualityData.color }}></div></div>
            <div className="meter-value" style={{ color: punctualityData.color }}>{punctualityData.percent}</div>
          </div>
          <div className="info-list" style={{ marginTop: '12px' }}>
            <div className="info-item"><span>Рейтинг пунктуальности</span><span style={{ color: punctualityData.color, fontWeight: '600' }}>{punctualityData.rating}</span></div>
            {punctualityData.delay > 0 && <div className="info-item"><span>Задержка</span><span>{punctualityData.delay} мин</span></div>}
            <div className="info-item"><span>Багаж</span><span>{flight.baggage_status && flight.baggage_status !== 'not_checked' ? flight.baggage_status : 'Включён в стоимость'}</span></div>
            <div className="info-item"><span>Питание на борту</span><span>Включено</span></div>
          </div>
        </div>

        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <h3>Готовы к полёту?</h3>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary)', margin: '12px 0' }}>{flight.price?.toLocaleString()} ₽</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Осталось {flight.free_seats} мест из {flight.capacity || 30}
          </p>
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowSeatMap(true)}
            disabled={flight.status !== 'scheduled' && flight.status !== 'boarding' && flight.status !== 'delayed'}
          >
            {flight.status === 'scheduled' || flight.status === 'boarding' || flight.status === 'delayed' 
              ? 'Выбрать место и купить' : 'Продажа закрыта'}
          </button>
        </div>
      </div>

      {showSeatMap && <SeatMap flight={flight} onClose={() => setShowSeatMap(false)} />}
    </div>
  );
}