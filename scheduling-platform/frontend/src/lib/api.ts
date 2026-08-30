const API_BASE = '/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    }
    return this.token;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new ApiError(data.error || data.errors?.[0]?.message || 'Request failed', res.status, data);
    }

    return data as T;
  }

  // Auth
  async register(body: { business_name: string; name: string; email: string; password: string; phone?: string }) {
    return this.request<import('@/types').AuthResponse>('POST', '/auth/register', body);
  }

  async login(email: string, password: string) {
    return this.request<import('@/types').AuthResponse>('POST', '/auth/login', { email, password });
  }

  async me() {
    return this.request<{ user: import('@/types').User; business: import('@/types').Business }>('GET', '/auth/me');
  }

  // Users
  async listUsers() {
    return this.request<{ users: import('@/types').User[] }>('GET', '/users');
  }

  async getUser(id: string) {
    return this.request<{ user: import('@/types').User }>('GET', `/users/${id}`);
  }

  async createUser(body: { name: string; email: string; password: string; phone?: string; role?: string; is_provider?: boolean }) {
    return this.request<{ user: import('@/types').User }>('POST', '/users', body);
  }

  async updateUser(id: string, body: Partial<import('@/types').User>) {
    return this.request<{ user: import('@/types').User }>('PATCH', `/users/${id}`, body);
  }

  async deleteUser(id: string) {
    return this.request<{ message: string }>('DELETE', `/users/${id}`);
  }

  // Services
  async listServices(categoryId?: string) {
    const q = categoryId ? `?category_id=${categoryId}` : '';
    return this.request<{ services: import('@/types').Service[] }>('GET', `/services${q}`);
  }

  async getService(id: string) {
    return this.request<{ service: import('@/types').Service }>('GET', `/services/${id}`);
  }

  async createService(body: { name: string; duration_minutes: number; description?: string; category_id?: string; open_to_any_provider?: boolean }) {
    return this.request<{ service: import('@/types').Service }>('POST', '/services', body);
  }

  async updateService(id: string, body: Partial<import('@/types').Service>) {
    return this.request<{ service: import('@/types').Service }>('PATCH', `/services/${id}`, body);
  }

  async deleteService(id: string) {
    return this.request<{ message: string }>('DELETE', `/services/${id}`);
  }

  // Service Categories
  async listCategories() {
    return this.request<{ categories: import('@/types').ServiceCategory[] }>('GET', '/services/categories');
  }

  async createCategory(body: { name: string; description?: string }) {
    return this.request<{ category: import('@/types').ServiceCategory }>('POST', '/services/categories', body);
  }

  // Clients
  async listClients(search?: string) {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request<{ clients: import('@/types').Client[] }>('GET', `/clients${q}`);
  }

  async getClient(id: string) {
    return this.request<{ client: import('@/types').Client; appointments: unknown[] }>('GET', `/clients/${id}`);
  }

  async createClient(body: { name: string; phone: string; email?: string }) {
    return this.request<{ client: import('@/types').Client }>('POST', '/clients', body);
  }

  async updateClient(id: string, body: Partial<import('@/types').Client>) {
    return this.request<{ client: import('@/types').Client }>('PATCH', `/clients/${id}`, body);
  }

  async deleteClient(id: string) {
    return this.request<{ message: string }>('DELETE', `/clients/${id}`);
  }

  // Visits
  async listVisits(params?: { from?: string; to?: string; status?: string; provider_id?: string; client_id?: string }) {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    if (params?.status) q.set('status', params.status);
    if (params?.provider_id) q.set('provider_id', params.provider_id);
    if (params?.client_id) q.set('client_id', params.client_id);
    const qs = q.toString();
    return this.request<{ visits: import('@/types').Visit[] }>('GET', `/visits${qs ? `?${qs}` : ''}`);
  }

  async getVisit(id: string) {
    return this.request<{ visit: import('@/types').Visit }>('GET', `/visits/${id}`);
  }

  async createVisit(body: {
    client_id: string;
    booking_source: string;
    start_time: string;
    end_time: string;
    notes?: string;
    segments: { provider_id: string; service_id: string; start_time: string; end_time: string; duration_minutes?: number; notes?: string }[];
  }) {
    return this.request<{ visit: import('@/types').Visit; segments: import('@/types').VisitSegment[] }>('POST', '/visits', body);
  }

  async updateVisit(id: string, body: Partial<import('@/types').Visit>) {
    return this.request<{ visit: import('@/types').Visit }>('PATCH', `/visits/${id}`, body);
  }

  async updateVisitStatus(id: string, status: string, cancellation_reason?: string) {
    return this.request<{ visit: import('@/types').Visit }>('PATCH', `/visits/${id}/status`, { status, cancellation_reason });
  }

  // Availability
  async getAvailability(providerId: string) {
    return this.request<{ availability: import('@/types').ProviderAvailability[] }>('GET', `/availability/${providerId}`);
  }

  async setAvailability(providerId: string, schedule: { day_of_week: number; start_time: string; end_time: string }[]) {
    return this.request<{ availability: import('@/types').ProviderAvailability[] }>('PUT', `/availability/${providerId}`, { schedule });
  }

  async listClosures() {
    return this.request<{ closures: import('@/types').BusinessClosure[] }>('GET', '/availability/closures/list');
  }

  async createClosure(body: { closure_date: string; reason?: string }) {
    return this.request<{ closure: import('@/types').BusinessClosure }>('POST', '/availability/closures', body);
  }

  // Series (recurring)
  async listSeries() {
    return this.request<{ series: (import('@/types').VisitSeries & { client_name: string; occurrence_total: number; occurrence_with_visit: number })[] }>('GET', '/series');
  }

  async getSeries(id: string) {
    return this.request<{ series: import('@/types').VisitSeries; occurrences: import('@/types').SeriesOccurrence[]; versions: import('@/types').SeriesVersion[] }>('GET', `/series/${id}`);
  }

  async createSeries(body: {
    client_id: string; booking_source: string; recurrence_type: string;
    recurrence_config: any; start_date: string; end_date?: string;
    max_occurrences?: number; start_time?: string; notes?: string;
    segments: { provider_id: string; service_id: string; duration_minutes: number }[];
  }) {
    return this.request<{ series: import('@/types').VisitSeries; occurrence_count: number }>('POST', '/series', body);
  }

  async updateSeries(id: string, body: { is_active?: boolean; end_date?: string }) {
    return this.request<{ series: import('@/types').VisitSeries }>('PATCH', `/series/${id}`, body);
  }

  async editSeriesFuture(id: string, body: { occurrence_number: number; new_segments: any[]; new_meta?: any }) {
    return this.request<{ version: import('@/types').SeriesVersion; new_version_number: number }>('PATCH', `/series/${id}/edit-future`, body);
  }

  // Attention
  async listAttention(params?: { severity?: string; status?: string; issue_type?: string }) {
    const q = new URLSearchParams();
    if (params?.severity) q.set('severity', params.severity);
    if (params?.status) q.set('status', params.status);
    if (params?.issue_type) q.set('issue_type', params.issue_type);
    const qs = q.toString();
    return this.request<{ items: import('@/types').AttentionItem[] }>('GET', `/attention${qs ? `?${qs}` : ''}`);
  }

  async getAttentionCounts() {
    return this.request<{ urgent: number; informational: number; total: number }>('GET', '/attention/counts');
  }

  async updateAttention(id: string, body: { severity?: string; status?: string; resolution_notes?: string }) {
    return this.request<{ item: import('@/types').AttentionItem }>('PATCH', `/attention/${id}`, body);
  }

  // Reports
  async getDashboard() {
    return this.request<any>('GET', '/reports/dashboard');
  }

  async getProviderReports(from?: string, to?: string) {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return this.request<any>('GET', `/reports/providers${qs ? `?${qs}` : ''}`);
  }

  async getBookingSourceReports(from?: string, to?: string) {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return this.request<any>('GET', `/reports/booking-sources${qs ? `?${qs}` : ''}`);
  }

  // Audit
  async listAuditLog(params?: { entity_type?: string; action?: string }) {
    const q = new URLSearchParams();
    if (params?.entity_type) q.set('entity_type', params.entity_type);
    if (params?.action) q.set('action', params.action);
    const qs = q.toString();
    return this.request<{ entries: any[] }>('GET', `/audit${qs ? `?${qs}` : ''}`);
  }
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const api = new ApiClient();
