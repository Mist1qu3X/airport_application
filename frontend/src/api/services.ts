// services.ts
import api, { buildQuery } from './client';
import type {
  UserCreate,
  Token,
  UserProfile,
  Flight,
  FlightCreate,
  FlightUpdate,
  FlightSearchParams,
  CalendarPricesResponse,
  PriceCalendarParams,
  PurchaseRequest,
  PurchaseResponse,
  TicketInfo,
  DashboardMetrics,
  BonusInfo,
  Promotion,
  EmailStatus,
  UserShort,
  ImportResponse,
  StatusUpdateResponse,
  MessageResponse,
} from './types';

// ==========================================
// AUTH
// ==========================================

export const authApi = {
  register: (data: UserCreate) =>
    api.post<Token>('/api/register', data).then(res => res.data),

  login: (username: string, password: string) =>
    api.post<Token>(`/api/login?username=${username}&password=${password}`).then(res => res.data),

  getProfile: () =>
    api.get<UserProfile>('/api/profile').then(res => res.data),

  updateProfile: (full_name: string) =>
    api.put(`/api/profile?full_name=${full_name}`).then(res => res.data),
};

// ==========================================
// FLIGHTS
// ==========================================

export const flightsApi = {
  getAll: () =>
    api.get<Flight[]>('/api/flights/all').then(res => res.data),

  search: (params: FlightSearchParams) =>
    api.get<Flight[]>(`/api/flights${buildQuery(params)}`).then(res => res.data),

  getById: (id: number) =>
    api.get<Flight>(`/api/flights/${id}`).then(res => res.data),

  create: (data: FlightCreate) =>
    api.post<Flight>('/api/flights', data).then(res => res.data),

  update: (id: number, data: FlightUpdate) =>
    api.put<Flight>(`/api/flights/${id}`, data).then(res => res.data),

  delete: (id: number) =>
    api.delete<MessageResponse>(`/api/flights/${id}`).then(res => res.data),

  // Статусы
  updateStatus: (id: number, status: string) =>
    api.put<MessageResponse>(`/api/flights/${id}/status?status=${status}`).then(res => res.data),

  delay: (id: number, minutes: number) =>
    api.put<MessageResponse>(`/api/flights/${id}/delay?minutes=${minutes}`).then(res => res.data),

  complete: (id: number) =>
    api.post<MessageResponse>(`/api/flights/${id}/complete`).then(res => res.data),

  autoUpdateStatuses: () =>
    api.post<StatusUpdateResponse>('/api/flights/auto-update-statuses').then(res => res.data),

  // Импорт
  importTestFlights: () =>
    api.post<ImportResponse>('/api/import/flights').then(res => res.data),
};

// ==========================================
// PRICE CALENDAR
// ==========================================

export const pricesApi = {
  getCalendar: (params: PriceCalendarParams) =>
    api.get<CalendarPricesResponse>(`/api/flights/prices${buildQuery(params)}`).then(res => res.data),
};

// ==========================================
// TICKETS
// ==========================================

export const ticketsApi = {
  purchase: (data: PurchaseRequest) =>
    api.post<PurchaseResponse>('/api/tickets/purchase', data).then(res => res.data),

  getMyTickets: () =>
    api.get<TicketInfo[]>('/api/tickets/my').then(res => res.data),

  returnTicket: (id: number) =>
    api.delete<MessageResponse>(`/api/tickets/${id}`).then(res => res.data),
};

// ==========================================
// DASHBOARD & REPORTS
// ==========================================

export const dashboardApi = {
  getMetrics: () =>
    api.get<DashboardMetrics>('/api/reports/dashboard').then(res => res.data),
};

// ==========================================
// BONUSES
// ==========================================

export const bonusesApi = {
  getInfo: (userId: number) =>
    api.get<BonusInfo>(`/api/bonus/${userId}`).then(res => res.data),
};

// ==========================================
// PROMOTIONS
// ==========================================

export const promotionsApi = {
  getAll: () =>
    api.get<Promotion[]>('/api/promotions').then(res => res.data),
};

// ==========================================
// EMAIL
// ==========================================

export const emailApi = {
  sendVerification: (email: string, username: string) =>
    api.post<MessageResponse>(`/api/email/send-verification?email=${email}&username=${username}`).then(res => res.data),

  verifyCode: (email: string, code: string) =>
    api.post<MessageResponse>(`/api/email/verify-code?email=${email}&code=${code}`).then(res => res.data),

  getStatus: () =>
    api.get<EmailStatus>('/api/email/status').then(res => res.data),

  updateEmail: (email: string) =>
    api.put(`/api/profile/email?email=${email}`).then(res => res.data),
};

// ==========================================
// ADMIN
// ==========================================

export const adminApi = {
  getUsers: () =>
    api.get<UserShort[]>('/api/users').then(res => res.data),

  changeRole: (userId: number, role: string) =>
    api.put<MessageResponse>(`/api/users/${userId}/role?role=${role}`).then(res => res.data),
};