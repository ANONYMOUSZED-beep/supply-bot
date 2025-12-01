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

  // Products
  async getProducts() {
    return this.request<any[]>('/api/products');
  }

  async createProduct(data: { sku: string; name: string; description?: string; category?: string; unit?: string }) {
    return this.request<any>('/api/products', {
      method: 'POST',
      body: data,
    });
  }

  // Inventory
  async getInventory() {
    return this.request<any[]>('/api/inventory');
  }

  async createInventoryItem(data: { productId: string; currentStock?: number; reorderPoint?: number; reorderQuantity?: number }) {
    return this.request<any>('/api/inventory', {
      method: 'POST',
      body: data,
    });
  }

  async updateInventory(id: string, data: { currentStock?: number; reorderPoint?: number; reorderQuantity?: number; safetyStock?: number }) {
    return this.request<any>(`/api/inventory/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  // Suppliers
  async getSuppliers() {
    return this.request<any[]>('/api/suppliers');
  }

  async createSupplier(data: { name: string; website?: string; contactEmail?: string; contactPhone?: string; portalType?: string }) {
    return this.request<any>('/api/suppliers', {
      method: 'POST',
      body: data,
    });
  }

  async updateSupplier(id: string, data: { name?: string; website?: string; contactEmail?: string; contactPhone?: string; isActive?: boolean; portalType?: string }) {
    return this.request<any>(`/api/suppliers/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteSupplier(id: string) {
    return this.request<any>(`/api/suppliers/${id}`, {
      method: 'DELETE',
    });
  }

  async scanSupplier(supplierId: string) {
    return this.request<any>(`/api/suppliers/${supplierId}/scan`, {
      method: 'POST',
    });
  }

  async getSupplierPrices(supplierId: string) {
    return this.request<any[]>(`/api/suppliers/${supplierId}/prices`);
  }

  // Orders
  async getOrders() {
    return this.request<any[]>('/api/orders');
  }

  async getOrder(id: string) {
    return this.request<any>(`/api/orders/${id}`);
  }

  async createOrder(data: { supplierId?: string; items?: any[]; productId?: string; quantity?: number }) {
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

  async getNegotiation(id: string) {
    return this.request<any>(`/api/negotiations/${id}`);
  }

  async createNegotiation(data: { supplierId: string; products?: any[]; targetDiscount?: number }) {
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

  async respondToNegotiation(negotiationId: string, responseContent: string) {
    return this.request<any>(`/api/negotiations/${negotiationId}/respond`, {
      method: 'POST',
      body: { responseContent },
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

  async getAgentStatus() {
    return this.request<any>('/api/agents/status');
  }

  // Activity
  async getActivity() {
    return this.request<any[]>('/api/activity');
  }

  // Suggestions
  async getSuggestions() {
    return this.request<any>('/api/suggestions');
  }
}

export const api = new ApiClient(API_BASE_URL);
