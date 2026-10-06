import { PNG } from 'pngjs';
import { BrowserManager } from '../crawler/browser.js';

export interface ViewportDefinition {
  name: string;
  width: number;
  height: number;
  isMobile?: boolean;
}

export interface RenderResult {
  screenshots: Record<string, Buffer>;
  fullPageScreenshot: Buffer;
  renderedHtml: string;
}

function createBlankPng(width: number, height: number): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = 250;
      png.data[idx + 1] = 250;
      png.data[idx + 2] = 250;
      png.data[idx + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

export class ChromiumRenderWorker {
  public static readonly workerName = 'ChromiumRenderWorker';

  public async execute(
    urlOrHtml: string,
    isHtmlContent: boolean = false,
    viewports: ViewportDefinition[] = [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'tablet', width: 768, height: 1024, isMobile: true },
      { name: 'mobile', width: 390, height: 844, isMobile: true },
    ]
  ): Promise<RenderResult> {
    try {
      const { context, page } = await BrowserManager.createPage({
        viewportWidth: 1440,
        viewportHeight: 900,
      });

      const screenshots: Record<string, Buffer> = {};

      try {
        if (isHtmlContent) {
          await page.setContent(urlOrHtml, { waitUntil: 'load', timeout: 15000 });
        } else {
          await page.goto(urlOrHtml, { waitUntil: 'load', timeout: 15000 }).catch(() => {});
        }

        await page.waitForTimeout(300);

        for (const vp of viewports) {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.waitForTimeout(200);
          screenshots[vp.name] = await page.screenshot({ fullPage: false, type: 'png' });
        }

        // Reset to desktop for full page screenshot
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.waitForTimeout(200);
        const fullPageScreenshot = await page.screenshot({ fullPage: true, type: 'png' });
        const renderedHtml = await page.content();

        return {
          screenshots,
          fullPageScreenshot,
          renderedHtml,
        };
      } finally {
        await page.close().catch(() => {});
        await context.close().catch(() => {});
      }
    } catch (err: any) {
      console.warn(`[ChromiumRenderWorker] Headless browser unavailable (${err.message}). Using deterministic fallback renderer.`);
      const screenshots: Record<string, Buffer> = {};
      for (const vp of viewports) {
        screenshots[vp.name] = createBlankPng(vp.width, vp.height);
      }
      return {
        screenshots,
        fullPageScreenshot: createBlankPng(1440, 900),
        renderedHtml: isHtmlContent ? urlOrHtml : `<!DOCTYPE html><html><body>${urlOrHtml}</body></html>`,
      };
    }
  }
}
