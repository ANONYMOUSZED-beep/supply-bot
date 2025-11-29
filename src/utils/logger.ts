/**
 * Supply-Bot Logger
 * Winston-based logging with structured output
 */

import winston from 'winston';
import { config } from '../config/index.js';

const { combine, timestamp, json, simple, colorize, printf } = winston.format;

const simpleFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
  return `${timestamp} [${level}]: ${message} ${metaStr}`;
});

export const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    config.logging.format === 'json' ? json() : combine(colorize(), simpleFormat)
  ),
  defaultMeta: { service: 'supply-bot' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    }),
  ],
});

// Agent-specific loggers
export function createAgentLogger(agentName: string) {
  return logger.child({ agent: agentName });
}
