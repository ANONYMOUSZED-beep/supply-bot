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

// ==========================================
// Dashboard Routes
// ==========================================

app.get('/api/dashboard', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const orgId = req.user!.organizationId;

    const [
      inventoryStats,
      supplierCount,
      pendingNegotiations,
      recentOrders,
      lowStockItems,
      queueStatus,
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
      // Low stock items
      prisma.$queryRaw`
        SELECT i.*, p.sku, p.name 
        FROM "InventoryItem" i
        JOIN "Product" p ON i."productId" = p.id
        WHERE i."organizationId" = ${orgId}
        AND i."currentStock" <= i."reorderPoint"
        ORDER BY i."currentStock" / i."reorderPoint" ASC
        LIMIT 10
      `,
      // Queue status
      orchestrator.getQueueStatus(),
    ]);

    res.json({
      inventory: {
        totalItems: inventoryStats._count,
        totalStock: inventoryStats._sum.currentStock,
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

// ==========================================
// Supplier Routes
// ==========================================

app.get('/api/suppliers', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { organizationId: req.user!.organizationId },
      include: {
        _count: { select: { supplierProducts: true, purchaseOrders: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json(suppliers);
  } catch (error) {
    logger.error('Get suppliers error', { error });
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
    const { supplierId, items } = req.body;

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

    res.json(order);
  } catch (error) {
    logger.error('Create order error', { error });
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
    const [scoutHealth, strategistHealth, diplomatHealth, queueStatus] = await Promise.all([
      scoutAgent.healthCheck(),
      strategistAgent.healthCheck(),
      diplomatAgent.healthCheck(),
      orchestrator.getQueueStatus(),
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
