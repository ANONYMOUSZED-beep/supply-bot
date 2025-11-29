/**
 * Scout Agent - Base Agent Interface
 * Defines the contract for all Supply-Bot agents
 */

export interface AgentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentTask {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  priority: number;
  scheduledAt: Date;
}

export abstract class BaseAgent {
  abstract readonly name: string;
  abstract readonly version: string;

  abstract initialize(): Promise<void>;
  abstract shutdown(): Promise<void>;
  abstract executeTask(task: AgentTask): Promise<AgentResult>;
  abstract healthCheck(): Promise<boolean>;
}

export interface ScrapingConfig {
  url: string;
  selectors: {
    productList?: string;
    productName?: string;
    productSku?: string;
    price?: string;
    stock?: string;
    pagination?: string;
  };
  authentication?: {
    type: 'form' | 'basic' | 'oauth';
    credentials: Record<string, string>;
  };
  rateLimit?: {
    requestsPerMinute: number;
    delayBetweenPages: number;
  };
}

export interface ScrapedProduct {
  sku: string;
  name: string;
  price: number;
  currency: string;
  inStock: boolean;
  stockLevel?: number;
  url?: string;
  lastUpdated: Date;
  rawData?: Record<string, unknown>;
}

export interface NegotiationOffer {
  productSku: string;
  quantity: number;
  targetPrice: number;
  currentBestPrice: number;
  deadline?: Date;
  terms?: string;
}

export interface NegotiationResponse {
  accepted: boolean;
  counterOffer?: {
    price: number;
    quantity?: number;
    terms?: string;
  };
  message: string;
}

export interface StockPrediction {
  productId: string;
  currentStock: number;
  predictedStockoutDate: Date;
  daysUntilStockout: number;
  confidence: number;
  suggestedReorderDate: Date;
  suggestedQuantity: number;
  factors: string[];
}
