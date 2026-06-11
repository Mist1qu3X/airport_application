import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { ticketsApi, emailApi, bonusesApi } from '../api/services';
import type { TicketInfo, BonusInfo, EmailStatus } from '../api/types';
import { generateTicketPDF } from '../utils/ticketPdf';
import { formatMoscowDate, formatMoscowTime } from '../utils/date';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [tickets, setTickets] = useState<TicketInfo[]>([]);
  const [bonusInfo, setBonusInfo] = useState<BonusInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'tickets' | 'history'>('tickets');
  const [loading, setLoading] = useState(true);

  // Email state
  const [emailStatus, setEmailStatus] = useState<EmailStatus>({ email: '', verified: false });
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  
  // Новые состояния для кода подтверждения
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ticketsData, emailData, bonusData] = await Promise.all([
        ticketsApi.getMyTickets(),
        emailApi.getStatus().catch(() => ({ email: '', verified: false })),
        bonusesApi.getInfo(user!.id).catch(() => null),
      ]);
      setTickets(ticketsData);
      setEmailStatus(emailData);
      setBonusInfo(bonusData);
    } catch {
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const returnTicket = async (ticketId: number) => {
    if (!window.confirm('Вернуть билет? Будет списана часть бонусов.')) return;
    try {
      await ticketsApi.returnTicket(ticketId);
      toast.success('Билет возвращён');
      setTickets(prev => prev.filter(t => t.id !== ticketId));
      if (user) {
        const updated = await bonusesApi.getInfo(user.id);
        setBonusInfo(updated);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('Введите корректный email');
      return;
    }
    try {
      await emailApi.updateEmail(newEmail);
      setEmailStatus({ email: newEmail, verified: false });
      setEditingEmail(false);
      setNewEmail('');
      setShowCodeInput(false); // скрываем поле кода, если было
      setVerificationCode('');
      toast.success('Email обновлён! Теперь можно подтвердить.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  const handleSendVerification = async () => {
    if (!emailStatus.email || !user) return;
    setSendingCode(true);
    try {
      await emailApi.sendVerification(emailStatus.email, user.username);
      toast.success('Код отправлен на email');
      setShowCodeInput(true); // показываем поле для ввода кода
      setVerificationCode('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Введите 6-значный код');
      return;
    }
    setVerifying(true);
    try {
      await emailApi.verifyCode(emailStatus.email, verificationCode);
      setEmailStatus(prev => ({ ...prev, verified: true }));
      setShowCodeInput(false);
      setVerificationCode('');
      toast.success('Email подтверждён!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Неверный код');
    } finally {
      setVerifying(false);
    }
  };

  if (!user) return <div className="auth-page"><p>Войдите в систему</p></div>;

  const activeTickets = tickets.filter(t => t.status === 'scheduled' || t.status === 'boarding' || t.status === 'delayed');
  const historyTickets = tickets.filter(t => t.status === 'departed' || t.status === 'landed' || t.status === 'cancelled');
  const totalSpent = tickets.reduce((sum, t) => sum + (t.price || 0), 0);
  const currentBonuses = bonusInfo?.points || user.bonuses || 0;
  const pendingBonuses = bonusInfo?.pending_points || user.pending_bonuses || 0;
  const bonusPercent = Math.min(100, (currentBonuses / 1000) * 100);
  const nextLevel = currentBonuses < 1000 ? 'Серебряный (1000 бонусов)' : currentBonuses < 5000 ? 'Золотой (5000 бонусов)' : 'Платиновый (10000 бонусов)';

  if (loading) return <div className="profile-page"><p>Загрузка...</p></div>;

  return (
    <div className="profile-page animate-fade-in">
      <h2>Личный кабинет</h2>

      <div className="card profile-card">
        <div className="profile-header">
          <div className="profile-avatar">{user.username[0].toUpperCase()}</div>
          <div><h3>{user.full_name || user.username}</h3><p>@{user.username} · {user.role}</p></div>
        </div>
        <div className="profile-stats">
          <div className="stat"><div className="stat-value">{tickets.length}</div><div className="stat-label">Билетов</div></div>
          <div className="stat"><div className="stat-value">{totalSpent.toLocaleString()} ₽</div><div className="stat-label">Потрачено</div></div>
          <div className="stat"><div className="stat-value" style={{ color: 'var(--secondary)' }}>{currentBonuses}</div><div className="stat-label">Бонусов</div></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
        <h3>⭐ Бонусная программа</h3>
        <p>За каждую покупку начисляется 5% от стоимости билета. Бонусами можно оплатить до 50% цены.</p>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}><span>Доступно</span><span style={{ color: 'var(--primary)', fontWeight: 700 }}>{currentBonuses} бонусов</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}><span>На удержании</span><span style={{ color: 'var(--warning)', fontWeight: 700 }}>{pendingBonuses} бонусов</span></div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>Бонусы на удержании станут доступны после завершения рейса.</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}><span>Прогресс</span><span>{currentBonuses} / 1000</span></div>
        <div style={{ width: '100%', height: '8px', background: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${bonusPercent}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--secondary))', borderRadius: '4px' }} />
        </div>
        <p style={{ marginTop: '6px', fontSize: '0.85rem', color: 'var(--text-light)' }}>{nextLevel}</p>
      </div>

      {/* Email секция */}
      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <h3>Email уведомления</h3>
        {emailStatus.email ? (
          <div>
            <p><strong>{emailStatus.email}</strong> {emailStatus.verified ? <span style={{ color: 'var(--success)' }}>✓ Подтверждён</span> : <span style={{ color: 'var(--warning)' }}>⚠ Не подтверждён</span>}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Получайте уведомления о покупках, статусе рейсов и снижении цен.</p>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {!emailStatus.verified && (
                <button className="btn btn-outline btn-sm" onClick={handleSendVerification} disabled={sendingCode}>
                  {sendingCode ? 'Отправка...' : 'Подтвердить email'}
                </button>
              )}
              <button className="btn btn-outline btn-sm" onClick={() => { setEditingEmail(true); setNewEmail(emailStatus.email); }}>
                Изменить
              </button>
            </div>

            {/* Поле ввода кода подтверждения */}
            {showCodeInput && (
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="6-значный код"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{ width: '140px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                />
                <button className="btn btn-primary btn-sm" onClick={handleVerifyCode} disabled={verifying}>
                  {verifying ? 'Проверка...' : 'Подтвердить'}
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => setShowCodeInput(false)}>Отмена</button>
              </div>
            )}

            {/* Изменение email */}
            {editingEmail && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <input type="email" placeholder="your@email.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={{ flex: 1 }} />
                <button className="btn btn-primary btn-sm" onClick={handleUpdateEmail}>Сохранить</button>
                <button className="btn btn-outline btn-sm" onClick={() => setEditingEmail(false)}>Отмена</button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p>Привяжите email для получения уведомлений:</p>
            <ul><li>Подтверждение покупки</li><li>Изменение статуса рейса</li><li>Снижение цен</li></ul>
            {editingEmail ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="email" placeholder="your@email.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={{ flex: 1 }} />
                <button className="btn btn-primary btn-sm" onClick={handleUpdateEmail}>Сохранить</button>
                <button className="btn btn-outline btn-sm" onClick={() => setEditingEmail(false)}>Отмена</button>
              </div>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={() => setEditingEmail(true)}>Привязать Email</button>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button className={`btn ${activeTab === 'tickets' ? 'btn-primary' : 'btn-outline'} btn-sm`} onClick={() => setActiveTab('tickets')}>Активные ({activeTickets.length})</button>
        <button className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-outline'} btn-sm`} onClick={() => setActiveTab('history')}>История ({historyTickets.length})</button>
      </div>

      {activeTab === 'tickets' && (
        <div>
          {activeTickets.length === 0 && <p>Нет активных билетов</p>}
          {activeTickets.map(t => (
            <div key={t.id} className="card ticket-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', marginBottom: '10px' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>{t.flight_number}</div>
                <div>{t.origin} → {t.destination}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {formatMoscowDate(t.departure)} · {formatMoscowTime(t.departure)} – {formatMoscowTime(t.arrival)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: '600' }}>Место {t.seat_number}</div>
                <div style={{ color: 'var(--primary)', fontWeight: '600' }}>{t.price?.toLocaleString()} ₽</div>
                <button className="btn btn-outline btn-sm" onClick={() => generateTicketPDF({...t, passenger_name: user.full_name || user.username})} style={{ marginTop: '6px', width: '100%' }}>📄 PDF</button>
                <button className="btn btn-outline btn-sm" style={{ marginTop: '6px', color: 'var(--danger)', borderColor: 'var(--danger)', width: '100%' }} onClick={() => returnTicket(t.id)}>↩ Вернуть</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          {historyTickets.length === 0 && <p>Нет завершённых поездок</p>}
          {historyTickets.map(t => (
            <div key={t.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', marginBottom: '10px', opacity: 0.8 }}>
              <div>
                <div style={{ fontWeight: '600' }}>{t.flight_number}</div>
                <div>{t.origin} → {t.destination}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {formatMoscowDate(t.departure)} · Место {t.seat_number}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`status-badge ${t.status === 'landed' ? 'status-ok' : 'status-bad'}`}>{t.status === 'landed' ? 'Завершён' : t.status}</span>
                <div style={{ marginTop: '4px', fontWeight: '600' }}>{t.price?.toLocaleString()} ₽</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}