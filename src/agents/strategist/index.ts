/**
 * Strategist Agent - Predictive Inventory Analysis
 * Analyzes inventory data to predict stockouts and optimize reorder points
 */

import { prisma } from '../../database/client.js';
import { createAgentLogger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import { BaseAgent, AgentTask, AgentResult, StockPrediction } from '../types.js';

const logger = createAgentLogger('strategist');

interface InventoryAnalysis {
  productId: string;
  productSku: string;
  productName: string;
  currentStock: number;
  reorderPoint: number;
  avgDailyUsage: number;
  daysOfStock: number;
  predictedStockoutDate: Date;
  urgency: 'critical' | 'warning' | 'ok';
  recommendation: string;
}

interface DemandPattern {
  productId: string;
  trend: 'increasing' | 'stable' | 'decreasing';
  seasonality: number; // 0-1 scale
  volatility: number; // standard deviation
  forecastedDemand: number[];
}

export class StrategistAgent extends BaseAgent {
  readonly name = 'Strategist Agent';
  readonly version = '1.0.0';

  private readonly thresholdDays = config.agents.strategist.stockoutThresholdDays;

  async initialize(): Promise<void> {
    logger.info('Initializing Strategist Agent...');
    logger.info('Strategist Agent initialized successfully');
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Strategist Agent...');
    logger.info('Strategist Agent shut down');
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async executeTask(task: AgentTask): Promise<AgentResult> {
    logger.info(`Executing task: ${task.type}`, { taskId: task.id });

    switch (task.type) {
      case 'analyze_inventory':
        return this.analyzeInventory(task.payload as { organizationId: string });

      case 'predict_stockouts':
        return this.predictStockouts(task.payload as { organizationId: string });

      case 'analyze_demand':
        return this.analyzeDemand(task.payload as { productId: string });

      case 'optimize_reorder_points':
        return this.optimizeReorderPoints(task.payload as { organizationId: string });

      case 'generate_reorder_suggestions':
        return this.generateReorderSuggestions(task.payload as { organizationId: string });

      default:
        return { success: false, error: `Unknown task type: ${task.type}` };
    }
  }

  /**
   * Comprehensive inventory analysis
   */
  async analyzeInventory(payload: { organizationId: string }): Promise<AgentResult<InventoryAnalysis[]>> {
    try {
      const inventoryItems = await prisma.inventoryItem.findMany({
        where: { organizationId: payload.organizationId },
        include: { product: true },
      });

      const analyses: InventoryAnalysis[] = [];

      for (const item of inventoryItems) {
        const avgDailyUsage = item.avgDailyUsage || 1;
        const availableStock = item.currentStock - item.reservedStock;
        const daysOfStock = availableStock / avgDailyUsage;
        
        const predictedStockoutDate = new Date();
        predictedStockoutDate.setDate(predictedStockoutDate.getDate() + Math.floor(daysOfStock));

        let urgency: 'critical' | 'warning' | 'ok';
        let recommendation: string;

        if (daysOfStock <= 3) {
          urgency = 'critical';
          recommendation = `URGENT: Only ${daysOfStock.toFixed(1)} days of stock remaining. Initiate emergency procurement.`;
        } else if (daysOfStock <= this.thresholdDays) {
          urgency = 'warning';
          recommendation = `Reorder soon. ${daysOfStock.toFixed(1)} days of stock remaining.`;
        } else if (item.currentStock <= item.reorderPoint) {
          urgency = 'warning';
          recommendation = `Stock at or below reorder point. Consider placing order.`;
        } else {
          urgency = 'ok';
          recommendation = `Stock levels healthy. ${daysOfStock.toFixed(1)} days of supply.`;
        }

        analyses.push({
          productId: item.productId,
          productSku: item.product.sku,
          productName: item.product.name,
          currentStock: item.currentStock,
          reorderPoint: item.reorderPoint,
          avgDailyUsage,
          daysOfStock,
          predictedStockoutDate,
          urgency,
          recommendation,
        });
      }

      // Sort by urgency
      analyses.sort((a, b) => {
        const urgencyOrder = { critical: 0, warning: 1, ok: 2 };
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency] || a.daysOfStock - b.daysOfStock;
      });

      logger.info(`Inventory analysis complete`, {
        total: analyses.length,
        critical: analyses.filter(a => a.urgency === 'critical').length,
        warning: analyses.filter(a => a.urgency === 'warning').length,
      });

      return { success: true, data: analyses };
    } catch (error) {
      logger.error('Failed to analyze inventory', { error });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Predict upcoming stockouts
   */
  async predictStockouts(payload: { organizationId: string }): Promise<AgentResult<StockPrediction[]>> {
    try {
      const inventoryItems = await prisma.inventoryItem.findMany({
        where: { organizationId: payload.organizationId },
        include: {
          product: true,
          stockMovements: {
            orderBy: { createdAt: 'desc' },
            take: 90, // Last 90 movements for analysis
          },
        },
      });

      const predictions: StockPrediction[] = [];

      for (const item of inventoryItems) {
        // Calculate consumption patterns
        const consumptionData = this.analyzeConsumption(item.stockMovements);
        
        // Predict stockout using multiple methods and weight them
        const simplePredict = this.simpleStockoutPrediction(item, consumptionData);
        const trendPredict = this.trendBasedPrediction(item, consumptionData);
        
        // Weighted average of predictions
        const prediction = this.combinePredicitions(simplePredict, trendPredict);

        if (prediction.daysUntilStockout <= this.thresholdDays * 2) {
          // Store prediction in database
          await prisma.stockoutPrediction.create({
            data: {
              inventoryItemId: item.id,
              predictedDate: prediction.predictedStockoutDate,
              confidence: prediction.confidence,
              daysUntil: prediction.daysUntilStockout,
              suggestedAction: prediction.daysUntilStockout <= 3 ? 'expedite' : 'reorder',
              suggestedQty: prediction.suggestedQuantity,
            },
          });

          predictions.push({
            productId: item.productId,
            currentStock: item.currentStock,
            predictedStockoutDate: prediction.predictedStockoutDate,
            daysUntilStockout: prediction.daysUntilStockout,
            confidence: prediction.confidence,
            suggestedReorderDate: prediction.suggestedReorderDate,
            suggestedQuantity: prediction.suggestedQuantity,
            factors: prediction.factors,
          });
        }
      }

      // Sort by days until stockout
      predictions.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);

      logger.info(`Stockout predictions generated`, {
        total: predictions.length,
        critical: predictions.filter(p => p.daysUntilStockout <= 7).length,
      });

      return { success: true, data: predictions };
    } catch (error) {
      logger.error('Failed to predict stockouts', { error });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Analyze demand patterns for a product
   */
  async analyzeDemand(payload: { productId: string }): Promise<AgentResult<DemandPattern>> {
    try {
      const inventoryItem = await prisma.inventoryItem.findFirst({
        where: { productId: payload.productId },
        include: {
          stockMovements: {
            where: { type: 'out' },
            orderBy: { createdAt: 'asc' },
            take: 365, // Last year of data
          },
        },
      });

      if (!inventoryItem) {
        return { success: false, error: 'Inventory item not found' };
      }

      // Group movements by week
      const weeklyDemand = this.groupByWeek(inventoryItem.stockMovements);
      
      // Calculate trend
      const trend = this.calculateTrend(weeklyDemand);
      
      // Calculate seasonality (simplified)
      const seasonality = this.calculateSeasonality(weeklyDemand);
      
      // Calculate volatility
      const volatility = this.calculateVolatility(weeklyDemand);
      
      // Forecast next 4 weeks
      const forecastedDemand = this.forecastDemand(weeklyDemand, trend, seasonality, 4);

      const pattern: DemandPattern = {
        productId: payload.productId,
        trend,
        seasonality,
        volatility,
        forecastedDemand,
      };

      // Store forecast
      for (let i = 0; i < forecastedDemand.length; i++) {
        const forecastDate = new Date();
        forecastDate.setDate(forecastDate.getDate() + (i + 1) * 7);
        
        await prisma.demandForecast.create({
          data: {
            productId: payload.productId,
            forecastDate,
            predictedDemand: forecastedDemand[i],
            confidence: 0.85 - (i * 0.05), // Confidence decreases for further forecasts
            method: 'time_series_decomposition',
            factors: { trend, seasonality, volatility },
          },
        });
      }

      return { success: true, data: pattern };
    } catch (error) {
      logger.error('Failed to analyze demand', { error });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Optimize reorder points based on demand analysis
   */
  async optimizeReorderPoints(payload: { organizationId: string }): Promise<AgentResult> {
    try {
      const inventoryItems = await prisma.inventoryItem.findMany({
        where: { organizationId: payload.organizationId },
        include: {
          product: {
            include: {
              supplierProducts: {
                include: { supplier: true },
              },
            },
          },
          stockMovements: {
            where: { type: 'out' },
            orderBy: { createdAt: 'desc' },
            take: 90,
          },
        },
      });

      const optimizations: Array<{
        productId: string;
        currentReorderPoint: number;
        suggestedReorderPoint: number;
        currentReorderQty: number;
        suggestedReorderQty: number;
        reason: string;
      }> = [];

      for (const item of inventoryItems) {
        // Calculate average daily demand from recent movements
        const dailyDemand = this.calculateAverageDailyDemand(item.stockMovements);
        
        // Get lead time from primary supplier
        const primarySupplier = item.product.supplierProducts
          .filter((sp: any) => sp.supplier.tier === 1)
          .sort((a: any, b: any) => (a.leadTime || 7) - (b.leadTime || 7))[0];
        
        const leadTime = primarySupplier?.leadTime || 7;
        
        // Calculate safety stock (using service level of 95%)
        const demandVolatility = this.calculateVolatility(
          item.stockMovements.map((m: any) => Math.abs(m.quantity))
        );
        const safetyStock = 1.65 * demandVolatility * Math.sqrt(leadTime);
        
        // Optimal reorder point = (Daily Demand × Lead Time) + Safety Stock
        const optimalReorderPoint = Math.ceil((dailyDemand * leadTime) + safetyStock);
        
        // Economic Order Quantity (simplified)
        const annualDemand = dailyDemand * 365;
        const orderingCost = 50; // Assumed fixed ordering cost
        const holdingCostRate = 0.25; // 25% of item value
        const itemCost = primarySupplier?.unitPrice || 10;
        const eoq = Math.ceil(Math.sqrt((2 * annualDemand * orderingCost) / (holdingCostRate * itemCost)));

        if (Math.abs(optimalReorderPoint - item.reorderPoint) > item.reorderPoint * 0.1 ||
            Math.abs(eoq - item.reorderQuantity) > item.reorderQuantity * 0.1) {
          optimizations.push({
            productId: item.productId,
            currentReorderPoint: item.reorderPoint,
            suggestedReorderPoint: optimalReorderPoint,
            currentReorderQty: item.reorderQuantity,
            suggestedReorderQty: eoq,
            reason: `Based on ${dailyDemand.toFixed(1)} units/day demand and ${leadTime} day lead time`,
          });
        }
      }

      logger.info(`Reorder optimization complete`, { optimizations: optimizations.length });

      return { success: true, data: optimizations };
    } catch (error) {
      logger.error('Failed to optimize reorder points', { error });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Generate actionable reorder suggestions
   */
  async generateReorderSuggestions(payload: { organizationId: string }): Promise<AgentResult> {
    try {
      const [inventoryAnalysis, stockoutPredictions] = await Promise.all([
        this.analyzeInventory(payload),
        this.predictStockouts(payload),
      ]);

      if (!inventoryAnalysis.success || !stockoutPredictions.success) {
        return { success: false, error: 'Failed to gather analysis data' };
      }

      const urgentItems = inventoryAnalysis.data?.filter(
        (a: any) => a.urgency === 'critical' || a.urgency === 'warning'
      ) || [];

      // Group by supplier for consolidated ordering
      const supplierProducts = await prisma.supplierProduct.findMany({
        where: {
          productId: { in: urgentItems.map((i: any) => i.productId) },
          inStock: true,
        },
        include: {
          supplier: true,
          product: {
            include: { inventoryItem: true },
          },
        },
        orderBy: { unitPrice: 'asc' },
      });

      // Build reorder suggestions grouped by supplier
      const supplierSuggestions = new Map<string, {
        supplier: any;
        items: Array<{
          product: any;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          urgency: string;
        }>;
        totalValue: number;
      }>();

      for (const sp of supplierProducts) {
        const inventoryItem = sp.product.inventoryItem;
        if (!inventoryItem) continue;

        const urgentItem = urgentItems.find((i: any) => i.productId === sp.productId);
        if (!urgentItem) continue;

        // Calculate order quantity
        const quantity = inventoryItem.reorderQuantity;
        const totalPrice = quantity * sp.unitPrice;

        if (!supplierSuggestions.has(sp.supplierId)) {
          supplierSuggestions.set(sp.supplierId, {
            supplier: sp.supplier,
            items: [],
            totalValue: 0,
          });
        }

        const suggestion = supplierSuggestions.get(sp.supplierId)!;
        
        // Only add if this supplier offers the best price for this product
        const existingItem = suggestion.items.find(i => i.product.id === sp.productId);
        if (!existingItem) {
          suggestion.items.push({
            product: sp.product,
            quantity,
            unitPrice: sp.unitPrice,
            totalPrice,
            urgency: urgentItem.urgency,
          });
          suggestion.totalValue += totalPrice;
        }
      }

      const suggestions = Array.from(supplierSuggestions.values());

      logger.info(`Generated reorder suggestions`, {
        suppliers: suggestions.length,
        totalItems: suggestions.reduce((sum, s) => sum + s.items.length, 0),
      });

      return {
        success: true,
        data: {
          suggestions,
          summary: {
            totalSuppliers: suggestions.length,
            totalItems: suggestions.reduce((sum, s) => sum + s.items.length, 0),
            totalValue: suggestions.reduce((sum, s) => sum + s.totalValue, 0),
            criticalItems: urgentItems.filter((i: any) => i.urgency === 'critical').length,
          },
        },
      };
    } catch (error) {
      logger.error('Failed to generate reorder suggestions', { error });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ==========================================
  // Helper Methods
  // ==========================================

  private analyzeConsumption(movements: any[]): { daily: number; weekly: number; trend: number } {
    const outMovements = movements.filter(m => m.type === 'out');
    
    if (outMovements.length === 0) {
      return { daily: 0, weekly: 0, trend: 0 };
    }

    const totalConsumed = outMovements.reduce((sum, m) => sum + Math.abs(m.quantity), 0);
    
    const firstDate = new Date(outMovements[outMovements.length - 1].createdAt);
    const lastDate = new Date(outMovements[0].createdAt);
    const daysDiff = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

    const daily = totalConsumed / daysDiff;
    const weekly = daily * 7;

    // Simple trend: compare recent vs older consumption
    const midpoint = Math.floor(outMovements.length / 2);
    const recentConsumption = outMovements.slice(0, midpoint).reduce((sum, m) => sum + Math.abs(m.quantity), 0);
    const olderConsumption = outMovements.slice(midpoint).reduce((sum, m) => sum + Math.abs(m.quantity), 0);
    const trend = olderConsumption > 0 ? (recentConsumption - olderConsumption) / olderConsumption : 0;

    return { daily, weekly, trend };
  }

  private simpleStockoutPrediction(item: any, consumption: { daily: number; weekly: number; trend: number }) {
    const availableStock = item.currentStock - item.reservedStock;
    const daysUntilStockout = consumption.daily > 0 ? availableStock / consumption.daily : 365;
    
    const predictedStockoutDate = new Date();
    predictedStockoutDate.setDate(predictedStockoutDate.getDate() + Math.floor(daysUntilStockout));

    return {
      daysUntilStockout,
      predictedStockoutDate,
      confidence: 0.7,
      factors: ['historical_average'],
    };
  }

  private trendBasedPrediction(item: any, consumption: { daily: number; weekly: number; trend: number }) {
    const availableStock = item.currentStock - item.reservedStock;
    
    // Adjust daily consumption based on trend
    const trendAdjustedDaily = consumption.daily * (1 + consumption.trend * 0.5);
    const daysUntilStockout = trendAdjustedDaily > 0 ? availableStock / trendAdjustedDaily : 365;
    
    const predictedStockoutDate = new Date();
    predictedStockoutDate.setDate(predictedStockoutDate.getDate() + Math.floor(daysUntilStockout));

    return {
      daysUntilStockout,
      predictedStockoutDate,
      confidence: 0.8,
      factors: ['historical_average', 'trend_adjustment'],
    };
  }

  private combinePredicitions(...predictions: any[]) {
    const avgDays = predictions.reduce((sum, p) => sum + p.daysUntilStockout, 0) / predictions.length;
    const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;
    
    const predictedStockoutDate = new Date();
    predictedStockoutDate.setDate(predictedStockoutDate.getDate() + Math.floor(avgDays));

    const suggestedReorderDate = new Date();
    suggestedReorderDate.setDate(suggestedReorderDate.getDate() + Math.max(0, Math.floor(avgDays) - 7));

    const allFactors = [...new Set(predictions.flatMap(p => p.factors))];

    return {
      daysUntilStockout: Math.floor(avgDays),
      predictedStockoutDate,
      confidence: avgConfidence,
      suggestedReorderDate,
      suggestedQuantity: 0, // Will be calculated separately
      factors: allFactors,
    };
  }

  private groupByWeek(movements: any[]): number[] {
    const weekly: Map<string, number> = new Map();
    
    for (const movement of movements) {
      const date = new Date(movement.createdAt);
      const weekStart = this.getWeekStart(date);
      const key = weekStart.toISOString();
      
      weekly.set(key, (weekly.get(key) || 0) + Math.abs(movement.quantity));
    }

    return Array.from(weekly.values());
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  private calculateTrend(values: number[]): 'increasing' | 'stable' | 'decreasing' {
    if (values.length < 4) return 'stable';

    const midpoint = Math.floor(values.length / 2);
    const firstHalf = values.slice(0, midpoint);
    const secondHalf = values.slice(midpoint);

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const changePercent = (secondAvg - firstAvg) / firstAvg;

    if (changePercent > 0.1) return 'increasing';
    if (changePercent < -0.1) return 'decreasing';
    return 'stable';
  }

  private calculateSeasonality(values: number[]): number {
    if (values.length < 8) return 0;

    // Simple seasonality detection using coefficient of variation
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return Math.min(1, stdDev / mean);
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
  }

  private forecastDemand(
    historical: number[], 
    trend: 'increasing' | 'stable' | 'decreasing',
    seasonality: number,
    weeks: number
  ): number[] {
    const recentAvg = historical.length > 0 
      ? historical.slice(-4).reduce((a, b) => a + b, 0) / Math.min(4, historical.length)
      : 0;

    const trendMultiplier = trend === 'increasing' ? 1.05 : trend === 'decreasing' ? 0.95 : 1;
    
    const forecast: number[] = [];
    for (let i = 0; i < weeks; i++) {
      const baseValue = recentAvg * Math.pow(trendMultiplier, i + 1);
      // Add some seasonality variation
      const seasonalAdjustment = 1 + (seasonality * 0.2 * Math.sin((i / 4) * Math.PI));
      forecast.push(Math.round(baseValue * seasonalAdjustment));
    }

    return forecast;
  }

  private calculateAverageDailyDemand(movements: any[]): number {
    const outMovements = movements.filter(m => m.type === 'out');
    
    if (outMovements.length === 0) return 0;

    const totalConsumed = outMovements.reduce((sum, m) => sum + Math.abs(m.quantity), 0);
    
    const firstDate = new Date(outMovements[outMovements.length - 1].createdAt);
    const lastDate = new Date(outMovements[0].createdAt);
    const daysDiff = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

    return totalConsumed / daysDiff;
  }
}

export const strategistAgent = new StrategistAgent();
