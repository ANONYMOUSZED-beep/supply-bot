const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://supply-bot.onrender.com';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  }

  async request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;
    const token = this.getToken();

    const config: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    };

    if (body) {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, config);

    if (response.status === 401 || response.status === 403) {
      // Token expired or invalid
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      throw new Error('Authentication required');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{ token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
  }

  async register(name: string, email: string, password: string, companyName: string) {
    return this.request<{ token: string; user: any }>('/api/auth/register', {
      method: 'POST',
      body: { name, email, password, companyName },
    });
  }

  // Dashboard
  async getDashboard() {
    return this.request<any>('/api/dashboard');
  }

  // Inventory
  async getInventory() {
    return this.request<any[]>('/api/inventory');
  }

  async updateInventory(id: string, data: any) {
    return this.request<any>(`/api/inventory/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  // Suppliers
  async getSuppliers() {
    return this.request<any[]>('/api/suppliers');
  }

  async createSupplier(data: any) {
    return this.request<any>('/api/suppliers', {
      method: 'POST',
      body: data,
    });
  }

  async scanSupplier(supplierId: string) {
    return this.request<any>(`/api/suppliers/${supplierId}/scan`, {
      method: 'POST',
    });
  }

  // Orders
  async getOrders() {
    return this.request<any[]>('/api/orders');
  }

  async createOrder(data: any) {
    return this.request<any>('/api/orders', {
      method: 'POST',
      body: data,
    });
  }

  async updateOrderStatus(orderId: string, status: string) {
    return this.request<any>(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      body: { status },
    });
  }

  // Negotiations
  async getNegotiations() {
    return this.request<any[]>('/api/negotiations');
  }

  async createNegotiation(data: any) {
    return this.request<any>('/api/negotiations', {
      method: 'POST',
      body: data,
    });
  }

  async sendNegotiationMessage(negotiationId: string, message: string) {
    return this.request<any>(`/api/negotiations/${negotiationId}/messages`, {
      method: 'POST',
      body: { message },
    });
  }

  // Agents
  async runProcurementCycle() {
    return this.request<any>('/api/agents/run-cycle', {
      method: 'POST',
    });
  }

  async autoReorderLowStock() {
    return this.request<any>('/api/agents/auto-reorder', {
      method: 'POST',
    });
  }

  // Analytics
  async getAnalytics(period?: string) {
    const query = period ? `?period=${period}` : '';
    return this.request<any>(`/api/analytics${query}`);
  }

  // Federation
  async getFederationStatus() {
    return this.request<any>('/api/federation/status');
  }

  async joinFederation(data: any) {
    return this.request<any>('/api/federation/join', {
      method: 'POST',
      body: data,
    });
  }
}

export const api = new ApiClient(API_BASE_URL);
