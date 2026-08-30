const API_BASE = '/api';

class ApiClient {
  constructor() {
    this.token = null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken() {
    if (!this.token) {
      this.token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    }
    return this.token;
  }

  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
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

    return data;
  }

  // Auth
  async register(body) {
    return this.request('POST', '/auth/register', body);
  }

  async login(email, password) {
    return this.request('POST', '/auth/login', { email, password });
  }

  async me() {
    return this.request('GET', '/auth/me');
  }

  // Users
  async listUsers() {
    return this.request('GET', '/users');
  }

  async getUser(id) {
    return this.request('GET', `/users/${id}`);
  }

  async createUser(body) {
    return this.request('POST', '/users', body);
  }

  async updateUser(id, body) {
    return this.request('PATCH', `/users/${id}`, body);
  }

  async deleteUser(id) {
    return this.request('DELETE', `/users/${id}`);
  }

  // Services
  async listServices(categoryId) {
    const q = categoryId ? `?category_id=${categoryId}` : '';
    return this.request('GET', `/services${q}`);
  }

  async getService(id) {
    return this.request('GET', `/services/${id}`);
  }

  async createService(body) {
    return this.request('POST', '/services', body);
  }

  async updateService(id, body) {
    return this.request('PATCH', `/services/${id}`, body);
  }

  async deleteService(id) {
    return this.request('DELETE', `/services/${id}`);
  }

  // Service Categories
  async listCategories() {
    return this.request('GET', '/services/categories');
  }

  async createCategory(body) {
    return this.request('POST', '/services/categories', body);
  }

  // Clients
  async listClients(search) {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request('GET', `/clients${q}`);
  }

  async getClient(id) {
    return this.request('GET', `/clients/${id}`);
  }

  async createClient(body) {
    return this.request('POST', '/clients', body);
  }

  async updateClient(id, body) {
    return this.request('PATCH', `/clients/${id}`, body);
  }

  async deleteClient(id) {
    return this.request('DELETE', `/clients/${id}`);
  }

  // Visits
  async listVisits(params) {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    if (params?.status) q.set('status', params.status);
    if (params?.provider_id) q.set('provider_id', params.provider_id);
    if (params?.client_id) q.set('client_id', params.client_id);
    const qs = q.toString();
    return this.request('GET', `/visits${qs ? `?${qs}` : ''}`);
  }

  async getVisit(id) {
    return this.request('GET', `/visits/${id}`);
  }

  async createVisit(body) {
    return this.request('POST', '/visits', body);
  }

  async updateVisit(id, body) {
    return this.request('PATCH', `/visits/${id}`, body);
  }

  async updateVisitStatus(id, status, cancellation_reason) {
    return this.request('PATCH', `/visits/${id}/status`, { status, cancellation_reason });
  }

  // Availability
  async getAvailability(providerId) {
    return this.request('GET', `/availability/${providerId}`);
  }

  async setAvailability(providerId, schedule) {
    return this.request('PUT', `/availability/${providerId}`, { schedule });
  }

  async listClosures() {
    return this.request('GET', '/availability/closures/list');
  }

  async createClosure(body) {
    return this.request('POST', '/availability/closures', body);
  }

  // Series (recurring)
  async listSeries() {
    return this.request('GET', '/series');
  }

  async getSeries(id) {
    return this.request('GET', `/series/${id}`);
  }

  async createSeries(body) {
    return this.request('POST', '/series', body);
  }

  async updateSeries(id, body) {
    return this.request('PATCH', `/series/${id}`, body);
  }

  async editSeriesFuture(id, body) {
    return this.request('PATCH', `/series/${id}/edit-future`, body);
  }

  // Attention
  async listAttention(params) {
    const q = new URLSearchParams();
    if (params?.severity) q.set('severity', params.severity);
    if (params?.status) q.set('status', params.status);
    if (params?.issue_type) q.set('issue_type', params.issue_type);
    const qs = q.toString();
    return this.request('GET', `/attention${qs ? `?${qs}` : ''}`);
  }

  async getAttentionCounts() {
    return this.request('GET', '/attention/counts');
  }

  async updateAttention(id, body) {
    return this.request('PATCH', `/attention/${id}`, body);
  }

  // Reports
  async getDashboard() {
    return this.request('GET', '/reports/dashboard');
  }

  async getProviderReports(from, to) {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return this.request('GET', `/reports/providers${qs ? `?${qs}` : ''}`);
  }

  async getBookingSourceReports(from, to) {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString();
    return this.request('GET', `/reports/booking-sources${qs ? `?${qs}` : ''}`);
  }

  // Audit
  async listAuditLog(params) {
    const q = new URLSearchParams();
    if (params?.entity_type) q.set('entity_type', params.entity_type);
    if (params?.action) q.set('action', params.action);
    const qs = q.toString();
    return this.request('GET', `/audit${qs ? `?${qs}` : ''}`);
  }
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const api = new ApiClient();
