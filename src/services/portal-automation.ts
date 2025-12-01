/**
 * Browser Automation Service
 * Handles automated interactions with supplier portals that lack APIs
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { createAgentLogger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { prisma } from '../database/client.js';

const logger = createAgentLogger('browser-automation');

interface PortalCredentials {
  username: string;
  password: string;
  otpSecret?: string;
}

interface CartItem {
  sku: string;
  quantity: number;
}

interface OrderResult {
  success: boolean;
  orderNumber?: string;
  confirmationUrl?: string;
  error?: string;
  screenshots?: string[];
}

interface PortalConfig {
  loginUrl: string;
  catalogUrl?: string;
  cartUrl?: string;
  checkoutUrl?: string;
  selectors: {
    username: string;
    password: string;
    loginButton: string;
    searchInput?: string;
    addToCart?: string;
    quantity?: string;
    checkout?: string;
    placeOrder?: string;
    orderConfirmation?: string;
  };
  postLoginCheck?: string; // Selector to verify successful login
}

export class PortalAutomationService {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();

  async initialize(): Promise<void> {
    logger.info('Initializing Portal Automation Service...');
    
    try {
      this.browser = await chromium.launch({
        headless: config.browser.headless,
        args: ['--disable-blink-features=AutomationControlled'],
      });
      logger.info('Portal Automation Service initialized successfully');
    } catch (error) {
      logger.warn('Portal Automation browser initialization failed - portal features disabled', { error });
      // Continue without browser
    }

    logger.info('Browser launched successfully');
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Portal Automation Service...');
    
    for (const [supplierId, context] of this.contexts) {
      await context.close();
      logger.debug(`Closed context for supplier ${supplierId}`);
    }
    this.contexts.clear();

    if (this.browser) {
      await this.browser.close();
    }

    logger.info('Portal Automation Service shut down');
  }

  /**
   * Get or create a browser context for a supplier
   * This preserves sessions/cookies between interactions
   */
  private async getContext(supplierId: string): Promise<BrowserContext> {
    if (this.contexts.has(supplierId)) {
      return this.contexts.get(supplierId)!;
    }

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
    });

    this.contexts.set(supplierId, context);
    return context;
  }

  /**
   * Login to a supplier portal
   */
  async loginToPortal(
    supplierId: string,
    portalConfig: PortalConfig,
    credentials: PortalCredentials
  ): Promise<{ success: boolean; page: Page | null; error?: string }> {
    try {
      const context = await this.getContext(supplierId);
      const page = await context.newPage();

      logger.info(`Logging into portal for supplier ${supplierId}`);

      await page.goto(portalConfig.loginUrl, {
        waitUntil: 'networkidle',
        timeout: config.browser.timeout,
      });

      // Fill login form
      await page.fill(portalConfig.selectors.username, credentials.username);
      await page.fill(portalConfig.selectors.password, credentials.password);

      // Click login button
      await page.click(portalConfig.selectors.loginButton);

      // Wait for navigation or post-login element
      if (portalConfig.postLoginCheck) {
        await page.waitForSelector(portalConfig.postLoginCheck, {
          timeout: 10000,
        });
      } else {
        await page.waitForLoadState('networkidle');
      }

      // Verify login success
      const currentUrl = page.url();
      if (currentUrl.includes('login') || currentUrl.includes('signin')) {
        const errorText = await page.$eval(
          '[class*="error"], [class*="alert-danger"], .error-message',
          el => el.textContent
        ).catch(() => 'Unknown login error');

        logger.error(`Login failed for supplier ${supplierId}`, { error: errorText });
        await page.close();
        return { success: false, page: null, error: errorText };
      }

      logger.info(`Successfully logged into portal for supplier ${supplierId}`);
      return { success: true, page };
    } catch (error) {
      logger.error(`Portal login error for supplier ${supplierId}`, { error });
      return {
        success: false,
        page: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Search for a product on supplier portal
   */
  async searchProduct(
    page: Page,
    portalConfig: PortalConfig,
    sku: string
  ): Promise<{ found: boolean; element?: any }> {
    try {
      if (!portalConfig.selectors.searchInput) {
        return { found: false };
      }

      await page.fill(portalConfig.selectors.searchInput, sku);
      await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle');

      // Look for the product
      const productElement = await page.$(`[data-sku="${sku}"], [data-product-id="${sku}"], :text("${sku}")`);
      
      return { found: !!productElement, element: productElement };
    } catch (error) {
      logger.error('Product search failed', { sku, error });
      return { found: false };
    }
  }

  /**
   * Add items to cart on supplier portal
   */
  async addToCart(
    page: Page,
    portalConfig: PortalConfig,
    items: CartItem[]
  ): Promise<{ success: boolean; addedItems: string[]; failedItems: string[] }> {
    const addedItems: string[] = [];
    const failedItems: string[] = [];

    for (const item of items) {
      try {
        // Search for product
        const searchResult = await this.searchProduct(page, portalConfig, item.sku);
        
        if (!searchResult.found) {
          logger.warn(`Product not found: ${item.sku}`);
          failedItems.push(item.sku);
          continue;
        }

        // Set quantity if selector exists
        if (portalConfig.selectors.quantity) {
          const qtyInput = await page.$(portalConfig.selectors.quantity);
          if (qtyInput) {
            await qtyInput.fill(item.quantity.toString());
          }
        }

        // Add to cart
        if (portalConfig.selectors.addToCart) {
          await page.click(portalConfig.selectors.addToCart);
          await page.waitForLoadState('networkidle');
          
          // Small delay for cart to update
          await page.waitForTimeout(1000);
        }

        addedItems.push(item.sku);
        logger.debug(`Added ${item.sku} x${item.quantity} to cart`);
      } catch (error) {
        logger.error(`Failed to add item to cart: ${item.sku}`, { error });
        failedItems.push(item.sku);
      }
    }

    return {
      success: failedItems.length === 0,
      addedItems,
      failedItems,
    };
  }

  /**
   * Complete checkout on supplier portal
   */
  async checkout(
    page: Page,
    portalConfig: PortalConfig
  ): Promise<OrderResult> {
    try {
      // Navigate to cart
      if (portalConfig.cartUrl) {
        await page.goto(portalConfig.cartUrl);
        await page.waitForLoadState('networkidle');
      }

      // Proceed to checkout
      if (portalConfig.selectors.checkout) {
        await page.click(portalConfig.selectors.checkout);
        await page.waitForLoadState('networkidle');
      }

      // Take screenshot before placing order
      const screenshotPath = `screenshots/order-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath });

      // Place order
      if (portalConfig.selectors.placeOrder) {
        await page.click(portalConfig.selectors.placeOrder);
        await page.waitForLoadState('networkidle');
      }

      // Get order confirmation
      let orderNumber: string | undefined;
      
      if (portalConfig.selectors.orderConfirmation) {
        const confirmationElement = await page.$(portalConfig.selectors.orderConfirmation);
        if (confirmationElement) {
          orderNumber = await confirmationElement.textContent() || undefined;
        }
      }

      // Also try to extract from URL or page content
      if (!orderNumber) {
        const pageContent = await page.content();
        const orderMatch = pageContent.match(/order[#\s:-]*([A-Z0-9-]+)/i);
        if (orderMatch) {
          orderNumber = orderMatch[1];
        }
      }

      logger.info('Checkout completed', { orderNumber });

      return {
        success: true,
        orderNumber,
        confirmationUrl: page.url(),
        screenshots: [screenshotPath],
      };
    } catch (error) {
      logger.error('Checkout failed', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Complete end-to-end order placement
   */
  async placeOrder(
    supplierId: string,
    items: CartItem[]
  ): Promise<OrderResult> {
    try {
      // Get supplier config from database
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
      });

      if (!supplier || !supplier.portalUrl || !supplier.portalCredentials) {
        return {
          success: false,
          error: 'Supplier portal configuration not found',
        };
      }

      // Parse portal configuration
      // In production, this would be stored in a more structured format
      const portalConfig: PortalConfig = {
        loginUrl: supplier.portalUrl,
        selectors: {
          username: '#username, input[name="username"], input[type="email"]',
          password: '#password, input[name="password"], input[type="password"]',
          loginButton: 'button[type="submit"], input[type="submit"], button:has-text("Login")',
          searchInput: '#search, input[name="search"], input[placeholder*="search" i]',
          addToCart: '.add-to-cart, button:has-text("Add to Cart"), [data-action="add-to-cart"]',
          quantity: 'input[name="quantity"], input[type="number"]',
          checkout: '.checkout, button:has-text("Checkout"), a:has-text("Checkout")',
          placeOrder: '.place-order, button:has-text("Place Order"), button:has-text("Submit Order")',
          orderConfirmation: '.order-number, .confirmation-number, [data-order-id]',
        },
        postLoginCheck: '.dashboard, .account, nav',
      };

      const credentials = supplier.portalCredentials as unknown as PortalCredentials;

      // Login
      const loginResult = await this.loginToPortal(supplierId, portalConfig, credentials);
      if (!loginResult.success || !loginResult.page) {
        return { success: false, error: loginResult.error };
      }

      const page = loginResult.page;

      try {
        // Add items to cart
        const cartResult = await this.addToCart(page, portalConfig, items);
        
        if (!cartResult.success) {
          logger.warn('Some items could not be added to cart', {
            added: cartResult.addedItems,
            failed: cartResult.failedItems,
          });
        }

        if (cartResult.addedItems.length === 0) {
          await page.close();
          return { success: false, error: 'No items could be added to cart' };
        }

        // Checkout
        const orderResult = await this.checkout(page, portalConfig);

        // Record order in database
        if (orderResult.success && orderResult.orderNumber) {
          await prisma.activityLog.create({
            data: {
              agentType: 'browser-automation',
              action: 'portal_order_placed',
              entityType: 'supplier',
              entityId: supplierId,
              details: JSON.parse(JSON.stringify({
                orderNumber: orderResult.orderNumber,
                items: items,
                confirmationUrl: orderResult.confirmationUrl || null,
              })),
            },
          });
        }

        return orderResult;
      } finally {
        await page.close();
      }
    } catch (error) {
      logger.error('Order placement failed', { supplierId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check stock levels on supplier portal
   */
  async checkPortalStock(
    supplierId: string,
    skus: string[]
  ): Promise<Map<string, { inStock: boolean; quantity?: number }>> {
    const results = new Map<string, { inStock: boolean; quantity?: number }>();

    try {
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
      });

      if (!supplier?.portalUrl || !supplier?.portalCredentials) {
        return results;
      }

      const portalConfig: PortalConfig = {
        loginUrl: supplier.portalUrl,
        selectors: {
          username: '#username, input[name="username"]',
          password: '#password, input[name="password"]',
          loginButton: 'button[type="submit"]',
          searchInput: '#search, input[name="search"]',
        },
      };

      const loginResult = await this.loginToPortal(
        supplierId,
        portalConfig,
        supplier.portalCredentials as unknown as PortalCredentials
      );

      if (!loginResult.success || !loginResult.page) {
        return results;
      }

      const page = loginResult.page;

      try {
        for (const sku of skus) {
          const searchResult = await this.searchProduct(page, portalConfig, sku);
          
          if (searchResult.found) {
            // Try to extract stock information
            const stockElement = await page.$('[class*="stock"], [class*="availability"], [data-stock]');
            
            if (stockElement) {
              const stockText = await stockElement.textContent() || '';
              const inStock = !stockText.toLowerCase().includes('out of stock') &&
                             !stockText.toLowerCase().includes('unavailable');
              
              // Try to extract quantity
              const qtyMatch = stockText.match(/(\d+)\s*(in stock|available|units)/i);
              const quantity = qtyMatch ? parseInt(qtyMatch[1]) : undefined;

              results.set(sku, { inStock, quantity });
            } else {
              results.set(sku, { inStock: true }); // Assume in stock if found
            }
          } else {
            results.set(sku, { inStock: false });
          }
        }
      } finally {
        await page.close();
      }
    } catch (error) {
      logger.error('Portal stock check failed', { supplierId, error });
    }

    return results;
  }
}

// Singleton instance
export const portalAutomation = new PortalAutomationService();
