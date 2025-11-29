/**
 * Cooperative Federation Service
 * Enables SMBs to form "Virtual Cooperatives" for collective buying power
 */

import axios from 'axios';
import { prisma } from '../database/client.js';
import { createAgentLogger } from '../utils/logger.js';
import { config } from '../config/index.js';

const logger = createAgentLogger('federation');

interface AggregatedDemand {
  productCategory: string;
  totalQuantity: number;
  participantCount: number;
  averagePrice: number;
  potentialSavings: number;
}

interface BulkOrderOpportunity {
  id: string;
  category: string;
  totalQuantity: number;
  targetPrice: number;
  currentBestPrice: number;
  participants: number;
  deadline: Date;
  status: 'collecting' | 'negotiating' | 'confirmed' | 'fulfilled';
}

interface CooperativeMemberData {
  organizationId: string;
  anonymizedDemand: {
    category: string;
    monthlyVolume: number;
    preferredLeadTime: number;
  }[];
}

export class FederationService {
  private federationApiUrl: string;
  private organizationId: string;

  constructor() {
    this.federationApiUrl = config.federation.apiUrl || '';
    this.organizationId = config.federation.orgId || '';
  }

  /**
   * Check if federation is enabled and configured
   */
  isEnabled(): boolean {
    return config.federation.enabled && 
           !!this.federationApiUrl && 
           !!this.organizationId;
  }

  /**
   * Join a cooperative
   */
  async joinCooperative(cooperativeId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isEnabled()) {
      return { success: false, error: 'Federation is not enabled' };
    }

    try {
      // Get organization details
      const org = await prisma.organization.findFirst();
      if (!org) {
        return { success: false, error: 'Organization not found' };
      }

      // Create local membership record
      const cooperative = await prisma.cooperative.findUnique({
        where: { id: cooperativeId },
      });

      if (!cooperative) {
        // Fetch cooperative from federation API
        const response = await axios.get(
          `${this.federationApiUrl}/cooperatives/${cooperativeId}`
        );
        
        await prisma.cooperative.create({
          data: {
            id: cooperativeId,
            name: response.data.name,
            description: response.data.description,
            industry: response.data.industry,
            memberCount: response.data.memberCount,
          },
        });
      }

      // Create membership
      await prisma.cooperativeMembership.create({
        data: {
          organizationId: org.id,
          cooperativeId,
          status: 'active',
        },
      });

      // Register with federation API
      await axios.post(`${this.federationApiUrl}/cooperatives/${cooperativeId}/join`, {
        organizationId: this.organizationId,
        industry: org.industry,
        size: org.size,
      });

      logger.info('Joined cooperative', { cooperativeId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to join cooperative', { error });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Submit anonymized demand data to cooperative
   */
  async submitDemandData(): Promise<void> {
    if (!this.isEnabled()) return;

    try {
      const membership = await prisma.cooperativeMembership.findFirst({
        where: { 
          organization: { id: { not: undefined } },
          status: 'active',
        },
        include: { organization: true, cooperative: true },
      });

      if (!membership) return;

      // Aggregate demand data by category
      const demandData = await prisma.$queryRaw<Array<{
        category: string;
        totalQuantity: number;
        avgPrice: number;
      }>>`
        SELECT 
          p.category,
          SUM(i."reorderQuantity" * i."avgDailyUsage" * 30) as "totalQuantity",
          AVG(sp."unitPrice") as "avgPrice"
        FROM "InventoryItem" i
        JOIN "Product" p ON i."productId" = p.id
        LEFT JOIN "SupplierProduct" sp ON p.id = sp."productId"
        WHERE i."organizationId" = ${membership.organizationId}
        GROUP BY p.category
      `;

      // Anonymize and submit
      const anonymizedData: CooperativeMemberData = {
        organizationId: this.organizationId,
        anonymizedDemand: demandData.map(d => ({
          category: d.category || 'Other',
          monthlyVolume: Math.round(d.totalQuantity / 100) * 100, // Round to nearest 100
          preferredLeadTime: 7, // Default
        })),
      };

      // Update local record
      await prisma.cooperativeMembership.update({
        where: { id: membership.id },
        data: { anonymizedData: anonymizedData as any },
      });

      // Submit to federation API
      await axios.post(
        `${this.federationApiUrl}/cooperatives/${membership.cooperativeId}/demand`,
        anonymizedData
      );

      logger.info('Submitted demand data to cooperative');
    } catch (error) {
      logger.error('Failed to submit demand data', { error });
    }
  }

  /**
   * Get available bulk order opportunities
   */
  async getBulkOrderOpportunities(): Promise<BulkOrderOpportunity[]> {
    if (!this.isEnabled()) return [];

    try {
      const membership = await prisma.cooperativeMembership.findFirst({
        where: { status: 'active' },
      });

      if (!membership) return [];

      // Fetch from federation API
      const response = await axios.get(
        `${this.federationApiUrl}/cooperatives/${membership.cooperativeId}/opportunities`
      );

      // Also get local opportunities
      const localOpportunities = await prisma.cooperativeBulkOrder.findMany({
        where: { 
          cooperativeId: membership.cooperativeId,
          status: { in: ['collecting', 'negotiating'] },
        },
      });

      return [
        ...response.data,
        ...localOpportunities.map(o => ({
          id: o.id,
          category: o.productCategory,
          totalQuantity: o.totalQuantity,
          targetPrice: o.targetPrice,
          currentBestPrice: o.negotiatedPrice || o.targetPrice * 1.2,
          participants: o.participantCount,
          deadline: o.deadline,
          status: o.status as BulkOrderOpportunity['status'],
        })),
      ];
    } catch (error) {
      logger.error('Failed to get bulk order opportunities', { error });
      return [];
    }
  }

  /**
   * Participate in a bulk order
   */
  async participateInBulkOrder(
    opportunityId: string,
    quantity: number
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isEnabled()) {
      return { success: false, error: 'Federation is not enabled' };
    }

    try {
      const membership = await prisma.cooperativeMembership.findFirst({
        where: { status: 'active' },
        include: { organization: true },
      });

      if (!membership) {
        return { success: false, error: 'Not a member of any cooperative' };
      }

      // Submit participation
      await axios.post(
        `${this.federationApiUrl}/bulk-orders/${opportunityId}/participate`,
        {
          organizationId: this.organizationId,
          quantity,
        }
      );

      // Update local bulk order if exists
      await prisma.cooperativeBulkOrder.update({
        where: { id: opportunityId },
        data: {
          totalQuantity: { increment: quantity },
          participantCount: { increment: 1 },
        },
      }).catch(() => {/* Might not exist locally */});

      logger.info('Participated in bulk order', { opportunityId, quantity });
      return { success: true };
    } catch (error) {
      logger.error('Failed to participate in bulk order', { error });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Calculate potential savings from cooperative membership
   */
  async calculateCooperativeSavings(): Promise<{
    monthlyPotentialSavings: number;
    annualPotentialSavings: number;
    categories: Array<{
      category: string;
      currentSpend: number;
      potentialSpend: number;
      savings: number;
      savingsPercent: number;
    }>;
  }> {
    try {
      const membership = await prisma.cooperativeMembership.findFirst({
        where: { status: 'active' },
        include: { organization: true },
      });

      if (!membership) {
        return {
          monthlyPotentialSavings: 0,
          annualPotentialSavings: 0,
          categories: [],
        };
      }

      // Analyze current spending
      const spending = await prisma.$queryRaw<Array<{
        category: string;
        monthlySpend: number;
      }>>`
        SELECT 
          p.category,
          SUM(i."avgDailyUsage" * 30 * sp."unitPrice") as "monthlySpend"
        FROM "InventoryItem" i
        JOIN "Product" p ON i."productId" = p.id
        JOIN "SupplierProduct" sp ON p.id = sp."productId"
        WHERE i."organizationId" = ${membership.organizationId}
        AND sp."unitPrice" = (
          SELECT MIN("unitPrice") 
          FROM "SupplierProduct" 
          WHERE "productId" = p.id
        )
        GROUP BY p.category
      `;

      // Estimate savings based on cooperative leverage
      // Assume 8-15% discount based on category
      const categoryDiscounts: Record<string, number> = {
        'Raw Materials': 0.12, // 12% discount on lumber, etc.
        'Hardware': 0.08,      // 8% on hardware
        'Finishes': 0.10,      // 10% on finishes
        'Other': 0.05,         // 5% default
      };

      const categories = spending.map(s => {
        const discount = categoryDiscounts[s.category || 'Other'] || 0.05;
        const savings = s.monthlySpend * discount;
        
        return {
          category: s.category || 'Other',
          currentSpend: s.monthlySpend,
          potentialSpend: s.monthlySpend * (1 - discount),
          savings,
          savingsPercent: discount * 100,
        };
      });

      const monthlyPotentialSavings = categories.reduce((sum, c) => sum + c.savings, 0);

      return {
        monthlyPotentialSavings,
        annualPotentialSavings: monthlyPotentialSavings * 12,
        categories,
      };
    } catch (error) {
      logger.error('Failed to calculate cooperative savings', { error });
      return {
        monthlyPotentialSavings: 0,
        annualPotentialSavings: 0,
        categories: [],
      };
    }
  }

  /**
   * Get cooperative statistics
   */
  async getCooperativeStats(): Promise<{
    memberCount: number;
    totalBuyingPower: number;
    activeNegotiations: number;
    completedOrders: number;
    totalSavings: number;
  } | null> {
    if (!this.isEnabled()) return null;

    try {
      const membership = await prisma.cooperativeMembership.findFirst({
        where: { status: 'active' },
        include: { cooperative: true },
      });

      if (!membership) return null;

      // Fetch from federation API
      const response = await axios.get(
        `${this.federationApiUrl}/cooperatives/${membership.cooperativeId}/stats`
      );

      return {
        memberCount: response.data.memberCount,
        totalBuyingPower: response.data.totalBuyingPower,
        activeNegotiations: response.data.activeNegotiations,
        completedOrders: response.data.completedOrders,
        totalSavings: response.data.totalSavings,
      };
    } catch (error) {
      logger.error('Failed to get cooperative stats', { error });
      return null;
    }
  }

  /**
   * Create a new bulk order opportunity
   */
  async createBulkOrderOpportunity(params: {
    productCategory: string;
    initialQuantity: number;
    targetPrice: number;
    deadlineDays: number;
  }): Promise<{ success: boolean; opportunityId?: string; error?: string }> {
    if (!this.isEnabled()) {
      return { success: false, error: 'Federation is not enabled' };
    }

    try {
      const membership = await prisma.cooperativeMembership.findFirst({
        where: { status: 'active' },
      });

      if (!membership) {
        return { success: false, error: 'Not a member of any cooperative' };
      }

      const deadline = new Date();
      deadline.setDate(deadline.getDate() + params.deadlineDays);

      // Create local record
      const opportunity = await prisma.cooperativeBulkOrder.create({
        data: {
          cooperativeId: membership.cooperativeId,
          productCategory: params.productCategory,
          totalQuantity: params.initialQuantity,
          targetPrice: params.targetPrice,
          status: 'collecting',
          participantCount: 1,
          deadline,
        },
      });

      // Register with federation API
      await axios.post(
        `${this.federationApiUrl}/cooperatives/${membership.cooperativeId}/bulk-orders`,
        {
          id: opportunity.id,
          category: params.productCategory,
          quantity: params.initialQuantity,
          targetPrice: params.targetPrice,
          deadline,
          createdBy: this.organizationId,
        }
      );

      logger.info('Created bulk order opportunity', { 
        opportunityId: opportunity.id,
        category: params.productCategory,
      });

      return { success: true, opportunityId: opportunity.id };
    } catch (error) {
      logger.error('Failed to create bulk order opportunity', { error });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

export const federationService = new FederationService();
