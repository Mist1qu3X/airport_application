import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function Profile() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [activeTab, setActiveTab] = useState('tickets');

  useEffect(() => {
    if (user) {
      api.get('/api/tickets/my').then(res => setTickets(res.data)).catch(console.error);
    }
  }, [user]);

  const returnTicket = async (ticketId) => {
    if (!window.confirm('Вернуть билет? Будет списана часть бонусов.')) return;
    try {
      const res = await api.delete(`/api/tickets/${ticketId}`);
      alert(res.data.msg);
      setTickets(tickets.filter(t => t.id !== ticketId));
    } catch (err) {
      alert(err.response?.data?.detail || 'Ошибка');
    }
  };

  if (!user) return <div className="auth-page"><p>Войдите в систему</p></div>;

  const formatDate = (iso) => new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
  const formatTime = (iso) => new Date(iso).toLocaleTimeString('ru-RU', {
    hour: '2-digit', minute: '2-digit'
  });

  const activeTickets = tickets.filter(t => t.status === 'scheduled' || t.status === 'boarding' || t.status === 'delayed');
  const historyTickets = tickets.filter(t => t.status === 'departed' || t.status === 'landed' || t.status === 'cancelled');
  const totalSpent = tickets.reduce((sum, t) => sum + (t.price || 0), 0);

  const bonusPercent = user.bonuses > 0 ? Math.min(100, (user.bonuses / 1000) * 100) : 0;
  const nextLevel = user.bonuses < 1000 ? 'Серебряный (1000 бонусов)' : user.bonuses < 5000 ? 'Золотой (5000 бонусов)' : 'Платиновый (10000 бонусов)';

  return (
    <div className="profile-page animate-fade-in">
      <h2>👤 Личный кабинет</h2>

      {/* Карточка профиля */}
      <div className="card profile-card">
        <div className="profile-header">
          <div className="profile-avatar">{user.username[0].toUpperCase()}</div>
          <div>
            <h3>{user.full_name || user.username}</h3>
            <p style={{ color: 'var(--text-secondary)' }}>@{user.username} · {user.role}</p>
          </div>
        </div>
        <div className="profile-stats">
          <div className="stat">
            <div className="stat-value">{tickets.length}</div>
            <div className="stat-label">Билетов</div>
          </div>
          <div className="stat">
            <div className="stat-value">{totalSpent.toLocaleString()} ₽</div>
            <div className="stat-label">Потрачено</div>
          </div>
          <div className="stat">
            <div className="stat-value" style={{ color: 'var(--secondary)' }}>{user.bonuses}</div>
            <div className="stat-label">Бонусов</div>
          </div>
        </div>
      </div>

      {/* Бонусная программа */}
      <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
        <h3>⭐ Бонусная программа</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
          За каждую покупку начисляется 5% от стоимости билета. Бонусами можно оплатить до 50% цены.
        </p>
        <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
          <span>Прогресс до следующего уровня</span>
          <span>{user.bonuses} / 1000</span>
        </div>
        <div style={{
          width: '100%', height: '8px', background: '#e0e0e0', borderRadius: '4px', overflow: 'hidden'
        }}>
          <div style={{
            width: `${bonusPercent}%`, height: '100%',
            background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
            borderRadius: '4px', transition: 'width 0.5s'
          }}></div>
        </div>
        <p style={{ marginTop: '6px', fontSize: '0.85rem', color: 'var(--text-light)' }}>
          {nextLevel}
        </p>
      </div>

      {/* Вкладки */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          className={`btn ${activeTab === 'tickets' ? 'btn-primary' : 'btn-outline'} btn-sm`}
          onClick={() => setActiveTab('tickets')}
        >
          Активные ({activeTickets.length})
        </button>
        <button
          className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-outline'} btn-sm`}
          onClick={() => setActiveTab('history')}
        >
          История ({historyTickets.length})
        </button>
      </div>

      {/* Активные билеты */}
      {activeTab === 'tickets' && (
        <div>
          {activeTickets.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>Нет активных билетов</p>}
          {activeTickets.map(t => (
            <div key={t.id} className="card ticket-item" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 20px', marginBottom: '10px'
            }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{t.flight_number}</div>
                <div>{t.origin} → {t.destination}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {formatDate(t.departure)} · {formatTime(t.departure)} – {formatTime(t.arrival)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: '600' }}>Место {t.seat_number}</div>
                <div style={{ color: 'var(--primary)', fontWeight: '600' }}>{t.price} ₽</div>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ marginTop: '6px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                  onClick={() => returnTicket(t.id)}
                >
                  Вернуть
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* История */}
      {activeTab === 'history' && (
        <div>
          {historyTickets.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>Нет завершённых поездок</p>}
          {historyTickets.map(t => (
            <div key={t.id} className="card" style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 20px', marginBottom: '10px', opacity: 0.8
            }}>
              <div>
                <div style={{ fontWeight: '600' }}>{t.flight_number}</div>
                <div>{t.origin} → {t.destination}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {formatDate(t.departure)} · Место {t.seat_number}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`status-badge status-${t.status === 'landed' ? 'ok' : 'bad'}`}>
                  {t.status === 'landed' ? 'Завершён' : t.status}
                </span>
                <div style={{ marginTop: '4px', fontWeight: '600' }}>{t.price} ₽</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}