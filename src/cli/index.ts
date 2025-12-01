#!/usr/bin/env node
/**
 * Supply-Bot CLI
 * Command-line interface for manual agent control and debugging
 */

import { Command } from 'commander';
import { ScoutAgent } from '../agents/scout/index.js';
import { StrategistAgent } from '../agents/strategist/index.js';
import { DiplomatAgent } from '../agents/diplomat/index.js';
import { prisma } from '../database/client.js';
import { logger } from '../utils/logger.js';

const program = new Command();

program
  .name('supply-bot')
  .description('CLI for Supply-Bot Autonomous Procurement Agent')
  .version('1.0.0');

// ==========================================
// Scout Agent Commands
// ==========================================

const scout = program.command('scout').description('Scout agent commands');

scout
  .command('run')
  .description('Run a full scout scan for all suppliers')
  .option('-o, --org <orgId>', 'Organization ID')
  .action(async (options) => {
    try {
      console.log('🔍 Starting Scout Agent...');
      const agent = new ScoutAgent();
      
      await agent.executeTask({
        id: `cli-scout-${Date.now()}`,
        type: 'full_scan',
        payload: { organizationId: options.org },
        priority: 1,
        scheduledAt: new Date(),
      });
      
      console.log('✅ Scout scan completed');
    } catch (error) {
      console.error('❌ Scout scan failed:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

scout
  .command('scan-supplier <supplierId>')
  .description('Scan a specific supplier')
  .action(async (supplierId) => {
    try {
      console.log(`🔍 Scanning supplier ${supplierId}...`);
      const agent = new ScoutAgent();
      
      const result = await agent.executeTask({
        id: `cli-scout-${Date.now()}`,
        type: 'scan_supplier',
        payload: { supplierId },
        priority: 1,
        scheduledAt: new Date(),
      });
      
      console.log('✅ Scan result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('❌ Scan failed:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

// ==========================================
// Strategist Agent Commands
// ==========================================

const strategist = program.command('strategist').description('Strategist agent commands');

strategist
  .command('analyze')
  .description('Analyze inventory and generate predictions')
  .option('-o, --org <orgId>', 'Organization ID')
  .action(async (options) => {
    try {
      console.log('📊 Starting Strategist Agent analysis...');
      const agent = new StrategistAgent();
      
      const result = await agent.executeTask({
        id: `cli-strategist-${Date.now()}`,
        type: 'analyze_inventory',
        payload: { organizationId: options.org },
        priority: 1,
        scheduledAt: new Date(),
      });
      
      console.log('✅ Analysis complete');
      console.log('Predictions:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

strategist
  .command('suggestions')
  .description('Generate reorder suggestions')
  .option('-o, --org <orgId>', 'Organization ID')
  .action(async (options) => {
    try {
      console.log('💡 Generating reorder suggestions...');
      const agent = new StrategistAgent();
      
      const result = await agent.executeTask({
        id: `cli-strategist-${Date.now()}`,
        type: 'generate_reorder_suggestions',
        payload: { organizationId: options.org },
        priority: 1,
        scheduledAt: new Date(),
      });
      
      console.log('✅ Suggestions:');
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('❌ Failed to generate suggestions:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

// ==========================================
// Diplomat Agent Commands
// ==========================================

const diplomat = program.command('diplomat').description('Diplomat agent commands');

diplomat
  .command('negotiate')
  .description('Start a new negotiation')
  .requiredOption('-s, --supplier <supplierId>', 'Supplier ID')
  .requiredOption('-p, --products <json>', 'Products JSON array')
  .option('-o, --org <orgId>', 'Organization ID')
  .action(async (options) => {
    try {
      console.log('🤝 Starting negotiation...');
      const agent = new DiplomatAgent();
      
      const products = JSON.parse(options.products);
      
      const result = await agent.executeTask({
        id: `cli-diplomat-${Date.now()}`,
        type: 'initiate_negotiation',
        payload: {
          organizationId: options.org,
          supplierId: options.supplier,
          products,
        },
        priority: 1,
        scheduledAt: new Date(),
      });
      
      console.log('✅ Negotiation initiated');
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('❌ Negotiation failed:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

diplomat
  .command('process-responses')
  .description('Process pending email responses')
  .action(async () => {
    try {
      console.log('📧 Processing email responses...');
      const agent = new DiplomatAgent();
      
      const result = await agent.executeTask({
        id: `cli-diplomat-${Date.now()}`,
        type: 'process_responses',
        payload: {},
        priority: 1,
        scheduledAt: new Date(),
      });
      
      console.log('✅ Responses processed');
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('❌ Processing failed:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

// ==========================================
// Database Commands
// ==========================================

const db = program.command('db').description('Database commands');

db
  .command('seed')
  .description('Seed the database with sample data')
  .action(async () => {
    try {
      console.log('🌱 Seeding database...');
      const { seedDatabase } = await import('../database/seed.js');
      await seedDatabase();
      console.log('✅ Database seeded');
    } catch (error) {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

db
  .command('stats')
  .description('Show database statistics')
  .action(async () => {
    try {
      const [orgs, users, suppliers, products, orders, negotiations] = await Promise.all([
        prisma.organization.count(),
        prisma.user.count(),
        prisma.supplier.count(),
        prisma.product.count(),
        prisma.purchaseOrder.count(),
        prisma.negotiation.count(),
      ]);
      
      console.log('\n📊 Database Statistics:');
      console.log('━'.repeat(30));
      console.log(`Organizations: ${orgs}`);
      console.log(`Users:         ${users}`);
      console.log(`Suppliers:     ${suppliers}`);
      console.log(`Products:      ${products}`);
      console.log(`Orders:        ${orders}`);
      console.log(`Negotiations:  ${negotiations}`);
      console.log('━'.repeat(30));
    } catch (error) {
      console.error('❌ Failed to get stats:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

// ==========================================
// Status Commands
// ==========================================

program
  .command('status')
  .description('Show system status')
  .action(async () => {
    try {
      console.log('\n🤖 Supply-Bot Status');
      console.log('━'.repeat(40));
      
      // Check database
      try {
        await prisma.$queryRaw`SELECT 1`;
        console.log('✅ Database: Connected');
      } catch {
        console.log('❌ Database: Disconnected');
      }
      
      // Show agent health
      const scout = new ScoutAgent();
      const strategist = new StrategistAgent();
      const diplomat = new DiplomatAgent();
      
      console.log(`✅ Scout Agent: ${await scout.healthCheck() ? 'Healthy' : 'Unhealthy'}`);
      console.log(`✅ Strategist Agent: ${await strategist.healthCheck() ? 'Healthy' : 'Unhealthy'}`);
      console.log(`✅ Diplomat Agent: ${await diplomat.healthCheck() ? 'Healthy' : 'Unhealthy'}`);
      
      console.log('━'.repeat(40));
    } catch (error) {
      console.error('❌ Status check failed:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

// ==========================================
// Run Cycle Command
// ==========================================

program
  .command('run-cycle')
  .description('Run a full procurement cycle')
  .requiredOption('-o, --org <orgId>', 'Organization ID')
  .action(async (options) => {
    try {
      console.log('\n🔄 Starting Full Procurement Cycle');
      console.log('━'.repeat(40));
      
      // 1. Scout scan
      console.log('\n[1/3] 🔍 Running Scout Agent...');
      const scout = new ScoutAgent();
      await scout.executeTask({
        id: `cycle-scout-${Date.now()}`,
        type: 'full_scan',
        payload: { organizationId: options.org },
        priority: 1,
        scheduledAt: new Date(),
      });
      console.log('✅ Scout scan complete');
      
      // 2. Strategist analysis
      console.log('\n[2/3] 📊 Running Strategist Agent...');
      const strategist = new StrategistAgent();
      const predictions = await strategist.executeTask({
        id: `cycle-strategist-${Date.now()}`,
        type: 'analyze_inventory',
        payload: { organizationId: options.org },
        priority: 1,
        scheduledAt: new Date(),
      });
      console.log('✅ Inventory analysis complete');
      const predictionsData = predictions?.data as { predictions?: unknown[] } | undefined;
      console.log(`   Found ${predictionsData?.predictions?.length || 0} stockout risks`);
      
      // 3. Diplomat negotiations
      console.log('\n[3/3] 🤝 Running Diplomat Agent...');
      const diplomat = new DiplomatAgent();
      await diplomat.executeTask({
        id: `cycle-diplomat-${Date.now()}`,
        type: 'process_responses',
        payload: {},
        priority: 1,
        scheduledAt: new Date(),
      });
      console.log('✅ Negotiations processed');
      
      console.log('\n' + '━'.repeat(40));
      console.log('🎉 Procurement cycle complete!');
      console.log('━'.repeat(40));
    } catch (error) {
      console.error('❌ Cycle failed:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
    }
  });

// Parse and execute
program.parse();
