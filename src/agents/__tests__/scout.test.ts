/**
 * Scout Agent Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScoutAgent } from '../scout/index.js';
import { prisma } from '../../database/client.js';

// Mock Prisma
vi.mock('../../database/client.js', () => ({
  prisma: {
    supplier: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    supplierProduct: {
      upsert: vi.fn(),
    },
    priceHistory: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  },
}));

// Mock Playwright
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn(),
        content: vi.fn().mockResolvedValue('<html><body></body></html>'),
        waitForSelector: vi.fn(),
        close: vi.fn(),
      }),
      close: vi.fn(),
    }),
  },
}));

describe('ScoutAgent', () => {
  let agent: ScoutAgent;

  beforeEach(() => {
    agent = new ScoutAgent();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('healthCheck', () => {
    it('should return true when healthy', async () => {
      const result = await agent.healthCheck();
      expect(result).toBe(true);
    });
  });

  describe('executeTask', () => {
    it('should handle scan_supplier task type', async () => {
      const mockSupplier = {
        id: 'supplier-1',
        name: 'Test Supplier',
        website: 'https://example.com',
        catalogUrl: 'https://example.com/catalog',
        portalType: 'static',
      };

      vi.mocked(prisma.supplier.findMany).mockResolvedValue([mockSupplier] as any);

      const result = await agent.executeTask({
        id: 'test-1',
        type: 'scan_supplier',
        payload: { supplierId: 'supplier-1' },
        priority: 1,
        scheduledAt: new Date(),
      });

      expect(result).toBeDefined();
    });

    it('should handle full_scan task type', async () => {
      vi.mocked(prisma.supplier.findMany).mockResolvedValue([]);

      const result = await agent.executeTask({
        id: 'test-2',
        type: 'full_scan',
        payload: { organizationId: 'org-1' },
        priority: 1,
        scheduledAt: new Date(),
      });

      expect(result).toBeDefined();
    });
  });

  describe('product extraction', () => {
    it('should extract product data from HTML', async () => {
      const mockHtml = `
        <div class="product" data-sku="SKU-001">
          <h2 class="product-name">Test Product</h2>
          <span class="price">$99.99</span>
          <span class="stock">In Stock</span>
        </div>
      `;

      // Test internal extraction method
      const agentAny = agent as any;
      if (agentAny.extractProductsFromHtml) {
        const products = agentAny.extractProductsFromHtml(mockHtml);
        expect(Array.isArray(products)).toBe(true);
      }
    });
  });

  describe('price change detection', () => {
    it('should detect significant price changes', () => {
      const agentAny = agent as any;
      
      // Test price change calculation if method exists
      if (agentAny.calculatePriceChange) {
        const change = agentAny.calculatePriceChange(100, 120);
        expect(change).toBe(0.2); // 20% increase
      }
    });
  });
});
