// ──────────────────────────────────────────
// Enums
// ──────────────────────────────────────────

export enum UserRole {
  ADMIN = 'ADMIN',
  BARBER = 'BARBER',
}

export enum AppointmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentGateway {
  MERCADOPAGO = 'MERCADOPAGO',
  STRIPE = 'STRIPE',
  CASH = 'CASH',
}

export enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

// ──────────────────────────────────────────
// Core DTOs (shared between frontend/backend)
// ──────────────────────────────────────────

export interface TenantDto {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string;
  phone?: string;
  address?: string;
  timezone: string;
  createdAt: string;
}

export interface UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string;
}

export interface BarberDto {
  id: string;
  userId: string;
  tenantId: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  isActive: boolean;
  services?: any[];
}

export interface ServiceDto {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
}

export interface AvailabilityDto {
  id: string;
  barberId: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
}

export interface SlotDto {
  startTime: string; // ISO datetime
  endTime: string;   // ISO datetime
  available: boolean;
}

export interface ClientDto {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
}

export interface AppointmentDto {
  id: string;
  tenantId: string;
  barberId: string;
  serviceId: string;
  clientId: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  notes?: string;
  barber?: BarberDto;
  service?: ServiceDto;
  client?: ClientDto;
  payment?: PaymentDto;
  createdAt: string;
}

export interface PaymentDto {
  id: string;
  appointmentId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  gateway: PaymentGateway;
  gatewayPaymentId?: string;
  createdAt: string;
}

// ──────────────────────────────────────────
// Request/Response shapes
// ──────────────────────────────────────────

export interface CreateAppointmentRequest {
  barberId: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  startTime: string; // ISO datetime
  notes?: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
}
