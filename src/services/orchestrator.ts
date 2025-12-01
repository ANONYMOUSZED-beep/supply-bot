/**
 * Agent Orchestrator
 * Coordinates all Supply-Bot agents and manages task queue
 */

import Bull from 'bull';
import { prisma } from '../database/client.js';
import { createAgentLogger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { scoutAgent } from '../agents/scout/index.js';
import { strategistAgent } from '../agents/strategist/index.js';
import { diplomatAgent } from '../agents/diplomat/index.js';
import { portalAutomation } from './portal-automation.js';
import { AgentTask, AgentResult } from '../agents/types.js';

const logger = createAgentLogger('orchestrator');

interface QueuedTask {
  agentType: 'scout' | 'strategist' | 'diplomat';
  taskType: string;
  payload: Record<string, unknown>;
  priority?: number;
}

export class AgentOrchestrator {
  private taskQueue: Bull.Queue<QueuedTask>;
  private isRunning: boolean = false;

  constructor() {
    this.taskQueue = new Bull<QueuedTask>('agent-tasks', config.database.redisUrl, {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Agent Orchestrator...');

    // Initialize all agents
    await Promise.all([
      scoutAgent.initialize(),
      strategistAgent.initialize(),
      diplomatAgent.initialize(),
      portalAutomation.initialize(),
    ]);

    // Set up queue processor
    this.taskQueue.process(async (job) => {
      return this.processTask(job.data);
    });

    // Event handlers
    this.taskQueue.on('completed', (job, result) => {
      logger.debug(`Task completed: ${job.id}`, { taskType: job.data.taskType });
    });

    this.taskQueue.on('failed', (job, error) => {
      logger.error(`Task failed: ${job.id}`, { taskType: job.data.taskType, error: error.message });
    });

    this.isRunning = true;
    logger.info('Agent Orchestrator initialized');
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Agent Orchestrator...');
    
    this.isRunning = false;
    await this.taskQueue.close();

    await Promise.all([
      scoutAgent.shutdown(),
      strategistAgent.shutdown(),
      diplomatAgent.shutdown(),
      portalAutomation.shutdown(),
    ]);

    logger.info('Agent Orchestrator shut down');
  }

  /**
   * Add a task to the queue
   */
  async queueTask(task: QueuedTask): Promise<string> {
    const job = await this.taskQueue.add(task, {
      priority: task.priority || 5,
    });

    // Record task in database
    await prisma.agentTask.create({
      data: {
        agentType: task.agentType,
        taskType: task.taskType,
        priority: task.priority || 5,
        payload: JSON.parse(JSON.stringify(task.payload)),
        status: 'pending',
        scheduledAt: new Date(),
      },
    });

    logger.info(`Task queued: ${task.taskType}`, { jobId: job.id });
    return job.id.toString();
  }

  /**
   * Process a task from the queue
   */
  private async processTask(queuedTask: QueuedTask): Promise<AgentResult> {
    const taskId = `${queuedTask.agentType}-${Date.now()}`;
    
    const task: AgentTask = {
      id: taskId,
      type: queuedTask.taskType,
      payload: queuedTask.payload,
      priority: queuedTask.priority || 5,
      scheduledAt: new Date(),
    };

    logger.info(`Processing task: ${task.type}`, { agent: queuedTask.agentType });

    let result: AgentResult;

    // Route to appropriate agent
    switch (queuedTask.agentType) {
      case 'scout':
        result = await scoutAgent.executeTask(task);
        break;
      case 'strategist':
        result = await strategistAgent.executeTask(task);
        break;
      case 'diplomat':
        result = await diplomatAgent.executeTask(task);
        break;
      default:
        result = { success: false, error: `Unknown agent type: ${queuedTask.agentType}` };
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        agentType: queuedTask.agentType,
        action: task.type,
        details: JSON.parse(JSON.stringify({
          success: result.success,
          error: result.error || null,
          metadata: result.metadata || null,
        })),
      },
    });

    return result;
  }

  /**
   * Run automated procurement workflow
   */
  async runProcurementCycle(organizationId: string): Promise<void> {
    logger.info('Starting procurement cycle', { organizationId });

    // Step 1: Scan all suppliers for latest prices/stock
    await this.queueTask({
      agentType: 'scout',
      taskType: 'scan_all_suppliers',
      payload: { organizationId },
      priority: 1,
    });

    // Step 2: Analyze inventory and predict stockouts
    await this.queueTask({
      agentType: 'strategist',
      taskType: 'analyze_inventory',
      payload: { organizationId },
      priority: 2,
    });

    await this.queueTask({
      agentType: 'strategist',
      taskType: 'predict_stockouts',
      payload: { organizationId },
      priority: 2,
    });

    // Step 3: Generate reorder suggestions
    await this.queueTask({
      agentType: 'strategist',
      taskType: 'generate_reorder_suggestions',
      payload: { organizationId },
      priority: 3,
    });
  }

  /**
   * Initiate automatic reorder for low stock items
   */
  async autoReorder(organizationId: string): Promise<void> {
    logger.info('Checking for auto-reorder items', { organizationId });

    // Get items below reorder point
    const lowStockItems = await prisma.inventoryItem.findMany({
      where: {
        organizationId,
        currentStock: { lte: prisma.inventoryItem.fields.reorderPoint },
      },
      include: {
        product: {
          include: {
            supplierProducts: {
              include: { supplier: true },
              where: { inStock: true },
              orderBy: { unitPrice: 'asc' },
            },
          },
        },
      },
    });

    // Group by best supplier
    const supplierOrders = new Map<string, Array<{ productId: string; quantity: number }>>();

    for (const item of lowStockItems) {
      const bestSupplier = item.product.supplierProducts[0];
      if (!bestSupplier) continue;

      if (!supplierOrders.has(bestSupplier.supplierId)) {
        supplierOrders.set(bestSupplier.supplierId, []);
      }

      supplierOrders.get(bestSupplier.supplierId)!.push({
        productId: item.productId,
        quantity: item.reorderQuantity,
      });
    }

    // Queue negotiations for each supplier
    for (const [supplierId, products] of supplierOrders) {
      await this.queueTask({
        agentType: 'diplomat',
        taskType: 'initiate_negotiation',
        payload: { organizationId, supplierId, products },
        priority: 2,
      });
    }

    logger.info('Auto-reorder tasks queued', {
      suppliers: supplierOrders.size,
      items: lowStockItems.length,
    });
  }

  /**
   * Get queue status
   */
  async getQueueStatus(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.taskQueue.getWaitingCount(),
      this.taskQueue.getActiveCount(),
      this.taskQueue.getCompletedCount(),
      this.taskQueue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }
}

export const orchestrator = new AgentOrchestrator();
