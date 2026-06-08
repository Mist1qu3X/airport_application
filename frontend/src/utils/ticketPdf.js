import jsPDF from 'jspdf';
import QRCode from 'qrcode';

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
  'Краснодар': 'Krasnodar',
  'Воронеж': 'Voronezh',
  'Пермь': 'Perm',
  'Уфа': 'Ufa',
  'Омск': 'Omsk',
  'Анталья': 'Antalya',
  'Стамбул': 'Istanbul',
  'Дубай': 'Dubai',
  'Гоа': 'Goa',
  'Минск': 'Minsk',
  'Рига': 'Riga',
  'Алматы': 'Almaty',
  'Баку': 'Baku',
  'Ереван': 'Yerevan',
};

const transliterate = (text) => {
  if (!text) return 'Passenger';
  const map = {
    'а': 'a','б': 'b','в': 'v','г': 'g','д': 'd','е': 'e','ё': 'yo','ж': 'zh','з': 'z',
    'и': 'i','й': 'y','к': 'k','л': 'l','м': 'm','н': 'n','о': 'o','п': 'p','р': 'r',
    'с': 's','т': 't','у': 'u','ф': 'f','х': 'kh','ц': 'ts','ч': 'ch','ш': 'sh','щ': 'shch',
    'ъ': '','ы': 'y','ь': '','э': 'e','ю': 'yu','я': 'ya',
    'А': 'A','Б': 'B','В': 'V','Г': 'G','Д': 'D','Е': 'E','Ё': 'Yo','Ж': 'Zh','З': 'Z',
    'И': 'I','Й': 'Y','К': 'K','Л': 'L','М': 'M','Н': 'N','О': 'O','П': 'P','Р': 'R',
    'С': 'S','Т': 'T','У': 'U','Ф': 'F','Х': 'Kh','Ц': 'Ts','Ч': 'Ch','Ш': 'Sh','Щ': 'Shch',
    'Ъ': '','Ы': 'Y','Ь': '','Э': 'E','Ю': 'Yu','Я': 'Ya', ' ': ' '
  };
  return text.split('').map(ch => map[ch] || ch).join('');
};

const formatSeat = (num) => {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const row = Math.ceil(num / 6);
  const col = (num - 1) % 6;
  return `${row}${letters[col]}`;
};

const gates = ['A1', 'A3', 'A5', 'B2', 'B4', 'B7', 'C1', 'C3', 'C6', 'D2', 'D5', 'D8'];
const randomGate = () => gates[Math.floor(Math.random() * gates.length)];

const terminals = ['Terminal A', 'Terminal B', 'Terminal C', 'Terminal D'];
const randomTerminal = () => terminals[Math.floor(Math.random() * terminals.length)];

export const generateTicketPDF = async (ticket) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  const passenger = transliterate(ticket.passenger_name || 'Passenger').toUpperCase();
  const origin = cityMap[ticket.origin] || ticket.origin;
  const destination = cityMap[ticket.destination] || ticket.destination;
  const dep = new Date(ticket.departure);
  const arr = new Date(ticket.arrival);
  const dateStr = dep.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const depTime = dep.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const arrTime = arr.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const seat = formatSeat(ticket.seat_number);
  const durMs = arr - dep;
  const durH = Math.floor(durMs / 3600000);
  const durM = Math.floor((durMs % 3600000) / 60000);
  const price = (ticket.price || 0).toLocaleString('en-US');
  const gate = randomGate();
  const terminal = randomTerminal();
  const ticketId = `SC-${String(ticket.id).padStart(8, '0')}`;
  const bookingRef = `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(Math.random() * 9000 + 1000)}`;
  const seatClass = Math.ceil(ticket.seat_number / 6) <= 4 ? 'BUSINESS' : 'ECONOMY';

  // ====== PAGE BACKGROUND ======
  doc.setFillColor(235, 240, 245);
  doc.rect(0, 0, 210, 297, 'F');

  // ====== TICKET BODY ======
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(10, 10, 184, 271, 5, 5, 'F');

  // ====== HEADER ======
  doc.setFillColor(0, 60, 120);
  doc.rect(10, 10, 184, 32, 'F');
  
  doc.setFillColor(255, 140, 0);
  doc.rect(10, 10, 184, 3, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('SKYCONTROL', 22, 32);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('BOARDING PASS', 160, 32);

  // ====== TICKET ID ======
  doc.setFillColor(245, 248, 252);
  doc.rect(10, 42, 184, 8, 'F');
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`TICKET: ${ticketId}`, 18, 47);
  doc.text(`BOOKING REF: ${bookingRef}`, 105, 47);
  doc.text(`CLASS: ${seatClass}`, 170, 47);

  // ====== LINE ======
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.line(15, 53, 189, 53);

  // ====== PASSENGER ======
  let y = 60;
  doc.setFillColor(248, 250, 253);
  doc.roundedRect(15, y, 174, 20, 3, 3, 'F');
  
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.text('PASSENGER', 20, y + 7);
  
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(passenger, 20, y + 17);
  
  y += 25;

  // ====== ROW 1: FLIGHT & DATE ======
  doc.setFillColor(248, 250, 253);
  doc.roundedRect(15, y, 85, 22, 3, 3, 'F');
  doc.roundedRect(104, y, 85, 22, 3, 3, 'F');
  
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('FLIGHT', 20, y + 7);
  doc.text('DATE', 109, y + 7);
  
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(ticket.flight_number, 20, y + 18);
  
  doc.setFontSize(9);
  doc.text(`${dateStr}`, 109, y + 15);
  doc.text(`${depTime} – ${arrTime}`, 109, y + 20);
  
  y += 27;

  // ====== ROW 2: FROM | TO | SEAT ======
  const colW = 54;
  doc.setFillColor(248, 250, 253);
  doc.roundedRect(15, y, colW, 26, 3, 3, 'F');
  doc.roundedRect(15 + colW + 3, y, colW, 26, 3, 3, 'F');
  doc.roundedRect(15 + (colW + 3) * 2, y, colW + 9, 26, 3, 3, 'F');
  
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('FROM', 20, y + 7);
  doc.text('TO', 20 + colW + 3, y + 7);
  doc.text('SEAT', 20 + (colW + 3) * 2, y + 7);
  
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(origin, 20, y + 21);
  doc.text(destination, 20 + colW + 3, y + 21);
  doc.text(seat, 20 + (colW + 3) * 2, y + 21);
  
  y += 31;

  // ====== ROW 3: GATE | TERMINAL | DURATION | PRICE ======
  const colW4 = 42;
  doc.setFillColor(248, 250, 253);
  doc.roundedRect(15, y, colW4, 22, 3, 3, 'F');
  doc.roundedRect(15 + colW4 + 3, y, colW4, 22, 3, 3, 'F');
  doc.roundedRect(15 + (colW4 + 3) * 2, y, colW4, 22, 3, 3, 'F');
  doc.roundedRect(15 + (colW4 + 3) * 3, y, colW4 - 6, 22, 3, 3, 'F');
  
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('GATE', 20, y + 7);
  doc.text('TERMINAL', 20 + colW4 + 3, y + 7);
  doc.text('DURATION', 20 + (colW4 + 3) * 2, y + 7);
  doc.text('PRICE', 20 + (colW4 + 3) * 3, y + 7);
  
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(gate, 20, y + 17);
  doc.text(terminal, 20 + colW4 + 3, y + 17);
  doc.text(`${durH}h ${durM}m`, 20 + (colW4 + 3) * 2, y + 17);
  doc.text(`${price} RUB`, 20 + (colW4 + 3) * 3, y + 17);
  
  y += 28;

  // ====== ADDITIONAL INFO (now with more space) ======
  doc.setDrawColor(220, 225, 230);
  doc.setLineWidth(0.3);
  doc.line(18, y, 186, y);
  y += 7;

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  
  doc.text('CHECK-IN:', 20, y);
  doc.text('Opens 24h before departure. Closes 40 min before departure.', 48, y);
  
  y += 4;
  doc.text('BAGGAGE:', 20, y);
  doc.text('1 pc up to 23 kg included. Hand luggage: 1 pc up to 10 kg.', 48, y);
  
  y += 4;
  doc.text('DOCUMENTS:', 20, y);
  doc.text('Valid passport or ID required. Visa may be required for intl flights.', 48, y);

  // ====== QR CODE (below text, aligned right) ======
  const qrData = `SKYCONTROL|${ticketId}|${ticket.flight_number}|${seat}|${passenger}|${bookingRef}`;
  const qrDataUrl = await QRCode.toDataURL(qrData, { width: 200, margin: 1, color: { dark: '#003366', light: '#FFFFFF' } });
  doc.addImage(qrDataUrl, 'PNG', 140, y + 10, 45, 45);
  
  // QR label
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(6);
  doc.text('SCAN FOR CHECK-IN', 162, y + 57);

  // ====== FOOTER ======
  doc.setFillColor(0, 60, 120);
  doc.rect(10, 272, 184, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6.5);
  doc.text('SkyControl © 2026 | www.skycontrol.com | support@skycontrol.com | Tel: +7 (800) 123-45-67', 102, 278, { align: 'center' });

  // Save
  doc.save(`Ticket_${ticket.flight_number}_${seat}.pdf`);
};