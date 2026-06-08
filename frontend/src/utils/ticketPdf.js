import jsPDF from 'jspdf';
import QRCode from 'qrcode';

// Карта русских названий -> английские
const cityMap = {
  'Москва': 'Moscow',
  'Санкт-Петербург': 'Saint Petersburg',
  'Новосибирск': 'Novosibirsk',
  'Екатеринбург': 'Yekaterinburg',
  'Казань': 'Kazan',
  'Сочи': 'Sochi',
  'Владивосток': 'Vladivostok',
  'Калининград': 'Kaliningrad',
  'Мурманск': 'Murmansk',
  'Хабаровск': 'Khabarovsk',
  'Якутск': 'Yakutsk',
  'Махачкала': 'Makhachkala',
  'Симферополь': 'Simferopol',
  'Челябинск': 'Chelyabinsk',
  'Тюмень': 'Tyumen',
  'Анталья': 'Antalya',
  'Стамбул': 'Istanbul',
  'Дубай': 'Dubai',
  'Гоа': 'Goa',
  'Минск': 'Minsk',
  'Краснодар': 'Krasnodar',
  'Воронеж': 'Voronezh',
  'Пермь': 'Perm',
  'Уфа': 'Ufa',
  'Омск': 'Omsk',
};

// Простая транслитерация русского имени
const transliterate = (text) => {
  const map = {
    'а': 'a','б': 'b','в': 'v','г': 'g','д': 'd','е': 'e','ё': 'yo','ж': 'zh','з': 'z',
    'и': 'i','й': 'y','к': 'k','л': 'l','м': 'm','н': 'n','о': 'o','п': 'p','р': 'r',
    'с': 's','т': 't','у': 'u','ф': 'f','х': 'kh','ц': 'ts','ч': 'ch','ш': 'sh','щ': 'shch',
    'ъ': '','ы': 'y','ь': '','э': 'e','ю': 'yu','я': 'ya',
    'А': 'A','Б': 'B','В': 'V','Г': 'G','Д': 'D','Е': 'E','Ё': 'Yo','Ж': 'Zh','З': 'Z',
    'И': 'I','Й': 'Y','К': 'K','Л': 'L','М': 'M','Н': 'N','О': 'O','П': 'P','Р': 'R',
    'С': 'S','Т': 'T','У': 'U','Ф': 'F','Х': 'Kh','Ц': 'Ts','Ч': 'Ch','Ш': 'Sh','Щ': 'Shch',
    'Ъ': '','Ы': 'Y','Ь': '','Э': 'E','Ю': 'Yu','Я': 'Ya'
  };
  return text.split('').map(ch => map[ch] || ch).join('');
};

export const generateTicketPDF = async (ticket) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Англифицируем данные
  const passengerName = transliterate(ticket.passenger_name || 'Unknown');
  const originEn = cityMap[ticket.origin] || ticket.origin;
  const destEn = cityMap[ticket.destination] || ticket.destination;
  const departureStr = new Date(ticket.departure).toLocaleString('en-US');

  // Фон
  doc.setFillColor(246, 249, 254);
  doc.rect(0, 0, 210, 297, 'F');

  // Верхняя плашка
  doc.setFillColor(0, 102, 204);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('SKYCONTROL', 105, 18, { align: 'center' });

  // Заголовок
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(16);
  doc.text('Electronic Ticket', 105, 45, { align: 'center' });

  // Линия
  doc.setDrawColor(0, 102, 204);
  doc.setLineWidth(0.5);
  doc.line(20, 52, 190, 52);

  const leftX = 25;
  let y = 65;
  const lineHeight = 8;
  doc.setFontSize(11);

  const addRow = (label, value) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, leftX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, leftX + 50, y);
    y += lineHeight;
  };

  addRow('Passenger:', passengerName);
  addRow('Flight:', ticket.flight_number);
  addRow('Route:', `${originEn} – ${destEn}`);
  addRow('Departure:', departureStr);
  addRow('Seat:', ticket.seat_number.toString());
  addRow('Price:', `${ticket.price?.toLocaleString() || '—'} RUB`);

  // QR-код
  const qrData = `SKYCONTROL-${ticket.id}-${ticket.flight_number}-${ticket.seat_number}`;
  const qrDataUrl = await QRCode.toDataURL(qrData, { width: 200 });
  doc.addImage(qrDataUrl, 'PNG', 140, 60, 40, 40);

  // Подвал
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('This is an electronic ticket. Present it at check-in.', 105, 270, { align: 'center' });

  doc.save(`Ticket_${ticket.flight_number}_${ticket.seat_number}.pdf`);
};