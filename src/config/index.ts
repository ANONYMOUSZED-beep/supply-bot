/**
 * Supply-Bot Configuration
 * Centralized configuration management with validation
 */

import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  // Environment
  environment: z.string().default('development'),
  port: z.number().default(3001),

  // Database
  database: z.object({
    url: z.string().url(),
    redisUrl: z.string(),
  }),

  // AI/LLM (Google Gemini)
  ai: z.object({
    geminiApiKey: z.string().min(1),
    geminiModel: z.string().default('gemini-2.0-flash'),
  }),

  // Email
  email: z.object({
    host: z.string(),
    port: z.number(),
    user: z.string(),
    pass: z.string(),
    from: z.string(),
    fromName: z.string(),
  }),

  // API
  api: z.object({
    port: z.number().default(3001),
    secret: z.string().min(32),
    corsOrigin: z.string(),
  }),

  // Agent Settings
  agents: z.object({
    scout: z.object({
      scanInterval: z.number().default(60),
      maxConcurrentScans: z.number().default(5),
    }),
    strategist: z.object({
      stockoutThresholdDays: z.number().default(14),
      analysisInterval: z.number().default(30),
    }),
    diplomat: z.object({
      maxNegotiationRounds: z.number().default(3),
      priceImprovementTarget: z.number().default(0.05),
    }),
  }),

  // Browser Automation
  browser: z.object({
    headless: z.boolean().default(true),
    timeout: z.number().default(30000),
  }),

  // Federation
  federation: z.object({
    enabled: z.boolean().default(false),
    apiUrl: z.string().optional(),
    orgId: z.string().optional(),
  }),

  // Logging
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    format: z.enum(['json', 'simple']).default('json'),
  }),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const config = {
    environment: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || process.env.API_PORT || '3001'),
    database: {
      url: process.env.DATABASE_URL || '',
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    ai: {
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    },
    email: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.EMAIL_FROM || '',
      fromName: process.env.EMAIL_FROM_NAME || 'Supply-Bot',
    },
    api: {
      port: parseInt(process.env.PORT || process.env.API_PORT || '3001'),
      secret: process.env.API_SECRET || 'development-secret-key-change-in-production',
      corsOrigin: process.env.API_CORS_ORIGIN || '*',
    },
    agents: {
      scout: {
        scanInterval: parseInt(process.env.SCOUT_SCAN_INTERVAL || '60'),
        maxConcurrentScans: parseInt(process.env.SCOUT_MAX_CONCURRENT_SCANS || '5'),
      },
      strategist: {
        stockoutThresholdDays: parseInt(process.env.STRATEGIST_STOCKOUT_THRESHOLD_DAYS || '14'),
        analysisInterval: parseInt(process.env.STRATEGIST_ANALYSIS_INTERVAL || '30'),
      },
      diplomat: {
        maxNegotiationRounds: parseInt(process.env.DIPLOMAT_MAX_NEGOTIATION_ROUNDS || '3'),
        priceImprovementTarget: parseFloat(process.env.DIPLOMAT_PRICE_IMPROVEMENT_TARGET || '0.05'),
      },
    },
    browser: {
      headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
      timeout: parseInt(process.env.PLAYWRIGHT_TIMEOUT || '30000'),
    },
    federation: {
      enabled: process.env.FEDERATION_ENABLED === 'true',
      apiUrl: process.env.FEDERATION_API_URL,
      orgId: process.env.FEDERATION_ORG_ID,
    },
    logging: {
      level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
      format: (process.env.LOG_FORMAT as 'json' | 'simple') || 'json',
    },
  };

  return configSchema.parse(config);
}

export const config = loadConfig();
