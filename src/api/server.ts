/**
 * Supply-Bot REST API
 * Main API server for the dashboard and external integrations
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import { prisma, connectDatabase } from '../database/client.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { orchestrator } from '../services/orchestrator.js';
import { scoutAgent } from '../agents/scout/index.js';
import { strategistAgent } from '../agents/strategist/index.js';
import { diplomatAgent } from '../agents/diplomat/index.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: config.api.corsOrigin }));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// Authentication middleware
interface AuthRequest extends Request {
  user?: { userId: string; organizationId: string; role: string };
}

function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, config.api.secret) as {
      userId: string;
      organizationId: string;
      role: string;
    };
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// ==========================================
// Authentication Routes
// ==========================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // In production, use bcrypt to compare passwords
    // For demo, we'll skip password verification

    const token = jwt.sign(
      {
        userId: user.id,
        organizationId: user.organizationId,
        role: user.role,
      },
      config.api.secret,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization: user.organization,
      },
    });
  } catch (error) {
    logger.error('Login error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, companyName } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create organization first
    const organization = await prisma.organization.create({
      data: {
        name: companyName,
        industry: 'Manufacturing',
        size: 'small',
        settings: {
          currency: 'USD',
          timezone: 'UTC',
          autoReorder: true,
        },
      },
    });

    // Create user (in production, hash the password with bcrypt)
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: password, // In production: await bcrypt.hash(password, 10)
        role: 'admin',
        organizationId: organization.id,
      },
      include: { organization: true },
    });

    // Create sample data for the new organization
    const sampleSupplier = await prisma.supplier.create({
      data: {
        organizationId: organization.id,
        name: 'Sample Supplier Co.',
        contactEmail: 'sales@samplesupplier.com',
        website: 'https://samplesupplier.com',
        category: 'General Supplies',
        isActive: true,
        reliability: 0.9,
      },
    });

    const sampleProduct = await prisma.product.create({
      data: {
        organizationId: organization.id,
        sku: 'SAMPLE-001',
        name: 'Sample Product',
        description: 'Your first tracked product',
        category: 'General',
        unit: 'units',
      },
    });

    await prisma.inventoryItem.create({
      data: {
        organizationId: organization.id,
        productId: sampleProduct.id,
        currentStock: 100,
        reorderPoint: 20,
        reorderQuantity: 50,
        safetyStock: 10,
      },
    });

    await prisma.supplierProduct.create({
      data: {
        supplierId: sampleSupplier.id,
        productId: sampleProduct.id,
        supplierSku: 'SUP-SAMPLE-001',
        unitPrice: 10.00,
        minOrderQty: 10,
        inStock: true,
      },
    });

    const token = jwt.sign(
      {
        userId: user.id,
        organizationId: user.organizationId,
        role: user.role,
      },
      config.api.secret,
      { expiresIn: '24h' }
    );

    logger.info(`New user registered: ${email} with sample data`);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organization: user.organization,
      },
    });
  } catch (error) {
    logger.error('Registration error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// Dashboard Routes
// ==========================================

app.get('/api/dashboard', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId;

    // Run queries in parallel for speed
    const [
      inventoryStats,
      supplierCount,
      pendingNegotiations,
      recentOrders,
      lowStockItems,
    ] = await Promise.all([
      // Inventory statistics
      prisma.inventoryItem.aggregate({
        where: { organizationId: orgId },
        _count: true,
        _sum: { currentStock: true },
      }),
      // Supplier count
      prisma.supplier.count({ where: { organizationId: orgId, isActive: true } }),
      // Pending negotiations
      prisma.negotiation.count({ 
        where: { organizationId: orgId, status: 'in_progress' } 
      }),
      // Recent orders
      prisma.purchaseOrder.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { supplier: true },
      }),
      // Low stock items - use Prisma query instead of raw SQL for better performance
      prisma.inventoryItem.findMany({
        where: {
          organizationId: orgId,
        },
        include: {
          product: {
            select: { sku: true, name: true },
          },
        },
        orderBy: { currentStock: 'asc' },
        take: 10,
      }).then(items => 
        items
          .filter(i => i.currentStock <= i.reorderPoint)
          .map(i => ({
            id: i.id,
            currentStock: i.currentStock,
            reorderPoint: i.reorderPoint,
            sku: i.product.sku,
            name: i.product.name,
          }))
      ),
    ]);

    // Get queue status separately (non-blocking) with timeout
    let queueStatus = { waiting: 0, active: 0, completed: 0, failed: 0 };
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 2000)
      );
      queueStatus = await Promise.race([
        orchestrator.getQueueStatus(),
        timeoutPromise,
      ]) as any;
    } catch {
      // Use default if orchestrator is slow
    }

    res.json({
      inventory: {
        totalItems: inventoryStats._count,
        totalStock: inventoryStats._sum.currentStock || 0,
      },
      suppliers: supplierCount,
      pendingNegotiations,
      recentOrders,
      lowStockItems,
      queueStatus,
    });
  } catch (error) {
    logger.error('Dashboard error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// Inventory Routes
// ==========================================

app.get('/api/inventory', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: { organizationId: req.user!.organizationId },
      include: {
        product: {
          include: {
            supplierProducts: {
              include: { supplier: true },
              orderBy: { unitPrice: 'asc' },
            },
          },
        },
      },
      orderBy: { currentStock: 'asc' },
    });

    res.json(items);
  } catch (error) {
    logger.error('Get inventory error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/inventory/analysis', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await strategistAgent.executeTask({
      id: `api-${Date.now()}`,
      type: 'analyze_inventory',
      payload: { organizationId: req.user!.organizationId },
      priority: 1,
      scheduledAt: new Date(),
    });

    res.json(result);
  } catch (error) {
    logger.error('Inventory analysis error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/inventory/predictions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const predictions = await prisma.stockoutPrediction.findMany({
      where: { isResolved: false },
      orderBy: { daysUntil: 'asc' },
      take: 20,
    });

    res.json(predictions);
  } catch (error) {
    logger.error('Get predictions error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update inventory item
app.put('/api/inventory/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { currentStock, reorderPoint, reorderQuantity, safetyStock } = req.body;

    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(currentStock !== undefined && { currentStock }),
        ...(reorderPoint !== undefined && { reorderPoint }),
        ...(reorderQuantity !== undefined && { reorderQuantity }),
        ...(safetyStock !== undefined && { safetyStock }),
      },
      include: {
        product: {
          include: {
            supplierProducts: {
              include: { supplier: true },
            },
          },
        },
      },
    });

    res.json(item);
  } catch (error) {
    logger.error('Update inventory error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create inventory item
app.post('/api/inventory', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { productId, currentStock, reorderPoint, reorderQuantity, safetyStock } = req.body;

    const item = await prisma.inventoryItem.create({
      data: {
        organizationId: req.user!.organizationId,
        productId,
        currentStock: currentStock || 0,
        reorderPoint: reorderPoint || 10,
        reorderQuantity: reorderQuantity || 50,
        safetyStock: safetyStock || 5,
      },
      include: {
        product: true,
      },
    });

    res.status(201).json(item);
  } catch (error) {
    logger.error('Create inventory error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// Supplier Routes
// ==========================================

// Products endpoints
app.get('/api/products', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { organizationId: req.user!.organizationId, isActive: true },
      include: {
        supplierProducts: {
          include: { supplier: true },
          orderBy: { unitPrice: 'asc' },
        },
        inventoryItem: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json(products);
  } catch (error) {
    logger.error('Get products error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/products', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { sku, name, description, category, unit } = req.body;

    if (!sku || !name) {
      return res.status(400).json({ error: 'SKU and name are required' });
    }

    const product = await prisma.product.create({
      data: {
        organizationId: req.user!.organizationId,
        sku,
        name,
        description: description || '',
        category: category || 'General',
        unit: unit || 'units',
      },
    });

    res.status(201).json(product);
  } catch (error) {
    logger.error('Create product error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/suppliers', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { organizationId: req.user!.organizationId },
      include: {
        _count: { select: { supplierProducts: true, purchaseOrders: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Map to frontend-expected format
    const mappedSuppliers = suppliers.map(s => ({
      ...s,
      rating: s.reliability || 0,
      portalType: s.category || 'static',
      lastScanned: s.lastScrapedAt?.toISOString() || null,
    }));

    res.json(mappedSuppliers);
  } catch (error) {
    logger.error('Get suppliers error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/suppliers', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name, website, contactEmail, contactPhone, portalType } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Supplier name is required' });
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        website: website || null,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        portalUrl: website || null,
        category: portalType || 'general',
        isActive: true,
        organizationId: req.user!.organizationId,
      },
      include: {
        _count: { select: { supplierProducts: true, purchaseOrders: true } },
      },
    });

    // Add portalType to response for frontend compatibility
    res.status(201).json({ ...supplier, portalType: portalType || 'static', rating: supplier.reliability || 0 });
  } catch (error) {
    logger.error('Create supplier error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/suppliers/:id/scan', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await scoutAgent.executeTask({
      id: `api-scan-${Date.now()}`,
      type: 'scan_supplier',
      payload: { supplierId: req.params.id },
      priority: 1,
      scheduledAt: new Date(),
    });

    res.json(result);
  } catch (error) {
    logger.error('Scan supplier error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/suppliers/:id/prices', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const priceHistory = await prisma.priceHistory.findMany({
      where: { supplierId: req.params.id },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });

    res.json(priceHistory);
  } catch (error) {
    logger.error('Get price history error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update supplier
app.put('/api/suppliers/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, website, contactEmail, contactPhone, isActive, portalType } = req.body;

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(website !== undefined && { website }),
        ...(contactEmail !== undefined && { contactEmail }),
        ...(contactPhone !== undefined && { contactPhone }),
        ...(isActive !== undefined && { isActive }),
        ...(portalType !== undefined && { category: portalType }),
      },
      include: {
        _count: { select: { supplierProducts: true, purchaseOrders: true } },
      },
    });

    res.json({ ...supplier, rating: supplier.reliability || 0, portalType: supplier.category || 'static' });
  } catch (error) {
    logger.error('Update supplier error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete supplier
app.delete('/api/suppliers/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await prisma.supplier.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ success: true, message: 'Supplier deactivated' });
  } catch (error) {
    logger.error('Delete supplier error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// Negotiation Routes
// ==========================================

app.get('/api/negotiations', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const negotiations = await prisma.negotiation.findMany({
      where: { organizationId: req.user!.organizationId },
      include: {
        supplier: true,
        messages: { orderBy: { sentAt: 'desc' }, take: 1 },
      },
      orderBy: { startedAt: 'desc' },
    });

    res.json(negotiations);
  } catch (error) {
    logger.error('Get negotiations error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/negotiations', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { supplierId, products } = req.body;

    const result = await diplomatAgent.executeTask({
      id: `api-negotiate-${Date.now()}`,
      type: 'initiate_negotiation',
      payload: {
        organizationId: req.user!.organizationId,
        supplierId,
        products,
      },
      priority: 1,
      scheduledAt: new Date(),
    });

    res.json(result);
  } catch (error) {
    logger.error('Start negotiation error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/negotiations/:id/respond', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { responseContent } = req.body;

    const result = await diplomatAgent.executeTask({
      id: `api-respond-${Date.now()}`,
      type: 'process_response',
      payload: {
        negotiationId: req.params.id,
        responseContent,
      },
      priority: 1,
      scheduledAt: new Date(),
    });

    res.json(result);
  } catch (error) {
    logger.error('Process response error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send negotiation message (for follow-ups)
app.post('/api/negotiations/:id/messages', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { message } = req.body;
    const { id } = req.params;

    // Create the message
    const negotiationMessage = await prisma.negotiationMessage.create({
      data: {
        negotiationId: id,
        direction: 'outbound',
        channel: 'email',
        subject: 'Follow-up',
        content: message,
        sentAt: new Date(),
      },
    });

    // Update negotiation last activity
    await prisma.negotiation.update({
      where: { id },
      data: { status: 'in_progress' },
    });

    res.status(201).json(negotiationMessage);
  } catch (error) {
    logger.error('Send negotiation message error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single negotiation with all messages
app.get('/api/negotiations/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const negotiation = await prisma.negotiation.findFirst({
      where: { 
        id: req.params.id,
        organizationId: req.user!.organizationId,
      },
      include: {
        supplier: true,
        messages: { orderBy: { sentAt: 'asc' } },
      },
    });

    if (!negotiation) {
      return res.status(404).json({ error: 'Negotiation not found' });
    }

    res.json(negotiation);
  } catch (error) {
    logger.error('Get negotiation error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// Purchase Order Routes
// ==========================================

app.get('/api/orders', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      where: { organizationId: req.user!.organizationId },
      include: {
        supplier: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(orders);
  } catch (error) {
    logger.error('Get orders error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/orders', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { supplierId, items, productId, quantity } = req.body;

    // Handle simple reorder from inventory page
    if (productId && quantity && !items) {
      // Find supplier for this product
      const supplierProduct = await prisma.supplierProduct.findFirst({
        where: { productId },
        include: { supplier: true, product: true },
        orderBy: { unitPrice: 'asc' },
      });

      if (!supplierProduct) {
        return res.status(400).json({ error: 'No supplier found for this product' });
      }

      const order = await prisma.purchaseOrder.create({
        data: {
          organizationId: req.user!.organizationId,
          supplierId: supplierProduct.supplierId,
          orderNumber: `PO-${Date.now()}`,
          status: 'pending',
          totalAmount: supplierProduct.unitPrice * quantity,
          items: {
            create: [{
              productSku: supplierProduct.product.sku,
              productName: supplierProduct.product.name,
              quantity,
              unitPrice: supplierProduct.unitPrice,
              totalPrice: supplierProduct.unitPrice * quantity,
            }],
          },
        },
        include: { items: true, supplier: true },
      });

      return res.status(201).json(order);
    }

    // Handle full order with items array
    if (!supplierId || !items || !items.length) {
      return res.status(400).json({ error: 'Supplier and items are required' });
    }

    const order = await prisma.purchaseOrder.create({
      data: {
        organizationId: req.user!.organizationId,
        supplierId,
        orderNumber: `PO-${Date.now()}`,
        status: 'draft',
        totalAmount: items.reduce((sum: number, i: any) => sum + i.quantity * i.unitPrice, 0),
        items: {
          create: items.map((item: any) => ({
            productSku: item.sku,
            productName: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
          })),
        },
      },
      include: { items: true },
    });

    res.status(201).json(order);
  } catch (error) {
    logger.error('Create order error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update order status
app.put('/api/orders/:id/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['draft', 'pending', 'approved', 'sent', 'confirmed', 'shipped', 'received', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await prisma.purchaseOrder.update({
      where: { id },
      data: { 
        status,
        ...(status === 'received' && { actualDelivery: new Date() }),
      },
      include: { supplier: true, items: true },
    });

    res.json(order);
  } catch (error) {
    logger.error('Update order status error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single order
app.get('/api/orders/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const order = await prisma.purchaseOrder.findFirst({
      where: { 
        id: req.params.id,
        organizationId: req.user!.organizationId,
      },
      include: { supplier: true, items: true },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    logger.error('Get order error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// Agent Control Routes
// ==========================================

app.post('/api/agents/run-cycle', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await orchestrator.runProcurementCycle(req.user!.organizationId);
    res.json({ success: true, message: 'Procurement cycle started' });
  } catch (error) {
    logger.error('Run cycle error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/agents/auto-reorder', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await orchestrator.autoReorder(req.user!.organizationId);
    res.json({ success: true, message: 'Auto-reorder process started' });
  } catch (error) {
    logger.error('Auto-reorder error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/agents/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Return fast response - don't wait for slow health checks
    const timeoutMs = 3000;
    const withTimeout = <T>(promise: Promise<T>, fallback: T): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>(resolve => setTimeout(() => resolve(fallback), timeoutMs))
      ]);

    const [scoutHealth, strategistHealth, diplomatHealth, queueStatus] = await Promise.all([
      withTimeout(scoutAgent.healthCheck(), false),
      withTimeout(strategistAgent.healthCheck(), false),
      withTimeout(diplomatAgent.healthCheck(), false),
      withTimeout(orchestrator.getQueueStatus(), { waiting: 0, active: 0, completed: 0, failed: 0 }),
    ]);

    res.json({
      agents: {
        scout: { healthy: scoutHealth },
        strategist: { healthy: strategistHealth },
        diplomat: { healthy: diplomatHealth },
      },
      queue: queueStatus,
    });
  } catch (error) {
    logger.error('Get status error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// Agent Test Routes
// ==========================================

// Test Scout Agent - analyze inventory for low stock
app.post('/api/agents/test/scout', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId;
    
    // Get suppliers to scan
    const suppliers = await prisma.supplier.findMany({
      where: { organizationId: orgId, isActive: true },
      take: 3,
    });

    if (suppliers.length === 0) {
      return res.json({
        agent: 'Scout',
        message: 'No suppliers found to scan. Add some suppliers first.',
        result: null,
      });
    }

    // Return supplier info that would be scanned
    res.json({
      agent: 'Scout',
      message: `Scout Agent ready to scan ${suppliers.length} supplier(s)`,
      suppliers: suppliers.map(s => ({
        id: s.id,
        name: s.name,
        website: s.website,
        hasApi: !!s.apiEndpoint,
        hasPortal: !!s.portalUrl,
        lastScraped: s.lastScrapedAt,
      })),
      note: 'Full scanning requires Playwright browser - works best locally',
    });
  } catch (error) {
    logger.error('Scout test error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test Strategist Agent - predict stockouts
app.post('/api/agents/test/strategist', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId;
    
    // Run strategist analysis
    const result = await strategistAgent.executeTask({
      id: `test-${Date.now()}`,
      type: 'predict_stockouts',
      payload: { organizationId: orgId },
      priority: 1,
      scheduledAt: new Date(),
    });

    res.json({
      agent: 'Strategist',
      message: result.success ? 'Analysis complete' : 'Analysis failed',
      result: result.success ? result.data : null,
      error: result.error,
    });
  } catch (error) {
    logger.error('Strategist test error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test Diplomat Agent - generate negotiation email
app.post('/api/agents/test/diplomat', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId;
    const { supplierId, productId } = req.body;

    // Get a supplier to negotiate with
    let supplier;
    if (supplierId) {
      supplier = await prisma.supplier.findFirst({
        where: { id: supplierId, organizationId: orgId },
      });
    } else {
      supplier = await prisma.supplier.findFirst({
        where: { organizationId: orgId, isActive: true },
        include: { supplierProducts: { take: 1, include: { product: true } } },
      });
    }

    if (!supplier) {
      return res.json({
        agent: 'Diplomat',
        message: 'No suppliers found. Add suppliers first.',
        result: null,
      });
    }

    // Get a product to negotiate
    const supplierProduct = await prisma.supplierProduct.findFirst({
      where: { supplierId: supplier.id },
      include: { product: true },
    });

    if (!supplierProduct) {
      return res.json({
        agent: 'Diplomat',
        message: `Supplier ${supplier.name} has no products. Link products to supplier first.`,
        result: null,
      });
    }

    // Generate a sample negotiation strategy using AI
    const result = await diplomatAgent.executeTask({
      id: `test-${Date.now()}`,
      type: 'analyze_negotiation_opportunity',
      payload: {
        organizationId: orgId,
        supplierId: supplier.id,
        productId: supplierProduct.productId,
        quantity: 100,
      },
      priority: 1,
      scheduledAt: new Date(),
    });

    res.json({
      agent: 'Diplomat',
      message: result.success ? 'Negotiation analysis complete' : 'Analysis requires more data',
      supplier: supplier.name,
      product: supplierProduct.product.name,
      result: result.success ? result.data : null,
      error: result.error,
    });
  } catch (error) {
    logger.error('Diplomat test error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Quick AI test - just test if Gemini is working
app.get('/api/agents/test/ai', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const testPrompt = "You are a supply chain assistant. Respond with a single sentence about the importance of supplier negotiations.";
    
    const genAI = new (await import('@google/generative-ai')).GoogleGenerativeAI(config.ai.geminiApiKey);
    const model = genAI.getGenerativeModel({ model: config.ai.geminiModel });
    
    const result = await model.generateContent(testPrompt);
    const response = await result.response;
    const text = response.text();

    res.json({
      success: true,
      model: config.ai.geminiModel,
      response: text,
    });
  } catch (error: any) {
    logger.error('AI test error', { error });
    res.status(500).json({ 
      success: false, 
      error: error.message || 'AI test failed',
    });
  }
});

// ==========================================
// Activity Log Routes
// ==========================================

app.get('/api/activity', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const activities = await prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: true },
    });

    res.json(activities);
  } catch (error) {
    logger.error('Get activity error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// Reorder Suggestions Routes
// ==========================================

app.get('/api/suggestions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const result = await strategistAgent.executeTask({
      id: `api-suggestions-${Date.now()}`,
      type: 'generate_reorder_suggestions',
      payload: { organizationId: req.user!.organizationId },
      priority: 1,
      scheduledAt: new Date(),
    });

    res.json(result);
  } catch (error) {
    logger.error('Get suggestions error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// Health Check
// ==========================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    name: 'Supply-Bot API',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      'GET /health',
      'POST /api/auth/login',
      'GET /api/inventory',
      'GET /api/suppliers',
      'GET /api/negotiations',
      'GET /api/orders',
      'GET /api/dashboard',
    ]
  });
});

// API root
app.get('/api', (req, res) => {
  res.json({ message: 'Supply-Bot API v1.0' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Server instance for graceful shutdown
let server: ReturnType<typeof app.listen> | null = null;

// Start server
export async function startServer() {
  await connectDatabase();

  const port = process.env.PORT || config.api.port || 3001;
  
  return new Promise<void>((resolve) => {
    server = app.listen(Number(port), '0.0.0.0', () => {
      logger.info(`API server running on port ${port}`);
      resolve();
    });
  });
}

// Stop server
export async function stopServer() {
  return new Promise<void>((resolve, reject) => {
    if (server) {
      server.close((err: Error | undefined) => {
        if (err) {
          reject(err);
        } else {
          server = null;
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

export { app };
