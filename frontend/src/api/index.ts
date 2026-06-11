// src/api/index.ts

// Ре-экспорт клиента
export { default as api } from './client';

// Ре-экспорт всех сервисов
export {
  authApi,
  flightsApi,
  pricesApi,
  ticketsApi,
  dashboardApi,
  bonusesApi,
  promotionsApi,
  emailApi,
  adminApi,
} from './services';

// Ре-экспорт утилит
export { buildQuery } from './client';

// Ре-экспорт всех типов
export type {
  UserCreate,
  Token,
  UserProfile,
  Flight,
  FlightStatus,
  FlightCreate,
  FlightUpdate,
  FlightSearchParams,
  Stopover,
  CalendarPriceDay,
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
  SuccessResponse,
} from './types';