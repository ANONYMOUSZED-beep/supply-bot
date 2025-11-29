/**
 * Diplomat Agent Runner
 * Standalone process for running the Diplomat Agent
 */

import { diplomatAgent } from './index.js';
import { prisma, connectDatabase, disconnectDatabase } from '../../database/client.js';
import { logger } from '../../utils/logger.js';

async function runDiplomat() {
  logger.info('Starting Diplomat Agent Runner');

  await connectDatabase();
  await diplomatAgent.initialize();

  // Process pending negotiations
  const pendingNegotiations = await prisma.negotiation.findMany({
    where: { status: 'in_progress' },
    include: {
      messages: { orderBy: { sentAt: 'desc' }, take: 1 },
      supplier: true,
    },
  });

  logger.info(`Found ${pendingNegotiations.length} active negotiations`);

  // Check for expired negotiations
  const now = new Date();
  for (const negotiation of pendingNegotiations) {
    if (negotiation.expiresAt && negotiation.expiresAt < now) {
      await prisma.negotiation.update({
        where: { id: negotiation.id },
        data: { status: 'expired', completedAt: now },
      });
      logger.info(`Negotiation ${negotiation.id} expired`);
    }
  }

  // In production, this would integrate with email receiving
  // For now, we just keep the agent running to handle incoming tasks
  logger.info('Diplomat Agent running. Waiting for negotiation tasks...');

  // Handle shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    await diplomatAgent.shutdown();
    await disconnectDatabase();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    await diplomatAgent.shutdown();
    await disconnectDatabase();
    process.exit(0);
  });

  // Keep process alive
  setInterval(() => {
    // Periodic check for stale negotiations
  }, 60000);
}

runDiplomat().catch((error) => {
  logger.error('Diplomat Agent failed to start', { error });
  process.exit(1);
});
