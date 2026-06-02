import jsPDF from 'jspdf';
import QRCode from 'qrcode';

export const generateTicketPDF = async (ticket) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
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
  doc.text('Электронный авиабилет', 105, 45, { align: 'center' });
  
  // Линия
  doc.setDrawColor(0, 102, 204);
  doc.setLineWidth(0.5);
  doc.line(20, 52, 190, 52);
  
  // Информация о билете
  const leftX = 25;
  let y = 65;
  const lineHeight = 8;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Пассажир:', leftX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(ticket.passenger_name || 'Не указан', leftX + 40, y);
  
  y += lineHeight;
  doc.setFont('helvetica', 'bold');
  doc.text('Рейс:', leftX, y);
  doc.text(ticket.flight_number, leftX + 40, y);
  
  y += lineHeight;
  doc.text('Маршрут:', leftX, y);
  doc.text(`${ticket.origin} → ${ticket.destination}`, leftX + 40, y);
  
  y += lineHeight;
  doc.text('Дата вылета:', leftX, y);
  doc.text(new Date(ticket.departure).toLocaleString('ru-RU'), leftX + 40, y);
  
  y += lineHeight;
  doc.text('Место:', leftX, y);
  doc.text(ticket.seat_number.toString(), leftX + 40, y);
  
  y += lineHeight;
  doc.text('Цена:', leftX, y);
  doc.text(`${ticket.price?.toLocaleString() || '—'} ₽`, leftX + 40, y);
  
  // QR-код
  const qrData = `SKYCONTROL-${ticket.id}-${ticket.flight_number}-${ticket.seat_number}`;
  const qrDataUrl = await QRCode.toDataURL(qrData, { width: 200 });
  doc.addImage(qrDataUrl, 'PNG', 140, 60, 40, 40);
  
  // Подвал
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Данный билет является электронным документом. Предъявите его при регистрации.', 105, 270, { align: 'center' });
  
  // Сохранить
  doc.save(`Билет_${ticket.flight_number}_${ticket.seat_number}.pdf`);
};