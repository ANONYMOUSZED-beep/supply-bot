/**
 * Database Seed Script
 * Creates sample data for development and testing
 */

import { prisma } from './client.js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

async function seed() {
  logger.info('Starting database seed...');

  // Create sample organization
  const org = await prisma.organization.create({
    data: {
      id: uuidv4(),
      name: 'Artisan Furniture Co.',
      industry: 'Furniture Manufacturing',
      size: 'small',
      settings: {
        currency: 'USD',
        timezone: 'America/New_York',
        autoReorder: true,
      },
    },
  });
  logger.info(`Created organization: ${org.name}`);

  // Create admin user
  const user = await prisma.user.create({
    data: {
      id: uuidv4(),
      email: 'admin@artisanfurniture.com',
      name: 'John Smith',
      role: 'admin',
      passwordHash: '$2b$10$placeholder', // In production, use bcrypt
      organizationId: org.id,
    },
  });
  logger.info(`Created user: ${user.email}`);

  // Create sample suppliers
  const suppliers = await Promise.all([
    prisma.supplier.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        name: 'Northern Lumber Co.',
        contactEmail: 'sales@northernlumber.com',
        website: 'https://northernlumber.com',
        category: 'Raw Materials',
        tier: 1,
        reliability: 0.95,
        avgLeadTime: 7,
        paymentTerms: 'Net 30',
      },
    }),
    prisma.supplier.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        name: 'Hardware Supply Direct',
        contactEmail: 'orders@hardwaresupply.com',
        website: 'https://hardwaresupply.com',
        portalUrl: 'https://portal.hardwaresupply.com',
        category: 'Hardware',
        tier: 1,
        reliability: 0.88,
        avgLeadTime: 3,
        paymentTerms: 'Net 15',
      },
    }),
    prisma.supplier.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        name: 'Premium Finishes Inc.',
        contactEmail: 'contact@premiumfinishes.com',
        website: 'https://premiumfinishes.com',
        category: 'Finishes & Paints',
        tier: 2,
        reliability: 0.82,
        avgLeadTime: 5,
        paymentTerms: 'Net 30',
      },
    }),
    prisma.supplier.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        name: 'Eco Lumber Solutions',
        contactEmail: 'sales@ecolumber.com',
        website: 'https://ecolumber.com',
        category: 'Raw Materials',
        tier: 2,
        reliability: 0.90,
        avgLeadTime: 10,
        paymentTerms: 'Net 45',
      },
    }),
  ]);
  logger.info(`Created ${suppliers.length} suppliers`);

  // Create sample products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        sku: 'WOOD-OAK-001',
        name: 'Oak Lumber 2x4x8',
        description: 'Premium white oak lumber, kiln-dried',
        category: 'Raw Materials',
        unit: 'board feet',
      },
    }),
    prisma.product.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        sku: 'WOOD-WALNUT-001',
        name: 'Walnut Lumber 2x4x8',
        description: 'American black walnut, kiln-dried',
        category: 'Raw Materials',
        unit: 'board feet',
      },
    }),
    prisma.product.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        sku: 'HW-SCREW-001',
        name: 'Wood Screws #8 x 2"',
        description: 'Stainless steel wood screws, flat head',
        category: 'Hardware',
        unit: 'box (100)',
      },
    }),
    prisma.product.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        sku: 'HW-HINGE-001',
        name: 'Cabinet Hinges (pair)',
        description: 'Soft-close cabinet hinges, nickel finish',
        category: 'Hardware',
        unit: 'pair',
      },
    }),
    prisma.product.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        sku: 'FIN-STAIN-001',
        name: 'Wood Stain - Dark Walnut',
        description: 'Oil-based wood stain, 1 gallon',
        category: 'Finishes',
        unit: 'gallon',
      },
    }),
    prisma.product.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        sku: 'FIN-POLY-001',
        name: 'Polyurethane Clear Coat',
        description: 'Water-based polyurethane, satin finish, 1 gallon',
        category: 'Finishes',
        unit: 'gallon',
      },
    }),
  ]);
  logger.info(`Created ${products.length} products`);

  // Create inventory items
  const inventoryItems = await Promise.all([
    prisma.inventoryItem.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        productId: products[0].id,
        currentStock: 250,
        reorderPoint: 100,
        reorderQuantity: 200,
        safetyStock: 50,
        avgDailyUsage: 15,
        location: 'Warehouse A - Section 1',
      },
    }),
    prisma.inventoryItem.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        productId: products[1].id,
        currentStock: 80,
        reorderPoint: 50,
        reorderQuantity: 100,
        safetyStock: 25,
        avgDailyUsage: 8,
        location: 'Warehouse A - Section 2',
      },
    }),
    prisma.inventoryItem.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        productId: products[2].id,
        currentStock: 45,
        reorderPoint: 20,
        reorderQuantity: 50,
        safetyStock: 10,
        avgDailyUsage: 5,
        location: 'Warehouse B - Hardware',
      },
    }),
    prisma.inventoryItem.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        productId: products[3].id,
        currentStock: 120,
        reorderPoint: 50,
        reorderQuantity: 100,
        safetyStock: 20,
        avgDailyUsage: 4,
        location: 'Warehouse B - Hardware',
      },
    }),
    prisma.inventoryItem.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        productId: products[4].id,
        currentStock: 12,
        reorderPoint: 10,
        reorderQuantity: 20,
        safetyStock: 5,
        avgDailyUsage: 1.5,
        location: 'Warehouse C - Finishes',
      },
    }),
    prisma.inventoryItem.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        productId: products[5].id,
        currentStock: 8,
        reorderPoint: 8,
        reorderQuantity: 15,
        safetyStock: 3,
        avgDailyUsage: 1,
        location: 'Warehouse C - Finishes',
      },
    }),
  ]);
  logger.info(`Created ${inventoryItems.length} inventory items`);

  // Create supplier products (linking suppliers to products with pricing)
  await Promise.all([
    // Northern Lumber - Oak
    prisma.supplierProduct.create({
      data: {
        id: uuidv4(),
        supplierId: suppliers[0].id,
        productId: products[0].id,
        supplierSku: 'NL-OAK-2X4X8',
        unitPrice: 8.50,
        minOrderQty: 50,
        leadTime: 7,
        inStock: true,
        stockLevel: 5000,
      },
    }),
    // Northern Lumber - Walnut
    prisma.supplierProduct.create({
      data: {
        id: uuidv4(),
        supplierId: suppliers[0].id,
        productId: products[1].id,
        supplierSku: 'NL-WAL-2X4X8',
        unitPrice: 14.75,
        minOrderQty: 25,
        leadTime: 10,
        inStock: true,
        stockLevel: 2000,
      },
    }),
    // Eco Lumber - Oak (alternative)
    prisma.supplierProduct.create({
      data: {
        id: uuidv4(),
        supplierId: suppliers[3].id,
        productId: products[0].id,
        supplierSku: 'ECO-OAK-8FT',
        unitPrice: 9.25,
        minOrderQty: 100,
        leadTime: 10,
        inStock: true,
        stockLevel: 3000,
      },
    }),
    // Hardware Supply - Screws
    prisma.supplierProduct.create({
      data: {
        id: uuidv4(),
        supplierId: suppliers[1].id,
        productId: products[2].id,
        supplierSku: 'HS-WS-8X2',
        unitPrice: 12.99,
        minOrderQty: 10,
        leadTime: 3,
        inStock: true,
        stockLevel: 500,
      },
    }),
    // Hardware Supply - Hinges
    prisma.supplierProduct.create({
      data: {
        id: uuidv4(),
        supplierId: suppliers[1].id,
        productId: products[3].id,
        supplierSku: 'HS-CH-SC',
        unitPrice: 8.50,
        minOrderQty: 20,
        leadTime: 3,
        inStock: true,
        stockLevel: 800,
      },
    }),
    // Premium Finishes - Stain
    prisma.supplierProduct.create({
      data: {
        id: uuidv4(),
        supplierId: suppliers[2].id,
        productId: products[4].id,
        supplierSku: 'PF-STN-DW-1G',
        unitPrice: 45.00,
        minOrderQty: 4,
        leadTime: 5,
        inStock: true,
        stockLevel: 100,
      },
    }),
    // Premium Finishes - Polyurethane
    prisma.supplierProduct.create({
      data: {
        id: uuidv4(),
        supplierId: suppliers[2].id,
        productId: products[5].id,
        supplierSku: 'PF-POLY-SAT-1G',
        unitPrice: 52.00,
        minOrderQty: 4,
        leadTime: 5,
        inStock: false, // Out of stock!
        stockLevel: 0,
      },
    }),
  ]);
  logger.info('Created supplier-product relationships');

  // Create a sample BOM for a dining table
  const bom = await prisma.bOM.create({
    data: {
      id: uuidv4(),
      organizationId: org.id,
      name: 'Dining Table - 6 Seater',
      description: 'Standard 6-seater dining table with oak top',
      version: '1.0',
    },
  });

  await Promise.all([
    prisma.bOMItem.create({
      data: {
        id: uuidv4(),
        bomId: bom.id,
        productId: products[0].id,
        quantity: 40,
        unit: 'board feet',
        notes: 'For table top and legs',
      },
    }),
    prisma.bOMItem.create({
      data: {
        id: uuidv4(),
        bomId: bom.id,
        productId: products[2].id,
        quantity: 2,
        unit: 'box (100)',
        notes: 'Assembly screws',
      },
    }),
    prisma.bOMItem.create({
      data: {
        id: uuidv4(),
        bomId: bom.id,
        productId: products[4].id,
        quantity: 0.5,
        unit: 'gallon',
        notes: 'Staining',
      },
    }),
    prisma.bOMItem.create({
      data: {
        id: uuidv4(),
        bomId: bom.id,
        productId: products[5].id,
        quantity: 1,
        unit: 'gallon',
        notes: 'Top coat finish',
      },
    }),
  ]);
  logger.info(`Created BOM: ${bom.name}`);

  // Create a sample cooperative
  const cooperative = await prisma.cooperative.create({
    data: {
      id: uuidv4(),
      name: 'Northeast Furniture Makers Alliance',
      description: 'A cooperative of small furniture manufacturers in the Northeast US',
      industry: 'Furniture Manufacturing',
      memberCount: 47,
      settings: {
        minMembershipDuration: 90,
        anonymizeData: true,
        bulkOrderThreshold: 10000,
      },
    },
  });
  logger.info(`Created cooperative: ${cooperative.name}`);

  // Create sample purchase orders
  const orders = await Promise.all([
    prisma.purchaseOrder.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        supplierId: suppliers[0].id,
        orderNumber: 'PO-2024-001',
        status: 'received',
        totalAmount: 2125.00,
        notes: 'Monthly lumber restock',
      },
    }),
    prisma.purchaseOrder.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        supplierId: suppliers[0].id,
        orderNumber: 'PO-2024-002',
        status: 'shipped',
        totalAmount: 1475.00,
        notes: 'Walnut for custom order',
      },
    }),
    prisma.purchaseOrder.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        supplierId: suppliers[1].id,
        orderNumber: 'PO-2024-003',
        status: 'confirmed',
        totalAmount: 389.70,
        notes: 'Hardware restocking',
      },
    }),
    prisma.purchaseOrder.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        supplierId: suppliers[2].id,
        orderNumber: 'PO-2024-004',
        status: 'pending',
        totalAmount: 520.00,
        notes: 'Finish supplies - urgent',
      },
    }),
    prisma.purchaseOrder.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        supplierId: suppliers[1].id,
        orderNumber: 'PO-2024-005',
        status: 'received',
        totalAmount: 850.00,
        notes: 'Hinges bulk order',
      },
    }),
  ]);
  logger.info(`Created ${orders.length} purchase orders`);

  // Create order items for each order
  await Promise.all([
    prisma.purchaseOrderItem.create({
      data: {
        id: uuidv4(),
        purchaseOrderId: orders[0].id,
        productSku: products[0].sku,
        productName: products[0].name,
        quantity: 250,
        unitPrice: 8.50,
        totalPrice: 2125.00,
      },
    }),
    prisma.purchaseOrderItem.create({
      data: {
        id: uuidv4(),
        purchaseOrderId: orders[1].id,
        productSku: products[1].sku,
        productName: products[1].name,
        quantity: 100,
        unitPrice: 14.75,
        totalPrice: 1475.00,
      },
    }),
    prisma.purchaseOrderItem.create({
      data: {
        id: uuidv4(),
        purchaseOrderId: orders[2].id,
        productSku: products[2].sku,
        productName: products[2].name,
        quantity: 30,
        unitPrice: 12.99,
        totalPrice: 389.70,
      },
    }),
    prisma.purchaseOrderItem.create({
      data: {
        id: uuidv4(),
        purchaseOrderId: orders[3].id,
        productSku: products[4].sku,
        productName: products[4].name,
        quantity: 8,
        unitPrice: 45.00,
        totalPrice: 360.00,
      },
    }),
    prisma.purchaseOrderItem.create({
      data: {
        id: uuidv4(),
        purchaseOrderId: orders[3].id,
        productSku: products[5].sku,
        productName: products[5].name,
        quantity: 4,
        unitPrice: 40.00,
        totalPrice: 160.00,
      },
    }),
    prisma.purchaseOrderItem.create({
      data: {
        id: uuidv4(),
        purchaseOrderId: orders[4].id,
        productSku: products[3].sku,
        productName: products[3].name,
        quantity: 100,
        unitPrice: 8.50,
        totalPrice: 850.00,
      },
    }),
  ]);
  logger.info('Created order items');

  // Create sample negotiations
  const negotiations = await Promise.all([
    prisma.negotiation.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        supplierId: suppliers[0].id,
        type: 'price',
        status: 'accepted',
        initialOffer: { price: 8.00, quantity: 500, product: 'Oak Lumber' },
        finalTerms: { price: 8.50, quantity: 500, discount: '5.5%' },
        savings: 250.00,
        startedAt: new Date('2024-10-15'),
        completedAt: new Date('2024-10-18'),
      },
    }),
    prisma.negotiation.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        supplierId: suppliers[1].id,
        type: 'volume',
        status: 'accepted',
        initialOffer: { price: 7.50, quantity: 200, product: 'Cabinet Hinges' },
        finalTerms: { price: 8.50, quantity: 200, discount: '10.5%' },
        savings: 200.00,
        startedAt: new Date('2024-11-01'),
        completedAt: new Date('2024-11-05'),
      },
    }),
    prisma.negotiation.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        supplierId: suppliers[2].id,
        type: 'price',
        status: 'in_progress',
        initialOffer: { price: 40.00, quantity: 24, product: 'Wood Stain' },
        startedAt: new Date('2024-11-25'),
      },
    }),
    prisma.negotiation.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        supplierId: suppliers[0].id,
        type: 'price',
        status: 'in_progress',
        initialOffer: { price: 13.00, quantity: 150, product: 'Walnut Lumber' },
        startedAt: new Date('2024-11-27'),
      },
    }),
    prisma.negotiation.create({
      data: {
        id: uuidv4(),
        organizationId: org.id,
        supplierId: suppliers[3].id,
        type: 'volume',
        status: 'pending',
        initialOffer: { price: 8.25, quantity: 300, product: 'Oak Lumber' },
        startedAt: new Date('2024-11-28'),
      },
    }),
  ]);
  logger.info(`Created ${negotiations.length} negotiations`);

  // Create price history for analytics
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    
    await Promise.all([
      prisma.priceHistory.create({
        data: {
          id: uuidv4(),
          supplierId: suppliers[0].id,
          productSku: products[0].sku,
          price: 8.50 + (Math.random() - 0.5) * 1.5,
          source: 'scraped',
          recordedAt: date,
        },
      }),
      prisma.priceHistory.create({
        data: {
          id: uuidv4(),
          supplierId: suppliers[0].id,
          productSku: products[1].sku,
          price: 14.75 + (Math.random() - 0.5) * 2,
          source: 'scraped',
          recordedAt: date,
        },
      }),
      prisma.priceHistory.create({
        data: {
          id: uuidv4(),
          supplierId: suppliers[1].id,
          productSku: products[2].sku,
          price: 12.99 + (Math.random() - 0.5) * 1,
          source: 'scraped',
          recordedAt: date,
        },
      }),
    ]);
  }
  logger.info('Created price history');

  // Create agent activity logs
  await Promise.all([
    prisma.activityLog.create({
      data: {
        id: uuidv4(),
        agentType: 'scout',
        action: 'price_scan',
        details: { supplier: 'Northern Lumber Co.', productsScanned: 12, status: 'success' },
      },
    }),
    prisma.activityLog.create({
      data: {
        id: uuidv4(),
        agentType: 'scout',
        action: 'price_scan',
        details: { supplier: 'Hardware Supply Direct', productsScanned: 8, status: 'success' },
      },
    }),
    prisma.activityLog.create({
      data: {
        id: uuidv4(),
        agentType: 'strategist',
        action: 'reorder_analysis',
        details: { itemsAnalyzed: 6, reorderRecommendations: 2, status: 'success' },
      },
    }),
    prisma.activityLog.create({
      data: {
        id: uuidv4(),
        agentType: 'diplomat',
        action: 'negotiation_email',
        details: { supplier: 'Premium Finishes Inc.', type: 'initial_offer', status: 'success' },
      },
    }),
    prisma.activityLog.create({
      data: {
        id: uuidv4(),
        agentType: 'diplomat',
        action: 'negotiation_email',
        details: { supplier: 'Northern Lumber Co.', type: 'counter_offer', discount: '5%', status: 'success' },
      },
    }),
  ]);
  logger.info('Created agent activity logs');

  logger.info('Database seed completed successfully!');
}

// Export for CLI usage
export { seed as seedDatabase };

// Run directly if this is the main module
const isMainModule = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;
if (isMainModule) {
  seed()
    .catch((e) => {
      logger.error('Seed failed', { error: e });
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
