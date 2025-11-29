/**
 * Diplomat Agent - Autonomous Negotiation Engine
 * Handles supplier negotiations via email and generates professional communication
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import nodemailer from 'nodemailer';
import { prisma } from '../../database/client.js';
import { createAgentLogger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import { BaseAgent, AgentTask, AgentResult, NegotiationOffer } from '../types.js';

const logger = createAgentLogger('diplomat');

interface NegotiationContext {
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  organizationName: string;
  products: Array<{
    sku: string;
    name: string;
    quantity: number;
    currentPrice: number;
    targetPrice: number;
    competitorPrice?: number;
  }>;
  historicalVolume?: number;
  relationshipDuration?: string;
  previousSavings?: number;
}

interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

interface NegotiationStrategy {
  approach: 'competitive' | 'collaborative' | 'volume_leverage' | 'urgency';
  initialDiscount: number;
  maxRounds: number;
  fallbackAction: 'accept' | 'walk_away' | 'escalate';
  talkingPoints: string[];
}

export class DiplomatAgent extends BaseAgent {
  readonly name = 'Diplomat Agent';
  readonly version = '1.0.0';

  private genAI: GoogleGenerativeAI;
  private model: any;
  private emailTransporter: nodemailer.Transporter;
  private readonly maxRounds = config.agents.diplomat.maxNegotiationRounds;
  private readonly targetImprovement = config.agents.diplomat.priceImprovementTarget;

  constructor() {
    super();
    // Google Gemini AI
    this.genAI = new GoogleGenerativeAI(config.ai.geminiApiKey);
    this.model = this.genAI.getGenerativeModel({ model: config.ai.geminiModel });

    // Configure email transporter - handles both MailHog (dev) and real SMTP (prod)
    const transportConfig: any = {
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
    };

    // Only add auth if credentials are provided (not needed for MailHog)
    if (config.email.user && config.email.pass) {
      transportConfig.auth = {
        user: config.email.user,
        pass: config.email.pass,
      };
    }

    this.emailTransporter = nodemailer.createTransport(transportConfig);
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Diplomat Agent...');
    
    // Verify email connection
    try {
      await this.emailTransporter.verify();
      logger.info('Email connection verified');
    } catch (error) {
      logger.warn('Email connection could not be verified', { error });
    }

    logger.info('Diplomat Agent initialized successfully');
  }

  // Helper method for Gemini AI calls
  private async generateAIResponse(systemPrompt: string, userPrompt: string, temperature: number = 0.7): Promise<string> {
    const prompt = `${systemPrompt}\n\n${userPrompt}`;
    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    return response.text() || '';
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Diplomat Agent...');
    this.emailTransporter.close();
    logger.info('Diplomat Agent shut down');
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async executeTask(task: AgentTask): Promise<AgentResult> {
    logger.info(`Executing task: ${task.type}`, { taskId: task.id });

    switch (task.type) {
      case 'initiate_negotiation':
        return this.initiateNegotiation(task.payload as {
          organizationId: string;
          supplierId: string;
          products: Array<{ productId: string; quantity: number; targetPrice?: number }>;
        });

      case 'process_response':
        return this.processNegotiationResponse(task.payload as {
          negotiationId: string;
          responseContent: string;
        });

      case 'request_quote':
        return this.requestQuote(task.payload as {
          organizationId: string;
          supplierId: string;
          products: Array<{ productId: string; quantity: number }>;
        });

      case 'negotiate_bulk_order':
        return this.negotiateBulkOrder(task.payload as {
          organizationId: string;
          products: Array<{ productId: string; quantity: number }>;
        });

      case 'expedite_order':
        return this.expediteOrder(task.payload as {
          purchaseOrderId: string;
          reason: string;
          urgency: 'high' | 'critical';
        });

      default:
        return { success: false, error: `Unknown task type: ${task.type}` };
    }
  }

  /**
   * Initiate a new price negotiation with a supplier
   */
  async initiateNegotiation(payload: {
    organizationId: string;
    supplierId: string;
    products: Array<{ productId: string; quantity: number; targetPrice?: number }>;
  }): Promise<AgentResult> {
    try {
      const [organization, supplier] = await Promise.all([
        prisma.organization.findUnique({ where: { id: payload.organizationId } }),
        prisma.supplier.findUnique({
          where: { id: payload.supplierId },
          include: {
            supplierProducts: {
              include: { product: true },
            },
          },
        }),
      ]);

      if (!organization || !supplier) {
        return { success: false, error: 'Organization or supplier not found' };
      }

      if (!supplier.contactEmail) {
        return { success: false, error: 'Supplier has no contact email' };
      }

      // Build negotiation context
      const products = payload.products.map(p => {
        const supplierProduct = supplier.supplierProducts.find(
          (sp: any) => sp.productId === p.productId
        );
        
        return {
          sku: supplierProduct?.supplierSku || '',
          name: supplierProduct?.product.name || '',
          quantity: p.quantity,
          currentPrice: supplierProduct?.unitPrice || 0,
          targetPrice: p.targetPrice || (supplierProduct?.unitPrice || 0) * (1 - this.targetImprovement),
        };
      });

      // Calculate historical volume
      const historicalOrders = await prisma.purchaseOrder.findMany({
        where: {
          organizationId: payload.organizationId,
          supplierId: payload.supplierId,
          status: { in: ['received', 'shipped', 'confirmed'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
      });

      const historicalVolume = historicalOrders.reduce((sum, o) => sum + o.totalAmount, 0);

      const context: NegotiationContext = {
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierEmail: supplier.contactEmail,
        organizationName: organization.name,
        products,
        historicalVolume,
      };

      // Determine negotiation strategy
      const strategy = this.determineStrategy(context);

      // Generate initial negotiation email
      const email = await this.generateNegotiationEmail(context, strategy, 1);

      // Create negotiation record
      const negotiation = await prisma.negotiation.create({
        data: {
          organizationId: payload.organizationId,
          supplierId: payload.supplierId,
          type: 'price',
          status: 'in_progress',
          initialOffer: {
            products,
            targetSavings: this.targetImprovement,
            strategy: strategy.approach,
          },
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          metadata: { strategy },
        },
      });

      // Send email
      await this.sendEmail(email);

      // Log the message
      await prisma.negotiationMessage.create({
        data: {
          negotiationId: negotiation.id,
          direction: 'outbound',
          channel: 'email',
          subject: email.subject,
          content: email.body,
          metadata: { to: email.to },
          sentAt: new Date(),
        },
      });

      logger.info(`Initiated negotiation with ${supplier.name}`, {
        negotiationId: negotiation.id,
        products: products.length,
        strategy: strategy.approach,
      });

      return {
        success: true,
        data: {
          negotiationId: negotiation.id,
          strategy: strategy.approach,
          emailSent: true,
        },
      };
    } catch (error) {
      logger.error('Failed to initiate negotiation', { error });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Process a supplier's response to a negotiation
   */
  async processNegotiationResponse(payload: {
    negotiationId: string;
    responseContent: string;
  }): Promise<AgentResult> {
    try {
      const negotiation = await prisma.negotiation.findUnique({
        where: { id: payload.negotiationId },
        include: {
          supplier: true,
          organization: true,
          messages: { orderBy: { sentAt: 'desc' } },
        },
      });

      if (!negotiation) {
        return { success: false, error: 'Negotiation not found' };
      }

      // Record incoming message
      await prisma.negotiationMessage.create({
        data: {
          negotiationId: negotiation.id,
          direction: 'inbound',
          channel: 'email',
          content: payload.responseContent,
        },
      });

      // Analyze response using AI
      const analysis = await this.analyzeResponse(payload.responseContent, negotiation);

      // Determine next action
      const round = negotiation.messages.filter(m => m.direction === 'outbound').length + 1;
      
      if (analysis.accepted) {
        // Supplier accepted our terms
        await prisma.negotiation.update({
          where: { id: negotiation.id },
          data: {
            status: 'accepted',
            finalTerms: analysis.terms,
            savings: analysis.savings,
            completedAt: new Date(),
          },
        });

        logger.info(`Negotiation accepted by ${negotiation.supplier.name}`, {
          negotiationId: negotiation.id,
          savings: analysis.savings,
        });

        return {
          success: true,
          data: {
            status: 'accepted',
            finalTerms: analysis.terms,
            savings: analysis.savings,
          },
        };
      } else if (analysis.rejected) {
        // Supplier rejected - check if we should try alternatives
        await prisma.negotiation.update({
          where: { id: negotiation.id },
          data: { status: 'rejected', completedAt: new Date() },
        });

        return {
          success: true,
          data: {
            status: 'rejected',
            reason: analysis.reason,
            suggestedAction: 'try_alternative_supplier',
          },
        };
      } else if (analysis.counterOffer && round < this.maxRounds) {
        // Counter-offer received - evaluate and respond
        const context: NegotiationContext = {
          supplierId: negotiation.supplierId,
          supplierName: negotiation.supplier.name,
          supplierEmail: negotiation.supplier.contactEmail || '',
          organizationName: negotiation.organization.name,
          products: (negotiation.initialOffer as any).products,
        };

        const initialOffer = negotiation.initialOffer as any;
        const strategy = (negotiation.metadata as any)?.strategy || this.determineStrategy(context);

        // Decide if counter-offer is acceptable
        const counterOfferAnalysis = this.evaluateCounterOffer(
          analysis.counterOffer,
          initialOffer.products,
          this.targetImprovement
        );

        if (counterOfferAnalysis.acceptable) {
          // Accept the counter-offer
          await prisma.negotiation.update({
            where: { id: negotiation.id },
            data: {
              status: 'accepted',
              finalTerms: analysis.counterOffer,
              savings: counterOfferAnalysis.actualSavings,
              completedAt: new Date(),
              counterOffers: [...(negotiation.counterOffers as any[] || []), analysis.counterOffer],
            },
          });

          // Send acceptance email
          const acceptanceEmail = await this.generateAcceptanceEmail(context, analysis.counterOffer);
          await this.sendEmail(acceptanceEmail);

          return {
            success: true,
            data: {
              status: 'accepted',
              finalTerms: analysis.counterOffer,
              savings: counterOfferAnalysis.actualSavings,
            },
          };
        } else {
          // Counter the counter-offer
          const responseEmail = await this.generateCounterEmail(
            context,
            strategy,
            analysis.counterOffer,
            round + 1
          );
          
          await this.sendEmail(responseEmail);

          await prisma.negotiationMessage.create({
            data: {
              negotiationId: negotiation.id,
              direction: 'outbound',
              channel: 'email',
              subject: responseEmail.subject,
              content: responseEmail.body,
              sentAt: new Date(),
            },
          });

          await prisma.negotiation.update({
            where: { id: negotiation.id },
            data: {
              counterOffers: [...(negotiation.counterOffers as any[] || []), analysis.counterOffer],
            },
          });

          return {
            success: true,
            data: {
              status: 'counter_sent',
              round: round + 1,
            },
          };
        }
      } else {
        // Max rounds reached - make final decision
        const finalDecision = analysis.counterOffer 
          ? this.evaluateCounterOffer(analysis.counterOffer, (negotiation.initialOffer as any).products, this.targetImprovement)
          : { acceptable: false, actualSavings: 0 };

        if (finalDecision.acceptable) {
          await prisma.negotiation.update({
            where: { id: negotiation.id },
            data: {
              status: 'accepted',
              finalTerms: analysis.counterOffer,
              savings: finalDecision.actualSavings,
              completedAt: new Date(),
            },
          });

          return {
            success: true,
            data: { status: 'accepted', savings: finalDecision.actualSavings },
          };
        } else {
          await prisma.negotiation.update({
            where: { id: negotiation.id },
            data: { status: 'expired', completedAt: new Date() },
          });

          return {
            success: true,
            data: { status: 'no_agreement', suggestedAction: 'try_alternative_supplier' },
          };
        }
      }
    } catch (error) {
      logger.error('Failed to process negotiation response', { error });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Request a quote from a supplier
   */
  async requestQuote(payload: {
    organizationId: string;
    supplierId: string;
    products: Array<{ productId: string; quantity: number }>;
  }): Promise<AgentResult> {
    try {
      const [organization, supplier] = await Promise.all([
        prisma.organization.findUnique({ where: { id: payload.organizationId } }),
        prisma.supplier.findUnique({
          where: { id: payload.supplierId },
          include: { supplierProducts: { include: { product: true } } },
        }),
      ]);

      if (!organization || !supplier || !supplier.contactEmail) {
        return { success: false, error: 'Organization or supplier not found' };
      }

      const products = payload.products.map(p => {
        const sp = supplier.supplierProducts.find((s: any) => s.productId === p.productId);
        return {
          sku: sp?.supplierSku || '',
          name: sp?.product.name || '',
          quantity: p.quantity,
        };
      });

      const email = await this.generateQuoteRequestEmail({
        supplierName: supplier.name,
        supplierEmail: supplier.contactEmail,
        organizationName: organization.name,
        products,
      });

      await this.sendEmail(email);

      logger.info(`Quote request sent to ${supplier.name}`, { products: products.length });

      return { success: true, data: { emailSent: true } };
    } catch (error) {
      logger.error('Failed to request quote', { error });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Negotiate a bulk order across multiple suppliers
   */
  async negotiateBulkOrder(payload: {
    organizationId: string;
    products: Array<{ productId: string; quantity: number }>;
  }): Promise<AgentResult> {
    try {
      // Find suppliers for each product
      const supplierProducts = await prisma.supplierProduct.findMany({
        where: { productId: { in: payload.products.map(p => p.productId) } },
        include: { supplier: true, product: true },
        orderBy: { unitPrice: 'asc' },
      });

      // Group by supplier and calculate potential orders
      const supplierOrders = new Map<string, {
        supplier: any;
        products: Array<{ productId: string; quantity: number; targetPrice?: number }>;
      }>();

      for (const product of payload.products) {
        // Find best supplier for this product
        const bestSupplier = supplierProducts.find(
          sp => sp.productId === product.productId && sp.inStock
        );

        if (bestSupplier) {
          if (!supplierOrders.has(bestSupplier.supplierId)) {
            supplierOrders.set(bestSupplier.supplierId, {
              supplier: bestSupplier.supplier,
              products: [],
            });
          }

          supplierOrders.get(bestSupplier.supplierId)!.products.push({
            productId: product.productId,
            quantity: product.quantity,
            targetPrice: bestSupplier.unitPrice * (1 - this.targetImprovement),
          });
        }
      }

      // Initiate negotiations with each supplier
      const negotiations: string[] = [];

      for (const [supplierId, order] of supplierOrders) {
        const result = await this.initiateNegotiation({
          organizationId: payload.organizationId,
          supplierId,
          products: order.products,
        });

        if (result.success && result.data) {
          negotiations.push((result.data as any).negotiationId);
        }
      }

      return {
        success: true,
        data: {
          negotiations,
          suppliersContacted: supplierOrders.size,
        },
      };
    } catch (error) {
      logger.error('Failed to negotiate bulk order', { error });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Request expedited delivery for an order
   */
  async expediteOrder(payload: {
    purchaseOrderId: string;
    reason: string;
    urgency: 'high' | 'critical';
  }): Promise<AgentResult> {
    try {
      const order = await prisma.purchaseOrder.findUnique({
        where: { id: payload.purchaseOrderId },
        include: {
          supplier: true,
          organization: true,
          items: true,
        },
      });

      if (!order || !order.supplier.contactEmail) {
        return { success: false, error: 'Order or supplier email not found' };
      }

      const email = await this.generateExpediteEmail({
        supplierName: order.supplier.name,
        supplierEmail: order.supplier.contactEmail,
        organizationName: order.organization.name,
        orderNumber: order.orderNumber,
        reason: payload.reason,
        urgency: payload.urgency,
        items: order.items.map(i => ({
          name: i.productName,
          quantity: i.quantity,
        })),
      });

      await this.sendEmail(email);

      logger.info(`Expedite request sent for order ${order.orderNumber}`);

      return { success: true, data: { emailSent: true } };
    } catch (error) {
      logger.error('Failed to send expedite request', { error });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ==========================================
  // AI-Powered Email Generation
  // ==========================================

  private async generateNegotiationEmail(
    context: NegotiationContext,
    strategy: NegotiationStrategy,
    round: number
  ): Promise<EmailMessage> {
    const prompt = `Generate a professional procurement negotiation email for round ${round}.

Context:
- Our company: ${context.organizationName}
- Supplier: ${context.supplierName}
- Historical purchase volume: $${context.historicalVolume?.toLocaleString() || 'N/A'}
- Negotiation strategy: ${strategy.approach}

Products to negotiate:
${context.products.map(p => `- ${p.name} (${p.sku}): Qty ${p.quantity}, Current: $${p.currentPrice}/unit, Target: $${p.targetPrice}/unit`).join('\n')}

Talking points to incorporate:
${strategy.talkingPoints.map(tp => `- ${tp}`).join('\n')}

Requirements:
1. Professional and respectful tone
2. Emphasize value of long-term partnership
3. Provide data-driven justification for pricing
4. Include specific ask for ${(strategy.initialDiscount * 100).toFixed(0)}% improvement
5. Set reasonable timeline for response

Generate subject line and email body.`;

    const systemPrompt = 'You are a professional procurement specialist writing negotiation emails. Be persuasive but respectful. Always maintain professionalism.';
    const aiResponse = await this.generateAIResponse(systemPrompt, prompt);

    const lines = aiResponse.split('\n');
    
    // Extract subject (usually first line after "Subject:" or similar)
    let subject = `Pricing Discussion - ${context.organizationName}`;
    let bodyStart = 0;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes('subject:')) {
        subject = lines[i].replace(/subject:/i, '').trim();
        bodyStart = i + 1;
        break;
      }
    }

    const body = lines.slice(bodyStart).join('\n').trim();

    return {
      to: context.supplierEmail,
      subject,
      body,
    };
  }

  private async generateCounterEmail(
    context: NegotiationContext,
    strategy: NegotiationStrategy,
    counterOffer: any,
    round: number
  ): Promise<EmailMessage> {
    const prompt = `Generate a professional counter-offer email for negotiation round ${round}.

Context:
- Our company: ${context.organizationName}
- Supplier: ${context.supplierName}
- Strategy: ${strategy.approach}

Their counter-offer:
${JSON.stringify(counterOffer, null, 2)}

Our original targets:
${context.products.map(p => `- ${p.name}: Target $${p.targetPrice}/unit`).join('\n')}

Generate a response that:
1. Acknowledges their counter-offer professionally
2. Provides reasoning for why we need a better price
3. Proposes a middle-ground if appropriate
4. Maintains relationship focus

Generate subject line and email body.`;

    const systemPrompt = 'You are a professional procurement specialist. Counter-negotiate firmly but fairly.';
    const aiResponse = await this.generateAIResponse(systemPrompt, prompt);

    const lines = aiResponse.split('\n');
    
    let subject = `Re: Pricing Discussion - ${context.organizationName}`;
    let bodyStart = 0;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes('subject:')) {
        subject = lines[i].replace(/subject:/i, '').trim();
        bodyStart = i + 1;
        break;
      }
    }

    return {
      to: context.supplierEmail,
      subject,
      body: lines.slice(bodyStart).join('\n').trim(),
    };
  }

  private async generateAcceptanceEmail(
    context: NegotiationContext,
    terms: any
  ): Promise<EmailMessage> {
    const body = `Dear ${context.supplierName} Team,

Thank you for working with us to reach an agreement on pricing. We are pleased to accept the terms as discussed:

${JSON.stringify(terms, null, 2)}

We look forward to placing our order and continuing our valued partnership.

Best regards,
${context.organizationName} Procurement Team`;

    return {
      to: context.supplierEmail,
      subject: `Order Confirmation - ${context.organizationName}`,
      body,
    };
  }

  private async generateQuoteRequestEmail(params: {
    supplierName: string;
    supplierEmail: string;
    organizationName: string;
    products: Array<{ sku: string; name: string; quantity: number }>;
  }): Promise<EmailMessage> {
    const productList = params.products
      .map(p => `- ${p.name} (SKU: ${p.sku}): ${p.quantity} units`)
      .join('\n');

    const body = `Dear ${params.supplierName} Team,

We are writing to request a quote for the following items:

${productList}

Please provide your best pricing including:
1. Unit price for stated quantities
2. Volume discount tiers if available
3. Lead time for delivery
4. Payment terms

We aim to place the order within the next 7-10 business days.

Thank you for your prompt attention to this request.

Best regards,
${params.organizationName} Procurement Team`;

    return {
      to: params.supplierEmail,
      subject: `Quote Request from ${params.organizationName}`,
      body,
    };
  }

  private async generateExpediteEmail(params: {
    supplierName: string;
    supplierEmail: string;
    organizationName: string;
    orderNumber: string;
    reason: string;
    urgency: 'high' | 'critical';
    items: Array<{ name: string; quantity: number }>;
  }): Promise<EmailMessage> {
    const urgencyText = params.urgency === 'critical' 
      ? 'URGENT: This is a critical production need'
      : 'This is a high-priority request';

    const body = `Dear ${params.supplierName} Team,

${urgencyText} - we need to request expedited delivery for our order #${params.orderNumber}.

Items needed urgently:
${params.items.map(i => `- ${i.name}: ${i.quantity} units`).join('\n')}

Reason: ${params.reason}

We understand this may incur additional charges and are prepared to discuss options. Please contact us immediately to confirm what's possible.

Thank you for your understanding and swift response.

Best regards,
${params.organizationName} Procurement Team`;

    return {
      to: params.supplierEmail,
      subject: `[URGENT] Expedite Request - Order #${params.orderNumber}`,
      body,
    };
  }

  // ==========================================
  // Response Analysis
  // ==========================================

  private async analyzeResponse(content: string, negotiation: any): Promise<{
    accepted: boolean;
    rejected: boolean;
    counterOffer?: any;
    terms?: any;
    savings?: number;
    reason?: string;
  }> {
    const prompt = `Analyze this supplier response to our pricing negotiation:

"${content}"

Our original request:
${JSON.stringify(negotiation.initialOffer, null, 2)}

Determine:
1. Did they accept our terms? (yes/no)
2. Did they reject outright? (yes/no)
3. Did they make a counter-offer? If so, extract the specific prices offered.
4. What is their reasoning?

Respond in JSON format:
{
  "accepted": boolean,
  "rejected": boolean,
  "counterOffer": { products with prices if any },
  "reason": "their reasoning"
}`;

    const systemPrompt = 'You are analyzing procurement negotiation responses. Extract key information accurately.';
    const aiResponse = await this.generateAIResponse(systemPrompt, prompt, 0.3);

    try {
      const result = JSON.parse(aiResponse || '{}');
      
      // Calculate savings if accepted
      if (result.accepted && result.counterOffer) {
        const initialProducts = (negotiation.initialOffer as any).products || [];
        let totalSavings = 0;
        
        for (const product of initialProducts) {
          const counterPrice = result.counterOffer[product.sku] || product.currentPrice;
          totalSavings += (product.currentPrice - counterPrice) * product.quantity;
        }
        
        result.savings = totalSavings;
        result.terms = result.counterOffer;
      }

      return result;
    } catch {
      return { accepted: false, rejected: false };
    }
  }

  // ==========================================
  // Strategy & Evaluation
  // ==========================================

  private determineStrategy(context: NegotiationContext): NegotiationStrategy {
    const totalValue = context.products.reduce(
      (sum, p) => sum + p.currentPrice * p.quantity,
      0
    );

    // High volume = more leverage
    if (context.historicalVolume && context.historicalVolume > 50000) {
      return {
        approach: 'volume_leverage',
        initialDiscount: this.targetImprovement + 0.02,
        maxRounds: this.maxRounds,
        fallbackAction: 'escalate',
        talkingPoints: [
          `We've purchased over $${context.historicalVolume.toLocaleString()} from you in the past year`,
          'Looking to increase our commitment with the right pricing',
          'Consolidating suppliers - your pricing will determine allocation',
        ],
      };
    }

    // Multiple competitor prices available
    if (context.products.some(p => p.competitorPrice)) {
      return {
        approach: 'competitive',
        initialDiscount: this.targetImprovement,
        maxRounds: this.maxRounds,
        fallbackAction: 'walk_away',
        talkingPoints: [
          'We have received competitive quotes from alternative suppliers',
          'Prefer to maintain our relationship with you',
          'Need pricing to be competitive to justify the decision',
        ],
      };
    }

    // Default collaborative approach
    return {
      approach: 'collaborative',
      initialDiscount: this.targetImprovement,
      maxRounds: this.maxRounds,
      fallbackAction: 'accept',
      talkingPoints: [
        'Looking to build a long-term partnership',
        'Planning significant growth in the coming year',
        'Value reliability and quality of service',
      ],
    };
  }

  private evaluateCounterOffer(
    counterOffer: any,
    originalProducts: any[],
    targetImprovement: number
  ): { acceptable: boolean; actualSavings: number } {
    let totalOriginal = 0;
    let totalCounter = 0;

    for (const product of originalProducts) {
      const counterPrice = counterOffer?.products?.[product.sku] || 
                          counterOffer?.[product.sku] || 
                          product.currentPrice;
      
      totalOriginal += product.currentPrice * product.quantity;
      totalCounter += counterPrice * product.quantity;
    }

    const actualSavings = totalOriginal - totalCounter;
    const savingsPercent = totalOriginal > 0 ? actualSavings / totalOriginal : 0;

    // Accept if we got at least half of our target improvement
    const acceptable = savingsPercent >= targetImprovement * 0.5;

    return { acceptable, actualSavings };
  }

  // ==========================================
  // Email Sending
  // ==========================================

  private async sendEmail(email: EmailMessage): Promise<void> {
    await this.emailTransporter.sendMail({
      from: `"${config.email.fromName}" <${config.email.from}>`,
      to: email.to,
      subject: email.subject,
      text: email.body,
      html: email.html,
    });

    logger.info('Email sent', { to: email.to, subject: email.subject });
  }
}

export const diplomatAgent = new DiplomatAgent();
