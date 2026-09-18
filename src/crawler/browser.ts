import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { CONFIG } from '../config.js';

export class BrowserManager {
  private static browserInstance: Browser | null = null;

  public static async getBrowser(): Promise<Browser> {
    if (this.browserInstance && this.browserInstance.isConnected()) {
      return this.browserInstance;
    }

    const launchOptions: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-blink-features=AutomationControlled',
      ],
    };

    // Auto-detect Mac Chrome for Testing if standard default is not present
    const customExecutable = this.findExecutablePath();
    if (customExecutable) {
      launchOptions.executablePath = customExecutable;
    }

    this.browserInstance = await chromium.launch(launchOptions);
    return this.browserInstance;
  }

  public static async createPage(options: {
    mobile?: boolean;
    viewportWidth?: number;
    viewportHeight?: number;
  } = {}): Promise<{ context: BrowserContext; page: Page }> {
    const browser = await this.getBrowser();

    const isMobile = !!options.mobile;
    const viewport = {
      width: options.viewportWidth || (isMobile ? CONFIG.crawler.mobileViewport.width : CONFIG.crawler.defaultViewport.width),
      height: options.viewportHeight || (isMobile ? CONFIG.crawler.mobileViewport.height : CONFIG.crawler.defaultViewport.height),
    };

    const context = await browser.newContext({
      viewport,
      isMobile,
      hasTouch: isMobile,
      deviceScaleFactor: 2, // High-DPI screenshots
      ignoreHTTPSErrors: true,
      locale: 'en-US',
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      (window as any).chrome = {
        runtime: {},
        loadTimes: () => {},
        csi: () => {},
        app: {},
      };
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });

    const page = await context.newPage();
    return { context, page };
  }

  public static async closeBrowser(): Promise<void> {
    if (this.browserInstance) {
      await this.browserInstance.close();
      this.browserInstance = null;
    }
  }

  private static findExecutablePath(): string | undefined {
    if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
      return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    }

    const homedir = os.homedir();
    const macCftPath = path.join(
      homedir,
      'Library/Caches/ms-playwright/chromium-1243/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
    );
    if (fs.existsSync(macCftPath)) {
      return macCftPath;
    }

    // Try finding any chromium-* under ms-playwright
    const msPlaywrightDir = path.join(homedir, 'Library/Caches/ms-playwright');
    if (fs.existsSync(msPlaywrightDir)) {
      const dirs = fs.readdirSync(msPlaywrightDir);
      for (const d of dirs) {
        if (d.startsWith('chromium-')) {
          const candidate = path.join(
            msPlaywrightDir,
            d,
            'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
          );
          if (fs.existsSync(candidate)) return candidate;
        }
      }
    }

    return undefined;
  }
}
