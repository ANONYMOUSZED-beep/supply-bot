/**
 * Scout Agent Runner
 * Standalone process for running the Scout Agent
 */

import { scoutAgent } from './index.js';
import { prisma, connectDatabase, disconnectDatabase } from '../../database/client.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

async function runScout() {
  logger.info('Starting Scout Agent Runner');

  await connectDatabase();
  await scoutAgent.initialize();

  // Run initial scan
  const result = await scoutAgent.executeTask({
    id: 'startup-scan',
    type: 'scan_all_suppliers',
    payload: {},
    priority: 1,
    scheduledAt: new Date(),
  });

  logger.info('Initial scan complete', { result });

  // Set up periodic scanning
  const intervalMs = config.agents.scout.scanInterval * 60 * 1000;
  
  setInterval(async () => {
    logger.info('Starting scheduled supplier scan');
    
    await scoutAgent.executeTask({
      id: `scheduled-${Date.now()}`,
      type: 'scan_all_suppliers',
      payload: {},
      priority: 5,
      scheduledAt: new Date(),
    });
  }, intervalMs);

  // Handle shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    await scoutAgent.shutdown();
    await disconnectDatabase();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    await scoutAgent.shutdown();
    await disconnectDatabase();
    process.exit(0);
  });

  logger.info(`Scout Agent running. Scanning every ${config.agents.scout.scanInterval} minutes.`);
}

runScout().catch((error) => {
  logger.error('Scout Agent failed to start', { error });
  process.exit(1);
});
