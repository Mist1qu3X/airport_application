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
        // Загружаем погоду для пункта назначения
        fetchWeather(res.data.destination);
      })
      .catch(console.error);
  }, [id]);

  const fetchWeather = async (city) => {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const response = await fetch(`${WEATHER_API_URL}${encodeURIComponent(city)}&appid=${WEATHER_API_KEY}`);
      if (!response.ok) {
        throw new Error('Город не найден или ошибка API');
      }
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
      // Ставим заглушку если не получилось загрузить
      setWeather({
        temp: 20,
        feelsLike: 18,
        condition: 'ясно',
        icon: '01d',
        humidity: 65,
        wind: 5,
        pressure: 1013,
        visibility: 10000,
        clouds: 20
      });
    } finally {
      setWeatherLoading(false);
    }
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

  const punctuality = flight.status === 'scheduled' ? '85%' : flight.status === 'delayed' ? '45%' : '95%';
  const onTimeRating = flight.status === 'delayed' ? 'Низкая' : 'Высокая';

  // Функция перевода описания погоды на русский
  const translateWeather = (condition) => {
    const translations = {
      'clear sky': 'Ясно ☀️',
      'few clouds': 'Малооблачно 🌤',
      'scattered clouds': 'Облачно с прояснениями ⛅',
      'broken clouds': 'Облачно ☁️',
      'overcast clouds': 'Пасмурно ☁️',
      'light rain': 'Небольшой дождь 🌧',
      'moderate rain': 'Дождь 🌧',
      'heavy rain': 'Сильный дождь 🌧',
      'thunderstorm': 'Гроза ⛈',
      'snow': 'Снег 🌨',
      'mist': 'Туман 🌫',
      'haze': 'Дымка 🌫',
    };
    return translations[condition] || condition;
  };

  return (
    <div className="flight-detail-page animate-fade-in">
      <Link to="/results" className="btn btn-outline btn-sm" style={{ marginBottom: '20px' }}>
        ← Назад к поиску
      </Link>

      {/* Основная информация */}
      <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
        <div className="detail-header">
          <div>
            <div className="airline-logo" style={{ width: '48px', height: '48px', fontSize: '1.3rem', marginBottom: '8px' }}>
              {flight.airline[0]}
            </div>
            <h2>{flight.airline}</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Рейс {flight.flight_number}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className={`status-badge status-${flight.status === 'scheduled' ? 'ok' : flight.status === 'boarding' ? 'warn' : 'bad'}`}>
              {flight.status === 'scheduled' ? 'По расписанию' : flight.status}
            </span>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary)', marginTop: '8px' }}>
              {flight.price.toLocaleString()} ₽
            </div>
          </div>
        </div>
      </div>

      {/* Маршрут и время */}
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
                      {stop.airport} ({formatTime(stop.arrival)} - {formatTime(stop.departure)})
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
        {/* Информация о самолёте */}
        <div className="card" style={{ padding: '20px' }}>
          <h3>✈ О самолёте</h3>
          <div className="info-list">
            <div className="info-item">
              <span>Модель</span>
              <span>{flight.aircraft?.model || 'Boeing 737-800'}</span>
            </div>
            <div className="info-item">
              <span>Регистрация</span>
              <span>{flight.aircraft?.registration || 'RA-12345'}</span>
            </div>
            <div className="info-item">
              <span>Возраст</span>
              <span>5.2 года</span>
            </div>
            <div className="info-item">
              <span>Схема салона</span>
              <span>3-3 (эконом)</span>
            </div>
          </div>
        </div>

        {/* Погода с реальным API */}
        <div className="card" style={{ padding: '20px' }}>
          <h3>🌤 Погода в {flight.destination}</h3>
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
                  <div style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                    {translateWeather(weather.condition)}
                  </div>
                </div>
              </div>
              <div className="info-list" style={{ marginTop: '12px' }}>
                <div className="info-item">
                  <span>Ощущается как</span>
                  <span>{weather.feelsLike}°C</span>
                </div>
                <div className="info-item">
                  <span>Влажность</span>
                  <span>{weather.humidity}%</span>
                </div>
                <div className="info-item">
                  <span>Ветер</span>
                  <span>{weather.wind} м/с</span>
                </div>
                <div className="info-item">
                  <span>Давление</span>
                  <span>{weather.pressure} гПа</span>
                </div>
                <div className="info-item">
                  <span>Видимость</span>
                  <span>{weather.visibility ? `${(weather.visibility / 1000).toFixed(1)} км` : 'Н/Д'}</span>
                </div>
                <div className="info-item">
                  <span>Облачность</span>
                  <span>{weather.clouds}%</span>
                </div>
              </div>
              {weatherError && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '8px' }}>
                  * Показаны примерные данные
                </p>
              )}
            </div>
          ) : (
            <p>Не удалось загрузить погоду</p>
          )}
        </div>

        {/* Пунктуальность */}
        <div className="card" style={{ padding: '20px' }}>
          <h3>Статистика рейса</h3>
          <div className="punctuality-meter">
            <div className="meter-label">Пунктуальность</div>
            <div className="meter-bar">
              <div 
                className="meter-fill" 
                style={{ 
                  width: punctuality,
                  background: punctuality > '70%' ? 'var(--success)' : 'var(--danger)'
                }}
              ></div>
            </div>
            <div className="meter-value">{punctuality}</div>
          </div>
          <div className="info-list" style={{ marginTop: '12px' }}>
            <div className="info-item">
              <span>Рейтинг пунктуальности</span>
              <span style={{ color: onTimeRating === 'Высокая' ? 'var(--success)' : 'var(--danger)' }}>
                {onTimeRating}
              </span>
            </div>
            <div className="info-item">
              <span>Средняя задержка</span>
              <span>{flight.status === 'delayed' ? '25 мин' : '5 мин'}</span>
            </div>
            <div className="info-item">
              <span>Багаж</span>
              <span>{flight.baggage_status || 'Не проверен'}</span>
            </div>
          </div>
        </div>

        {/* Покупка */}
        <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
          <h3>Готовы к полёту?</h3>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary)', margin: '12px 0' }}>
            {flight.price.toLocaleString()} ₽
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
            Осталось {flight.free_seats} мест из {flight.aircraft?.capacity || 30}
          </p>
          <button className="btn btn-secondary" onClick={() => setShowSeatMap(true)}>
            Выбрать место и купить
          </button>
        </div>
      </div>

      {showSeatMap && <SeatMap flight={flight} onClose={() => setShowSeatMap(false)} />}
    </div>
  );
}