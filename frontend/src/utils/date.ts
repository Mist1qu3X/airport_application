// src/utils/date.ts

/**
 * Преобразует ISO-строку (UTC) в читаемую дату/время по Москве (ДД.ММ.ГГГГ, ЧЧ:ММ)
 */
export function toMoscowTime(iso: string | null): string {
  if (!iso) return '—';
  // Убеждаемся, что строка интерпретируется как UTC
  const normalized = iso.endsWith('Z') ? iso : iso + 'Z';
  const date = new Date(normalized);
  return date.toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Только дата по Москве (напр. 11 июн. 2026 г.)
 */
export function formatMoscowDate(iso: string | null): string {
  if (!iso) return '';
  const normalized = iso.endsWith('Z') ? iso : iso + 'Z';
  return new Date(normalized).toLocaleDateString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Только время по Москве (ЧЧ:ММ)
 */
export function formatMoscowTime(iso: string | null): string {
  if (!iso) return '';
  const normalized = iso.endsWith('Z') ? iso : iso + 'Z';
  return new Date(normalized).toLocaleTimeString('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Конвертирует локальное московское время (из input type="datetime-local")
 * в UTC-строку для отправки на сервер.
 * @param mskDateTimeLocal – строка вида "YYYY-MM-DDTHH:MM" (московское время)
 * @returns ISO-строка в UTC
 */
export function toUtcFromMoscow(mskDateTimeLocal: string): string {
  if (!mskDateTimeLocal) return '';
  // Создаём дату в московском часовом поясе (UTC+3 без перехода на летнее время, для упрощения)
  const mskDate = new Date(mskDateTimeLocal + ':00+03:00');
  return mskDate.toISOString();
}

/**
 * Преобразует UTC-ISO строку в локальное московское время для input type="datetime-local"
 * @returns строка в формате "YYYY-MM-DDTHH:MM"
 */
export function toMoscowDateTimeLocal(utcIso: string | null): string {
  if (!utcIso) return '';
  const normalized = utcIso.endsWith('Z') ? utcIso : utcIso + 'Z';
  const date = new Date(normalized);
  // Используем sv-SE локаль, которая даёт формат YYYY-MM-DD HH:MM:SS
  const mskString = date.toLocaleString('sv-SE', {
    timeZone: 'Europe/Moscow',
    hour12: false,
  });
  // Обрезаем секунды и заменяем пробел на 'T'
  return mskString.replace(' ', 'T').slice(0, 16);
}