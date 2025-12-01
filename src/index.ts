/**
 * Supply-Bot Main Entry Point
 * Autonomous Procurement Agent for SMB Custom Manufacturing
 */

import { startServer, stopServer } from './api/server.js';
import { logger } from './utils/logger.js';
import { AgentOrchestrator } from './services/orchestrator.js';
import { config } from './config/index.js';
import { prisma } from './database/client.js';

// Global orchestrator instance
let orchestrator: AgentOrchestrator | null = null;

async function main() {
  const port = process.env.PORT || config.port || 3001;
  
  logger.info('='.repeat(60));
  logger.info('🤖 Supply-Bot - Autonomous Procurement Agent');
  logger.info('='.repeat(60));
  logger.info(`Environment: ${config.environment}`);
  logger.info(`API Port: ${port}`);
  
  try {
    // Test database connection
    logger.info('Connecting to database...');
    await prisma.$connect();
    logger.info('✅ Database connected');
    
    // Start API server FIRST (so port is detected)
    logger.info('Starting API server...');
    await startServer();
    logger.info(`✅ API server running on port ${port}`);
    
    // Initialize agent orchestrator (non-blocking, allow failures)
    logger.info('Initializing agent orchestrator...');
    try {
      orchestrator = new AgentOrchestrator();
      await orchestrator.initialize();
      logger.info('✅ Agent orchestrator started');
      
      // Log agent schedules
      logger.info('='.repeat(60));
      logger.info('📅 Agent Schedules:');
      logger.info('  - Scout Agent: Every 4 hours');
      logger.info('  - Strategist Agent: Daily at 6:00 AM');
      logger.info('  - Diplomat Agent: Every 30 minutes');
      logger.info('='.repeat(60));
    } catch (orchError) {
      logger.warn('Agent orchestrator failed to initialize (agents disabled)', { error: orchError });
      logger.info('API server will continue running without agents');
    }
    
    logger.info('🚀 Supply-Bot is fully operational!');
    logger.info('Press Ctrl+C to gracefully shutdown');
    
  } catch (error) {
    logger.error('Failed to start Supply-Bot', { error });
    await shutdown(1);
  }
}

async function shutdown(exitCode: number = 0) {
  logger.info('');
  logger.info('🛑 Shutting down Supply-Bot...');
  
  try {
    // Stop orchestrator first
    if (orchestrator) {
      logger.info('Stopping agent orchestrator...');
      await orchestrator.shutdown();
      logger.info('✅ Agent orchestrator stopped');
    }
    
    // Stop API server
    logger.info('Stopping API server...');
    await stopServer();
    logger.info('✅ API server stopped');
    
    // Disconnect from database
    logger.info('Disconnecting from database...');
    await prisma.$disconnect();
    logger.info('✅ Database disconnected');
    
    logger.info('👋 Supply-Bot shutdown complete');
  } catch (error) {
    logger.error('Error during shutdown', { error });
    exitCode = 1;
  }
  
  process.exit(exitCode);
}

// Handle graceful shutdown signals
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal');
  shutdown(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT signal');
  shutdown(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  shutdown(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  shutdown(1);
});

// Start the application
main();
