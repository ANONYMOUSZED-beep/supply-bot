/**
 * Strategist Agent Runner
 * Standalone process for running the Strategist Agent
 */

import { strategistAgent } from './index.js';
import { prisma, connectDatabase, disconnectDatabase } from '../../database/client.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

async function runStrategist() {
  logger.info('Starting Strategist Agent Runner');

  await connectDatabase();
  await strategistAgent.initialize();

  // Get all organizations
  const organizations = await prisma.organization.findMany();

  // Run initial analysis for each organization
  for (const org of organizations) {
    logger.info(`Running analysis for organization: ${org.name}`);

    // Analyze inventory
    await strategistAgent.executeTask({
      id: `inventory-${org.id}`,
      type: 'analyze_inventory',
      payload: { organizationId: org.id },
      priority: 1,
      scheduledAt: new Date(),
    });

    // Predict stockouts
    await strategistAgent.executeTask({
      id: `stockout-${org.id}`,
      type: 'predict_stockouts',
      payload: { organizationId: org.id },
      priority: 1,
      scheduledAt: new Date(),
    });

    // Generate reorder suggestions
    await strategistAgent.executeTask({
      id: `reorder-${org.id}`,
      type: 'generate_reorder_suggestions',
      payload: { organizationId: org.id },
      priority: 1,
      scheduledAt: new Date(),
    });
  }

  // Set up periodic analysis
  const intervalMs = config.agents.strategist.analysisInterval * 60 * 1000;

  setInterval(async () => {
    logger.info('Starting scheduled inventory analysis');

    const orgs = await prisma.organization.findMany();
    
    for (const org of orgs) {
      await strategistAgent.executeTask({
        id: `scheduled-${org.id}-${Date.now()}`,
        type: 'analyze_inventory',
        payload: { organizationId: org.id },
        priority: 5,
        scheduledAt: new Date(),
      });

      await strategistAgent.executeTask({
        id: `stockout-${org.id}-${Date.now()}`,
        type: 'predict_stockouts',
        payload: { organizationId: org.id },
        priority: 5,
        scheduledAt: new Date(),
      });
    }
  }, intervalMs);

  // Handle shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    await strategistAgent.shutdown();
    await disconnectDatabase();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    await strategistAgent.shutdown();
    await disconnectDatabase();
    process.exit(0);
  });

  logger.info(`Strategist Agent running. Analyzing every ${config.agents.strategist.analysisInterval} minutes.`);
}

runStrategist().catch((error) => {
  logger.error('Strategist Agent failed to start', { error });
  process.exit(1);
});
