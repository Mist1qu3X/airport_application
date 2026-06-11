// types.ts

// =========================
// AUTH
// =========================

export interface UserCreate {
  username: string;
  password: string;
  full_name?: string;
  email?: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface UserProfile {
  id: number;
  username: string;
  role: 'user' | 'admin' | 'developer';
  full_name: string;
  email: string;
  email_verified: boolean;
  bonuses: number;
  pending_bonuses: number;
}

// =========================
// FLIGHTS
// =========================

export interface Stopover {
  airport: string;
  arrival: string;
  departure: string;
}

export interface Flight {
  id: number;
  flight_number: string;
  airline: string;
  origin: string;
  destination: string;
  scheduled_departure: string;
  scheduled_arrival: string;
  estimated_departure?: string | null;
  estimated_arrival?: string | null;
  actual_departure?: string | null;
  actual_arrival?: string | null;
  status: FlightStatus;
  price: number;
  capacity: number;
  free_seats: number;
  sold_seats: number[];
  stopovers: Stopover[];
}

export type FlightStatus = 
  | 'scheduled' 
  | 'boarding' 
  | 'delayed' 
  | 'departed' 
  | 'landed' 
  | 'cancelled';

export interface FlightCreate {
  flight_number: string;
  airline: string;
  origin: string;
  destination: string;
  scheduled_departure: string;
  scheduled_arrival: string;
  status?: FlightStatus;
  capacity?: number;
  price?: number;
  stopovers?: Stopover[];
}

export interface FlightUpdate {
  flight_number?: string;
  airline?: string;
  origin?: string;
  destination?: string;
  scheduled_departure?: string;
  scheduled_arrival?: string;
  estimated_departure?: string | null;
  estimated_arrival?: string | null;
  status?: FlightStatus;
  capacity?: number;
  price?: number;
  stopovers?: Stopover[];
}

export interface FlightSearchParams {
  origin?: string;
  destination?: string;
  date?: string;
  status?: FlightStatus;
}

// =========================
// PRICE CALENDAR
// =========================

export interface CalendarPriceDay {
  price: number;
  min_price: number;
  flights_count: number;
}

export interface CalendarPricesResponse {
  prices: Record<string, CalendarPriceDay>;
}

export interface PriceCalendarParams {
  origin: string;
  destination: string;
  year: number;
  month: number;
}

// =========================
// TICKETS
// =========================

export interface PurchaseRequest {
  flight_id: number;
  seat_number: number;
  use_bonuses?: number;
}

export interface PurchaseResponse {
  msg: string;
  ticket_id: number;
  bonuses_earned: number;
}

export interface TicketInfo {
  id: number;
  flight_id: number;
  flight_number: string;
  origin: string;
  destination: string;
  departure: string | null;
  arrival: string | null;
  status: FlightStatus;
  seat_number: number;
  purchase_date: string | null;
  price: number;
}

// =========================
// DASHBOARD
// =========================

export interface DashboardMetrics {
  total_flights: number;
  delayed_flights: number;
  punctuality: number;
  avg_delay_minutes: number;
  flights_by_hour: Array<{ hour: number; count: number }>;
  top_route: {
    origin: string;
    destination: string;
    flights: number;
  };
}

// =========================
// BONUSES
// =========================

export interface BonusInfo {
  points: number;
  pending_points: number;
  tickets_count: number;
}

// =========================
// PROMOTIONS
// =========================

export interface Promotion {
  id: number;
  title: string;
  description: string;
  discount: number;
  active: boolean;
}

// =========================
// EMAIL
// =========================

export interface EmailStatus {
  email: string;
  verified: boolean;
}

export interface MessageResponse {
  msg: string;
}

export interface SuccessResponse {
  success: boolean;
  message?: string;
}

// =========================
// ADMIN
// =========================

export interface UserShort {
  id: number;
  username: string;
  role: 'user' | 'admin' | 'developer';
  full_name: string;
  email: string;
  bonuses: number;
  pending_bonuses: number;
}

export interface ImportResponse {
  msg: string;
}

export interface StatusUpdateResponse {
  msg: string;
  updated: number;
}