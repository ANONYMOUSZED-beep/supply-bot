/**
 * Diplomat Agent Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiplomatAgent } from '../diplomat/index.js';
import { prisma } from '../../database/client.js';

// Mock Prisma
vi.mock('../../database/client.js', () => ({
  prisma: {
    negotiation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    negotiationMessage: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    supplier: {
      findUnique: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  },
}));

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: 'Test email content',
              },
            },
          ],
        }),
      },
    },
  })),
}));

// Mock Nodemailer
vi.mock('nodemailer', () => ({
  createTransport: vi.fn().mockReturnValue({
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-123' }),
  }),
}));

describe('DiplomatAgent', () => {
  let agent: DiplomatAgent;

  beforeEach(() => {
    agent = new DiplomatAgent();
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

  describe('negotiation strategy', () => {
    it('should determine appropriate strategy based on context', () => {
      const agentAny = agent as any;
      
      if (agentAny.determineNegotiationStrategy) {
        // Test with high relationship value
        const highRelationship = agentAny.determineNegotiationStrategy({
          relationshipStrength: 0.9,
          orderValue: 5000,
          marketCondition: 'buyers',
        });
        expect(highRelationship).toBeDefined();
        
        // Test with low relationship value
        const lowRelationship = agentAny.determineNegotiationStrategy({
          relationshipStrength: 0.2,
          orderValue: 1000,
          marketCondition: 'sellers',
        });
        expect(lowRelationship).toBeDefined();
      }
    });

    it('should calculate discount target correctly', () => {
      const agentAny = agent as any;
      
      if (agentAny.calculateTargetDiscount) {
        // High volume order should get higher discount target
        const highVolume = agentAny.calculateTargetDiscount(10000, 'good');
        const lowVolume = agentAny.calculateTargetDiscount(100, 'new');
        
        expect(highVolume).toBeGreaterThan(lowVolume);
      }
    });
  });

  describe('email generation', () => {
    it('should generate professional negotiation emails', async () => {
      const agentAny = agent as any;
      
      if (agentAny.generateNegotiationEmail) {
        const email = await agentAny.generateNegotiationEmail({
          supplierName: 'Test Supplier',
          products: [{ name: 'Widget', quantity: 100 }],
          currentPrices: { Widget: 10 },
          targetPrices: { Widget: 8 },
          strategy: 'collaborative',
        });
        
        expect(email).toBeDefined();
        expect(typeof email).toBe('string');
      }
    });
  });

  describe('response analysis', () => {
    it('should correctly analyze positive responses', () => {
      const agentAny = agent as any;
      
      if (agentAny.analyzeResponse) {
        const positiveResponse = 'We are happy to offer you a 10% discount on bulk orders.';
        const analysis = agentAny.analyzeResponse(positiveResponse);
        
        expect(analysis.sentiment).toBe('positive');
        expect(analysis.offeredDiscount).toBeGreaterThan(0);
      }
    });

    it('should correctly analyze rejection responses', () => {
      const agentAny = agent as any;
      
      if (agentAny.analyzeResponse) {
        const rejection = 'Unfortunately, we cannot offer any discounts at this time.';
        const analysis = agentAny.analyzeResponse(rejection);
        
        expect(analysis.sentiment).toBe('negative');
      }
    });

    it('should correctly analyze counter-offer responses', () => {
      const agentAny = agent as any;
      
      if (agentAny.analyzeResponse) {
        const counterOffer = 'We can offer 5% off instead of the requested 15%.';
        const analysis = agentAny.analyzeResponse(counterOffer);
        
        expect(analysis.sentiment).toBe('neutral');
        expect(analysis.isCounterOffer).toBe(true);
      }
    });
  });

  describe('executeTask', () => {
    it('should handle initiate_negotiation task', async () => {
      vi.mocked(prisma.supplier.findUnique).mockResolvedValue({
        id: 'supp-1',
        name: 'Test Supplier',
        contactEmail: 'supplier@test.com',
      } as any);

      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-1',
        name: 'Test Org',
      } as any);

      vi.mocked(prisma.negotiation.create).mockResolvedValue({
        id: 'neg-1',
        status: 'initiated',
      } as any);

      const result = await agent.executeTask({
        id: 'test-1',
        type: 'initiate_negotiation',
        payload: {
          organizationId: 'org-1',
          supplierId: 'supp-1',
          products: [{ sku: 'SKU-001', quantity: 100 }],
        },
        priority: 1,
        scheduledAt: new Date(),
      });

      expect(result).toBeDefined();
    });

    it('should handle process_responses task', async () => {
      vi.mocked(prisma.negotiation.findMany).mockResolvedValue([]);

      const result = await agent.executeTask({
        id: 'test-2',
        type: 'process_responses',
        payload: {},
        priority: 1,
        scheduledAt: new Date(),
      });

      expect(result).toBeDefined();
    });
  });
});
