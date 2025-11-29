/**
 * Supply-Bot Database Client
 * Prisma client with connection handling
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Log database events
prisma.$on('query' as never, (e: { query: string; duration: number }) => {
  logger.debug('Database query', { query: e.query, duration: `${e.duration}ms` });
});

prisma.$on('error' as never, (e: { message: string }) => {
  logger.error('Database error', { error: e.message });
});

export async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    throw error;
  }
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
