// ──────────────────────────────────────────
// Core DTOs (shared between frontend/backend)
// ──────────────────────────────────────────

export interface BarberDto {
  id: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
  isActive: boolean;
  services?: ServiceDto[];
}

export interface ServiceDto {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  barberId: string;
}

export interface BookingDto {
  id: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  startTime: string;
  endTime: string;
  barberId: string;
  serviceId: string;
  notes?: string;
  barber?: BarberDto;
  service?: ServiceDto;
  createdAt: string;
}

export interface SlotDto {
  time: string; // "HH:mm"
  available: boolean;
}

export interface CreateBookingRequest {
  barberId: string;
  serviceId: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  startTime: string; // ISO datetime
  notes?: string;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
}
