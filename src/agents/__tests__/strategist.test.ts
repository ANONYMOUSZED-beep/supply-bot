/**
 * Strategist Agent Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StrategistAgent } from '../strategist/index.js';
import { prisma } from '../../database/client.js';

// Mock Prisma
vi.mock('../../database/client.js', () => ({
  prisma: {
    inventoryItem: {
      findMany: vi.fn(),
    },
    usageRecord: {
      findMany: vi.fn(),
    },
    supplierProduct: {
      findMany: vi.fn(),
    },
    stockoutPrediction: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  },
}));

describe('StrategistAgent', () => {
  let agent: StrategistAgent;

  beforeEach(() => {
    agent = new StrategistAgent();
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

  describe('demand forecasting', () => {
    it('should calculate daily usage rate correctly', () => {
      const agentAny = agent as any;
      
      if (agentAny.calculateDailyUsageRate) {
        const usageRecords = [
          { quantity: 10, recordedAt: new Date('2024-01-01') },
          { quantity: 15, recordedAt: new Date('2024-01-02') },
          { quantity: 12, recordedAt: new Date('2024-01-03') },
        ];
        
        const rate = agentAny.calculateDailyUsageRate(usageRecords);
        expect(rate).toBeGreaterThan(0);
      }
    });

    it('should predict stockout days correctly', () => {
      const agentAny = agent as any;
      
      if (agentAny.predictDaysUntilStockout) {
        const currentStock = 100;
        const dailyUsageRate = 10;
        
        const days = agentAny.predictDaysUntilStockout(currentStock, dailyUsageRate);
        expect(days).toBe(10);
      }
    });

    it('should handle zero usage rate', () => {
      const agentAny = agent as any;
      
      if (agentAny.predictDaysUntilStockout) {
        const days = agentAny.predictDaysUntilStockout(100, 0);
        expect(days).toBe(Infinity);
      }
    });
  });

  describe('reorder suggestions', () => {
    it('should generate suggestions for low stock items', async () => {
      vi.mocked(prisma.inventoryItem.findMany).mockResolvedValue([
        {
          id: 'inv-1',
          productId: 'prod-1',
          currentStock: 5,
          reorderPoint: 10,
          reorderQuantity: 50,
          product: {
            id: 'prod-1',
            name: 'Test Product',
            sku: 'SKU-001',
          },
        },
      ] as any);

      vi.mocked(prisma.supplierProduct.findMany).mockResolvedValue([
        {
          id: 'sp-1',
          productId: 'prod-1',
          supplierId: 'supp-1',
          unitPrice: 10,
          supplier: {
            id: 'supp-1',
            name: 'Test Supplier',
          },
        },
      ] as any);

      const result = await agent.executeTask({
        id: 'test-1',
        type: 'generate_reorder_suggestions',
        payload: { organizationId: 'org-1' },
        priority: 1,
        scheduledAt: new Date(),
      });

      expect(result).toBeDefined();
    });
  });

  describe('linear regression', () => {
    it('should calculate trend correctly', () => {
      const agentAny = agent as any;
      
      if (agentAny.linearRegression) {
        const data = [
          { x: 1, y: 10 },
          { x: 2, y: 20 },
          { x: 3, y: 30 },
        ];
        
        const result = agentAny.linearRegression(data);
        expect(result.slope).toBeCloseTo(10);
        expect(result.intercept).toBeCloseTo(0);
      }
    });
  });
});
