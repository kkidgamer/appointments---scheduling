// --- User ---
export type UserRole = 'owner' | 'admin' | 'staff';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  is_provider: boolean;
  is_active: boolean;
  created_at: string;
  qualifications?: Service[];
}

// --- Business ---
export interface Business {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  timezone: string;
  standard_hours: Record<string, { start: string; end: string } | null>;
  is_active: boolean;
}

// --- Service ---
export interface Service {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  is_active: boolean;
  open_to_any_provider: boolean;
  category_id?: string;
  category_name?: string;
}

// --- Service Category ---
export interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  sort_order: number;
}

// --- Client ---
export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  no_show_count: number;
  cancellation_count: number;
  is_flagged: boolean;
  created_at: string;
}

// --- Visit ---
export type VisitStatus = 'booked' | 'arrived' | 'completed' | 'no_show' | 'cancelled';
export type BookingSource = 'walk_in' | 'whatsapp' | 'instagram' | 'phone' | 'contact_form' | 'other';

export interface VisitSegment {
  id: string;
  visit_id: string;
  provider_id: string;
  provider_name: string;
  service_id: string;
  service_name: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: string;
  notes?: string;
}

export interface Visit {
  id: string;
  client_id: string;
  client_name: string;
  client_phone: string;
  booked_by: string;
  booked_by_name?: string;
  booking_source: BookingSource;
  start_time: string;
  end_time: string;
  status: VisitStatus;
  notes?: string;
  cancellation_reason?: string;
  is_locked: boolean;
  created_at: string;
  segments: VisitSegment[];
}

// --- Provider Availability ---
export interface ProviderAvailability {
  id: string;
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

// --- Provider Exception ---
export interface ProviderException {
  id: string;
  user_id: string;
  exception_date: string;
  is_off: boolean;
  start_time?: string;
  end_time?: string;
  notes?: string;
}

// --- Business Closure ---
export interface BusinessClosure {
  id: string;
  closure_date: string;
  start_time?: string;
  end_time?: string;
  reason?: string;
}

// --- Auth ---
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_provider: boolean;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
  business: { id: string; name: string };
}

// --- Recurring Series ---
export type RecurrenceType = 'weekly' | 'every_n_weeks' | 'monthly_date' | 'monthly_weekday';

export interface VisitSeries {
  id: string;
  business_id: string;
  client_id: string;
  client_name?: string;
  client_phone?: string;
  booked_by: string;
  booking_source: BookingSource;
  recurrence_type: RecurrenceType;
  recurrence_config: any;
  start_date: string;
  end_date?: string;
  max_occurrences?: number;
  is_active: boolean;
  occurrence_total?: number;
  occurrence_with_visit?: number;
  created_at: string;
}

export interface SeriesVersion {
  id: string;
  series_id: string;
  version_number: number;
  template_segments: { provider_id: string; service_id: string; duration_minutes: number }[];
  template_meta: any;
}

export interface SeriesOccurrence {
  id: string;
  series_id: string;
  series_version_id: string;
  occurrence_number: number;
  occurrence_date: string;
  visit_id?: string;
  visit_status?: string;
  visit_start_time?: string;
  is_exception: boolean;
  exception_data?: any;
}

// --- Attention ---
export type AttentionSeverity = 'urgent' | 'informational';
export type AttentionStatus = 'open' | 'resolved' | 'dismissed';

export interface AttentionItem {
  id: string;
  business_id: string;
  severity: AttentionSeverity;
  status: AttentionStatus;
  issue_type: string;
  title: string;
  description?: string;
  visit_id?: string;
  series_id?: string;
  provider_id?: string;
  provider_name?: string;
  client_id?: string;
  client_name?: string;
  visit_start_time?: string;
  resolution_notes?: string;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
}
