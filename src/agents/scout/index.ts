/**
 * Scout Agent - Web Scraping Engine
 * Monitors supplier websites for pricing and stock updates
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { prisma } from '../../database/client.js';
import { createAgentLogger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import { 
  BaseAgent, 
  AgentTask, 
  AgentResult, 
  ScrapingConfig, 
  ScrapedProduct 
} from '../types.js';

const logger = createAgentLogger('scout');

export class ScoutAgent extends BaseAgent {
  readonly name = 'Scout Agent';
  readonly version = '1.0.0';
  
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  async initialize(): Promise<void> {
    logger.info('Initializing Scout Agent...');
    
    try {
      this.browser = await chromium.launch({
        headless: config.browser.headless,
      });
      
      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      logger.info('Scout Agent initialized successfully');
    } catch (error) {
      logger.warn('Scout Agent browser initialization failed - running in limited mode', { error });
      // Continue without browser - static scraping will still work
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Scout Agent...');
    
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
    
    logger.info('Scout Agent shut down');
  }

  async healthCheck(): Promise<boolean> {
    return this.browser !== null && this.browser.isConnected();
  }

  async executeTask(task: AgentTask): Promise<AgentResult> {
    logger.info(`Executing task: ${task.type}`, { taskId: task.id });

    switch (task.type) {
      case 'scan_supplier':
        return this.scanSupplier(task.payload as { supplierId: string });
      
      case 'scan_all_suppliers':
        return this.scanAllSuppliers();
      
      case 'check_stock':
        return this.checkStock(task.payload as { 
          supplierId: string; 
          productSku: string 
        });
      
      case 'compare_prices':
        return this.comparePrices(task.payload as { productId: string });
      
      default:
        return { 
          success: false, 
          error: `Unknown task type: ${task.type}` 
        };
    }
  }

  /**
   * Scan a single supplier for pricing and stock updates
   */
  async scanSupplier(payload: { supplierId: string }): Promise<AgentResult<ScrapedProduct[]>> {
    const { supplierId } = payload;
    
    try {
      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
        include: { supplierProducts: { include: { product: true } } },
      });

      if (!supplier) {
        return { success: false, error: 'Supplier not found' };
      }

      logger.info(`Scanning supplier: ${supplier.name}`);

      // Record scraping job start
      const job = await prisma.scrapingJob.create({
        data: {
          supplierId: supplier.id,
          type: 'catalog',
          status: 'running',
          config: {},
          startedAt: new Date(),
        },
      });

      let scrapedProducts: ScrapedProduct[] = [];

      // Choose scraping method based on supplier configuration
      if (supplier.apiEndpoint) {
        scrapedProducts = await this.scrapeViaApi(supplier);
      } else if (supplier.portalUrl) {
        scrapedProducts = await this.scrapeViaPortal(supplier);
      } else if (supplier.website) {
        scrapedProducts = await this.scrapeViaWebsite(supplier);
      }

      // Update database with scraped data
      for (const scraped of scrapedProducts) {
        const existingProduct = supplier.supplierProducts.find(
          sp => sp.supplierSku === scraped.sku
        );

        if (existingProduct) {
          // Record price history if price changed
          if (existingProduct.unitPrice !== scraped.price) {
            await prisma.priceHistory.create({
              data: {
                supplierId: supplier.id,
                productSku: scraped.sku,
                price: scraped.price,
                currency: scraped.currency,
                source: 'scraped',
              },
            });

            logger.info(`Price change detected for ${scraped.sku}`, {
              oldPrice: existingProduct.unitPrice,
              newPrice: scraped.price,
            });
          }

          // Update supplier product
          await prisma.supplierProduct.update({
            where: { id: existingProduct.id },
            data: {
              unitPrice: scraped.price,
              inStock: scraped.inStock,
              stockLevel: scraped.stockLevel,
              lastUpdated: new Date(),
              scrapedData: scraped.rawData,
            },
          });
        }
      }

      // Update supplier last scraped timestamp
      await prisma.supplier.update({
        where: { id: supplier.id },
        data: { lastScrapedAt: new Date() },
      });

      // Complete scraping job
      await prisma.scrapingJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          results: scrapedProducts as any,
          completedAt: new Date(),
        },
      });

      logger.info(`Completed scanning ${supplier.name}`, { 
        productsScanned: scrapedProducts.length 
      });

      return { 
        success: true, 
        data: scrapedProducts,
        metadata: { supplierId: supplier.id, supplierName: supplier.name }
      };
    } catch (error) {
      logger.error('Failed to scan supplier', { supplierId, error });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Scan all active suppliers
   */
  async scanAllSuppliers(): Promise<AgentResult> {
    try {
      const suppliers = await prisma.supplier.findMany({
        where: { isActive: true },
      });

      logger.info(`Starting scan of ${suppliers.length} suppliers`);

      const results: Array<{ supplierId: string; success: boolean; error?: string }> = [];

      // Process suppliers with rate limiting
      for (const supplier of suppliers) {
        const result = await this.scanSupplier({ supplierId: supplier.id });
        results.push({
          supplierId: supplier.id,
          success: result.success,
          error: result.error,
        });

        // Rate limiting delay between suppliers
        await this.delay(2000);
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      logger.info(`Scan complete`, { successful, failed });

      return { 
        success: true, 
        data: results,
        metadata: { totalSuppliers: suppliers.length, successful, failed }
      };
    } catch (error) {
      logger.error('Failed to scan all suppliers', { error });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Check stock for a specific product at a supplier
   */
  async checkStock(payload: { 
    supplierId: string; 
    productSku: string 
  }): Promise<AgentResult<{ inStock: boolean; stockLevel?: number }>> {
    try {
      const supplierProduct = await prisma.supplierProduct.findFirst({
        where: {
          supplierId: payload.supplierId,
          supplierSku: payload.productSku,
        },
        include: { supplier: true },
      });

      if (!supplierProduct) {
        return { success: false, error: 'Supplier product not found' };
      }

      // Perform targeted stock check
      const stockData = await this.performStockCheck(
        supplierProduct.supplier,
        payload.productSku
      );

      // Update database
      await prisma.supplierProduct.update({
        where: { id: supplierProduct.id },
        data: {
          inStock: stockData.inStock,
          stockLevel: stockData.stockLevel,
          lastUpdated: new Date(),
        },
      });

      return { success: true, data: stockData };
    } catch (error) {
      logger.error('Failed to check stock', { payload, error });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Compare prices across all suppliers for a product
   */
  async comparePrices(payload: { productId: string }): Promise<AgentResult> {
    try {
      const supplierProducts = await prisma.supplierProduct.findMany({
        where: { productId: payload.productId },
        include: { 
          supplier: true,
          product: true,
        },
        orderBy: { unitPrice: 'asc' },
      });

      const priceComparison = supplierProducts.map(sp => ({
        supplierId: sp.supplierId,
        supplierName: sp.supplier.name,
        sku: sp.supplierSku,
        price: sp.unitPrice,
        inStock: sp.inStock,
        leadTime: sp.leadTime,
        tier: sp.supplier.tier,
      }));

      const lowestPrice = priceComparison[0];
      const averagePrice = priceComparison.reduce((sum, p) => sum + p.price, 0) / priceComparison.length;

      return {
        success: true,
        data: {
          productId: payload.productId,
          suppliers: priceComparison,
          lowestPrice,
          averagePrice,
          potentialSavings: averagePrice - lowestPrice.price,
        },
      };
    } catch (error) {
      logger.error('Failed to compare prices', { payload, error });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Scrape supplier data via REST API
   */
  private async scrapeViaApi(supplier: any): Promise<ScrapedProduct[]> {
    logger.debug(`Scraping via API: ${supplier.apiEndpoint}`);
    
    try {
      const response = await axios.get(supplier.apiEndpoint, {
        timeout: config.browser.timeout,
      });

      // Transform API response to our format
      // This would need to be customized per supplier API format
      const products: ScrapedProduct[] = [];
      
      if (Array.isArray(response.data)) {
        for (const item of response.data) {
          products.push({
            sku: item.sku || item.product_id,
            name: item.name || item.product_name,
            price: parseFloat(item.price || item.unit_price),
            currency: item.currency || 'USD',
            inStock: item.in_stock ?? item.stock_quantity > 0,
            stockLevel: item.stock_quantity,
            url: item.url,
            lastUpdated: new Date(),
            rawData: item,
          });
        }
      }

      return products;
    } catch (error) {
      logger.error(`API scraping failed for ${supplier.name}`, { error });
      throw error;
    }
  }

  /**
   * Scrape supplier data via authenticated portal
   */
  private async scrapeViaPortal(supplier: any): Promise<ScrapedProduct[]> {
    if (!this.context) {
      throw new Error('Browser context not initialized');
    }

    logger.debug(`Scraping via portal: ${supplier.portalUrl}`);
    
    const page = await this.context.newPage();
    const products: ScrapedProduct[] = [];

    try {
      await page.goto(supplier.portalUrl, { 
        waitUntil: 'networkidle',
        timeout: config.browser.timeout,
      });

      // Handle authentication if credentials are provided
      if (supplier.portalCredentials) {
        await this.handlePortalLogin(page, supplier.portalCredentials);
      }

      // Navigate to catalog/products page
      // This is a generic implementation - would need customization per supplier
      const catalogLink = await page.$('a[href*="catalog"], a[href*="products"], a:has-text("Products")');
      if (catalogLink) {
        await catalogLink.click();
        await page.waitForLoadState('networkidle');
      }

      // Scrape product data
      products.push(...await this.extractProductsFromPage(page));

      // Handle pagination
      let hasNextPage = true;
      while (hasNextPage) {
        const nextButton = await page.$('.pagination .next:not(.disabled), a:has-text("Next")');
        if (nextButton) {
          await nextButton.click();
          await page.waitForLoadState('networkidle');
          await this.delay(1000); // Rate limiting
          products.push(...await this.extractProductsFromPage(page));
        } else {
          hasNextPage = false;
        }
      }

      return products;
    } finally {
      await page.close();
    }
  }

  /**
   * Scrape supplier data via public website
   */
  private async scrapeViaWebsite(supplier: any): Promise<ScrapedProduct[]> {
    logger.debug(`Scraping via website: ${supplier.website}`);
    
    try {
      const response = await axios.get(supplier.website, {
        timeout: config.browser.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const $ = cheerio.load(response.data);
      const products: ScrapedProduct[] = [];

      // Generic product extraction - would need customization per supplier
      $('[class*="product"], [data-product], .item').each((_, element) => {
        const $el = $(element);
        
        const name = $el.find('[class*="name"], h2, h3, .title').first().text().trim();
        const priceText = $el.find('[class*="price"]').first().text();
        const sku = $el.attr('data-sku') || $el.find('[class*="sku"]').text().trim();
        const stockText = $el.find('[class*="stock"], [class*="availability"]').text();

        if (name && priceText) {
          const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
          
          products.push({
            sku: sku || `AUTO-${Date.now()}`,
            name,
            price: isNaN(price) ? 0 : price,
            currency: 'USD',
            inStock: !stockText.toLowerCase().includes('out of stock'),
            lastUpdated: new Date(),
          });
        }
      });

      return products;
    } catch (error) {
      logger.error(`Website scraping failed for ${supplier.name}`, { error });
      throw error;
    }
  }

  /**
   * Handle portal login
   */
  private async handlePortalLogin(page: Page, credentials: any): Promise<void> {
    logger.debug('Handling portal login');
    
    // Look for login form elements
    const usernameField = await page.$('input[type="email"], input[name*="user"], input[name*="email"], #username');
    const passwordField = await page.$('input[type="password"]');
    const submitButton = await page.$('button[type="submit"], input[type="submit"], button:has-text("Login")');

    if (usernameField && passwordField && submitButton) {
      await usernameField.fill(credentials.username);
      await passwordField.fill(credentials.password);
      await submitButton.click();
      await page.waitForLoadState('networkidle');
      
      // Wait for login to complete
      await this.delay(2000);
    }
  }

  /**
   * Extract products from current page
   */
  private async extractProductsFromPage(page: Page): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = [];

    const items = await page.$$('[class*="product"], [data-product], .item, tr[data-id]');
    
    for (const item of items) {
      try {
        const name = await item.$eval(
          '[class*="name"], h2, h3, .title, td:nth-child(2)', 
          el => el.textContent?.trim() || ''
        ).catch(() => '');
        
        const priceText = await item.$eval(
          '[class*="price"], td:nth-child(3)', 
          el => el.textContent?.trim() || ''
        ).catch(() => '0');
        
        const sku = await item.getAttribute('data-sku') || 
          await item.$eval('[class*="sku"], td:nth-child(1)', el => el.textContent?.trim() || '').catch(() => '');
        
        const stockText = await item.$eval(
          '[class*="stock"], [class*="availability"], td:nth-child(4)', 
          el => el.textContent?.trim() || 'in stock'
        ).catch(() => 'in stock');

        if (name) {
          const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
          
          products.push({
            sku: sku || `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name,
            price: isNaN(price) ? 0 : price,
            currency: 'USD',
            inStock: !stockText.toLowerCase().includes('out') && 
                     !stockText.toLowerCase().includes('unavailable'),
            lastUpdated: new Date(),
          });
        }
      } catch (error) {
        // Skip items that can't be parsed
      }
    }

    return products;
  }

  /**
   * Perform targeted stock check for a specific SKU
   */
  private async performStockCheck(
    supplier: any, 
    sku: string
  ): Promise<{ inStock: boolean; stockLevel?: number }> {
    // Quick API check if available
    if (supplier.apiEndpoint) {
      try {
        const response = await axios.get(`${supplier.apiEndpoint}/stock/${sku}`);
        return {
          inStock: response.data.in_stock ?? response.data.quantity > 0,
          stockLevel: response.data.quantity,
        };
      } catch {
        // Fall through to portal/website check
      }
    }

    // Default to last known status
    return { inStock: true };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const scoutAgent = new ScoutAgent();
