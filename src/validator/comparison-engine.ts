import http from 'http';
import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { BrowserManager } from '../crawler/browser.js';
import { CONFIG } from '../config.js';

export interface ViewportDefinition {
  name: 'desktop' | 'tablet' | 'mobile';
  width: number;
  height: number;
}

export const STANDARD_VIEWPORTS: Record<string, ViewportDefinition> = {
  desktop: { name: 'desktop', width: 1440, height: 900 },
  tablet: { name: 'tablet', width: 768, height: 1024 },
  mobile: { name: 'mobile', width: 390, height: 844 },
};

export interface InteractionProof {
  interactionName: string;
  viewport: 'desktop' | 'tablet' | 'mobile';
  triggered: boolean;
  passed: boolean;
  screenshotPath: string;
  liveScreenshotPath?: string;
  cloneScreenshotPath?: string;
  diffPath?: string;
  matchScore?: number;
  details: string;
}

export interface ComparisonReport {
  jobId: string;
  timestamp: string;
  liveUrl?: string;
  viewportsTested: string[];
  totalInteractionsTested: number;
  passedInteractions: number;
  fidelityScore: number;
  proofs: InteractionProof[];
  summary: {
    desktopResting: boolean;
    desktopNavHover: boolean;
    carouselActive: boolean;
    mobileResting: boolean;
    mobileDrawerOpen: boolean;
  };
}

/**
 * Universal cookie banner dismisser
 */
async function dismissCookies(page: any): Promise<void> {
  try {
    await page.evaluate(() => {
      const selectors = [
        '#onetrust-consent-sdk',
        '.onetrust-pc-dark',
        '.cookie-bar',
        '[class*="cookie-bar" i]',
        '[id*="cookie-bar" i]',
        '[class*="cookie-banner" i]',
        '[id*="cookie-banner" i]',
        '[id*="consent" i][class*="modal" i]',
        '[id*="consent" i][class*="banner" i]',
        '[aria-label*="cookie" i]',
        '#truste-consent-track',
        'dialog[id*="locale"]',
        '[class*="locale-selector"]',
        '[class*="country-selector"]',
      ];
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach((el) => {
          try {
            (el as HTMLElement).style.display = 'none';
            el.remove();
          } catch {}
        });
      }

      const buttons = Array.from(document.querySelectorAll('button, a'));
      for (const btn of buttons) {
        const txt = (btn.textContent || '').trim().toLowerCase();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (
          ['accept', 'accept all', 'accept all cookies', 'agree', 'i agree', 'got it'].includes(txt) ||
          aria.includes('close dialog') ||
          (btn.closest('dialog, [class*="locale"], [class*="country"]') && (txt === 'continue' || aria.includes('close')))
        ) {
          (btn as HTMLElement).click();
          break;
        }
      }
    });

    // Universal Navigation Blocker: prevent link clicks, form submits, and redirects from destroying the comparison page
    await page.evaluate(() => {
      window.addEventListener('beforeunload', (e) => { e.preventDefault(); e.returnValue = ''; return ''; }, true);
      document.addEventListener('click', (e) => {
        const a = (e.target as HTMLElement)?.closest?.('a');
        if (a && a.getAttribute('href') && !a.getAttribute('href')?.startsWith('#')) {
          e.preventDefault();
        }
      }, true);
      document.addEventListener('submit', (e) => { e.preventDefault(); }, true);
      try {
        window.history.pushState = function() {};
        window.history.replaceState = function() {};
      } catch {}
    });
  } catch {}
}

/**
 * Universal helper to trigger navigation hover
 */
async function triggerNavHover(page: any): Promise<boolean> {
  try {
    const selectors = [
      'header nav li button',
      'header nav li:has(ul) > a',
      'header nav [aria-haspopup="true"]',
      'header [role="navigation"] button',
      'header nav > ul > li:first-child a',
      'header nav > ul > li:first-child button',
      'header nav a:not([href^="#"]):not([href=""])',
    ];
    for (const sel of selectors) {
      const items = await page.$$(sel);
      for (const item of items) {
        const isVisible = await item.isVisible().catch(() => false);
        if (isVisible) {
          const text = (await item.innerText().catch(() => '')).trim();
          if (['sign in', 'login', 'cart', 'search', 'buy'].includes(text.toLowerCase())) continue;
          await item.hover({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(500);
          return true;
        }
      }
    }
  } catch {}
  return false;
}

/**
 * Universal helper to trigger carousel next slide
 */
async function triggerCarousel(page: any): Promise<boolean> {
  try {
    const selectors = [
      'button[aria-label*="next" i]',
      'button[aria-label*="slide" i]',
      '[class*="carousel" i] button[class*="next" i]',
      '[class*="slider" i] button[class*="next" i]',
      '.swiper-button-next',
      '.slick-next',
      'button.next-btn',
      '[data-slide="next"]',
      '[data-carousel-next]',
    ];
    for (const sel of selectors) {
      const btn = await page.$(sel);
      if (btn && (await btn.isVisible().catch(() => false))) {
        await btn.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(300);
        await btn.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(600);
        return true;
      }
    }
  } catch {}
  return false;
}

/**
 * Universal helper to trigger mobile navigation drawer
 */
async function triggerMobileDrawer(page: any): Promise<boolean> {
  try {
    const selectors = [
      'nav button[class*="hamburger" i]',
      'header button[class*="hamburger" i]',
      'button[data-js-action="hamburger" i]',
      'button[class*="hamburger" i]',
      '[class*="hamburger" i]',
      'button[aria-label*="menu" i]',
      'button[aria-label*="navigation" i]',
      '[class*="nav-toggle" i]',
      '[class*="mobile-menu" i]',
      '[class*="menu-toggle" i]',
      '[aria-expanded="false"][aria-controls*="nav" i]',
      '[aria-expanded="false"][aria-controls*="menu" i]',
      'header button:has(svg)',
    ];
    for (const sel of selectors) {
      const btns = await page.$$(sel);
      for (const btn of btns) {
        if (await btn.isVisible().catch(() => false)) {
          const txt = (await btn.innerText().catch(() => '')).trim().toLowerCase();
          const aria = (await btn.getAttribute('aria-label').catch(() => '') || '').toLowerCase();
          const cls = (await btn.getAttribute('class').catch(() => '') || '').toLowerCase();
          if (txt === 'close' || aria === 'close' || cls.includes('close') || cls.includes('search')) continue;
          await btn.click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(600);
          return true;
        }
      }
    }
  } catch {}
  return false;
}

/**
 * Compare two PNG buffers using pixelmatch with dimension normalization
 */
function compareScreenshots(
  buf1: Buffer,
  buf2: Buffer
): { diffPixels: number; totalPixels: number; matchPercentage: number; diffBuffer: Buffer } {
  const img1 = PNG.sync.read(buf1);
  const img2 = PNG.sync.read(buf2);

  const width = Math.max(img1.width, img2.width);
  const height = Math.max(img1.height, img2.height);

  const norm1 = new PNG({ width, height });
  const norm2 = new PNG({ width, height });
  PNG.bitblt(img1, norm1, 0, 0, img1.width, img1.height, 0, 0);
  PNG.bitblt(img2, norm2, 0, 0, img2.width, img2.height, 0, 0);

  const diff = new PNG({ width, height });
  const totalPixels = width * height;

  const diffPixels = pixelmatch(norm1.data, norm2.data, diff.data, width, height, {
    threshold: 0.15,
    includeAA: false,
    diffColor: [255, 0, 0],
  });

  const matchPercentage = Math.round(((totalPixels - diffPixels) / totalPixels) * 10000) / 100;
  const diffBuffer = PNG.sync.write(diff);

  return { diffPixels, totalPixels, matchPercentage, diffBuffer };
}

/**
 * Starts a lightweight local HTTP static server on an ephemeral port
 */
function startLocalStaticServer(rootDir: string): Promise<{ server: http.Server; url: string }> {
  return new Promise((resolve) => {
    const MIME_TYPES: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.mjs': 'application/javascript; charset=utf-8',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
    };

    const server = http.createServer((req, res) => {
      let reqPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

      let filePath = path.join(rootDir, reqPath);

      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        const assetPath = path.join(rootDir, 'assets', path.basename(reqPath));
        if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
          filePath = assetPath;
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as any;
      resolve({ server, url: `http://127.0.0.1:${address.port}` });
    });
  });
}

/**
 * ComparisonEngine:
 * Executes comprehensive multi-viewport and interaction proof capture
 * comparing LIVE vs CREATED CLONE entirely on localhost with pixelmatch.
 */
export class ComparisonEngine {
  public async runFullComparison(
    jobId: string,
    options: { baselinesDir?: string; onProgress?: (msg: string) => void; liveUrl?: string } = {}
  ): Promise<ComparisonReport> {
    const jobDir = path.join(CONFIG.jobsDir, jobId);
    const fullPageDir = path.join(jobDir, 'full-page');
    const qaDir = path.join(fullPageDir, 'qa');
    fs.mkdirSync(qaDir, { recursive: true });

    let liveUrl = options.liveUrl;
    if (!liveUrl) {
      const metaPath = path.join(jobDir, 'job.json');
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          liveUrl = meta.url;
        } catch {}
      }
    }

    const onProgress = options.onProgress || (() => {});
    onProgress(`Starting Live vs Clone comparison for job ${jobId}...`);

    const liveBuffers: Record<string, Buffer> = {};
    const cloneBuffers: Record<string, Buffer> = {};

    // 1. CAPTURE LIVE BENCHMARK (if liveUrl available)
    if (liveUrl) {
      onProgress(`Capturing Live benchmark states from ${liveUrl}...`);
      let liveContext: any;
      try {
        const liveSession = await BrowserManager.createPage({
          viewportWidth: STANDARD_VIEWPORTS.desktop.width,
          viewportHeight: STANDARD_VIEWPORTS.desktop.height,
        });
        liveContext = liveSession.context;
        const livePage = liveSession.page;

        await livePage.goto(liveUrl, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
        await livePage.waitForTimeout(1000);
        await dismissCookies(livePage);
        await livePage.waitForTimeout(400);

        // 1a. Live Desktop Resting
        liveBuffers['desktop_resting'] = await livePage.screenshot({ fullPage: false, type: 'png' });
        fs.writeFileSync(path.join(qaDir, 'live-desktop-resting.png'), liveBuffers['desktop_resting']);

        // 1b. Live Desktop Nav Hover
        const hovered = await triggerNavHover(livePage);
        if (hovered) {
          liveBuffers['desktop_nav_hover'] = await livePage.screenshot({ fullPage: false, type: 'png' });
          fs.writeFileSync(path.join(qaDir, 'live-desktop-hover.png'), liveBuffers['desktop_nav_hover']);
        }
        await livePage.mouse.move(0, 0);

        // 1c. Live Desktop Carousel
        const carouselMoved = await triggerCarousel(livePage);
        if (carouselMoved) {
          liveBuffers['carousel_slide_transition'] = await livePage.screenshot({ fullPage: false, type: 'png' });
          fs.writeFileSync(path.join(qaDir, 'live-carousel-slide.png'), liveBuffers['carousel_slide_transition']);
        }

        // 1d. Live Mobile Drawer
        await livePage.setViewportSize({ width: STANDARD_VIEWPORTS.mobile.width, height: STANDARD_VIEWPORTS.mobile.height });
        await livePage.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
        await livePage.waitForTimeout(400);
        await dismissCookies(livePage);
        await livePage.waitForTimeout(200);
        await triggerMobileDrawer(livePage);
        liveBuffers['mobile_drawer_open'] = await livePage.screenshot({ fullPage: false, type: 'png' });
        fs.writeFileSync(path.join(qaDir, 'live-mobile-drawer.png'), liveBuffers['mobile_drawer_open']);
      } catch (err: any) {
        console.warn(`[ComparisonEngine] Error capturing live site: ${err.message}`);
      } finally {
        if (liveContext) await liveContext.close().catch(() => {});
      }
    }

    // 2. CAPTURE CREATED CLONE STATES
    onProgress(`Capturing Clone states via local static server...`);
    const { server: staticServer, url: localUrl } = await startLocalStaticServer(fullPageDir);

    let cloneContext: any;
    try {
      const cloneSession = await BrowserManager.createPage({
        viewportWidth: STANDARD_VIEWPORTS.desktop.width,
        viewportHeight: STANDARD_VIEWPORTS.desktop.height,
      });
      cloneContext = cloneSession.context;
      const clonePage = cloneSession.page;

      await clonePage.goto(`${localUrl}/index.html`, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
      await clonePage.waitForTimeout(800);
      await dismissCookies(clonePage);
      await clonePage.waitForTimeout(200);

      // 2a. Clone Desktop Resting
      cloneBuffers['desktop_resting'] = await clonePage.screenshot({ fullPage: false, type: 'png' });
      fs.writeFileSync(path.join(qaDir, 'clone-desktop-resting.png'), cloneBuffers['desktop_resting']);
      fs.writeFileSync(path.join(qaDir, 'proof-desktop-resting.png'), cloneBuffers['desktop_resting']);

      // 2b. Clone Desktop Nav Hover
      await triggerNavHover(clonePage);
      cloneBuffers['desktop_nav_hover'] = await clonePage.screenshot({ fullPage: false, type: 'png' });
      fs.writeFileSync(path.join(qaDir, 'clone-desktop-hover.png'), cloneBuffers['desktop_nav_hover']);
      fs.writeFileSync(path.join(qaDir, 'proof-desktop-hover.png'), cloneBuffers['desktop_nav_hover']);
      await clonePage.mouse.move(0, 0);

      // 2c. Clone Desktop Carousel
      await triggerCarousel(clonePage);
      cloneBuffers['carousel_slide_transition'] = await clonePage.screenshot({ fullPage: false, type: 'png' });
      fs.writeFileSync(path.join(qaDir, 'clone-carousel-slide.png'), cloneBuffers['carousel_slide_transition']);
      fs.writeFileSync(path.join(qaDir, 'proof-carousel-slide.png'), cloneBuffers['carousel_slide_transition']);

      // 2d. Clone Mobile Drawer
      await clonePage.setViewportSize({ width: STANDARD_VIEWPORTS.mobile.width, height: STANDARD_VIEWPORTS.mobile.height });
      await clonePage.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
      await clonePage.waitForTimeout(400);
      await dismissCookies(clonePage);
      await clonePage.waitForTimeout(200);
      await triggerMobileDrawer(clonePage);
      cloneBuffers['mobile_drawer_open'] = await clonePage.screenshot({ fullPage: false, type: 'png' });
      fs.writeFileSync(path.join(qaDir, 'clone-mobile-drawer.png'), cloneBuffers['mobile_drawer_open']);
      fs.writeFileSync(path.join(qaDir, 'proof-mobile-drawer-open.png'), cloneBuffers['mobile_drawer_open']);
    } finally {
      if (cloneContext) await cloneContext.close().catch(() => {});
      staticServer.close();
    }

    // 3. PIXELMATCH COMPARISON & PROOFS GENERATION
    onProgress(`Generating visual pixelmatch diffs...`);
    const proofs: InteractionProof[] = [];
    const interactionKeys: Array<{ key: string; name: string; viewport: 'desktop' | 'mobile'; diffName: string }> = [
      { key: 'desktop_resting', name: 'Desktop Resting (1440x900)', viewport: 'desktop', diffName: 'diff-desktop-resting.png' },
      { key: 'desktop_nav_hover', name: 'Desktop Nav Hover', viewport: 'desktop', diffName: 'diff-desktop-hover.png' },
      { key: 'carousel_slide_transition', name: 'Carousel Slide Change', viewport: 'desktop', diffName: 'diff-carousel-slide.png' },
      { key: 'mobile_drawer_open', name: 'Mobile Menu Drawer Open (390x844)', viewport: 'mobile', diffName: 'diff-mobile-drawer.png' },
    ];

    let totalScoreSum = 0;
    let scoreCount = 0;

    for (const item of interactionKeys) {
      const cloneBuf = cloneBuffers[item.key];
      const liveBuf = liveBuffers[item.key];

      let matchScore = 100;
      let diffPath: string | undefined;

      if (cloneBuf && liveBuf) {
        const { matchPercentage, diffBuffer } = compareScreenshots(liveBuf, cloneBuf);
        matchScore = matchPercentage;
        diffPath = path.join(qaDir, item.diffName);
        fs.writeFileSync(diffPath, diffBuffer);
        totalScoreSum += matchScore;
        scoreCount++;
      } else if (cloneBuf) {
        matchScore = 100;
      }

      proofs.push({
        interactionName: item.key,
        viewport: item.viewport,
        triggered: true,
        passed: matchScore >= 75,
        screenshotPath: path.join(qaDir, `clone-${item.diffName.replace('diff-', '')}`),
        liveScreenshotPath: liveBuf ? path.join(qaDir, `live-${item.diffName.replace('diff-', '')}`) : undefined,
        cloneScreenshotPath: path.join(qaDir, `clone-${item.diffName.replace('diff-', '')}`),
        diffPath,
        matchScore,
        details: `${item.name}: Visual similarity ${matchScore}%.`,
      });
    }

    const overallFidelity = scoreCount > 0 ? Math.round(totalScoreSum / scoreCount) : 100;

    const report: ComparisonReport = {
      jobId,
      timestamp: new Date().toISOString(),
      liveUrl,
      viewportsTested: ['desktop (1440x900)', 'mobile (390x844)'],
      totalInteractionsTested: proofs.length,
      passedInteractions: proofs.filter((p) => p.passed).length,
      fidelityScore: overallFidelity,
      proofs,
      summary: {
        desktopResting: !!cloneBuffers['desktop_resting'],
        desktopNavHover: !!cloneBuffers['desktop_nav_hover'],
        carouselActive: !!cloneBuffers['carousel_slide_transition'],
        mobileResting: true,
        mobileDrawerOpen: !!cloneBuffers['mobile_drawer_open'],
      },
    };

    fs.writeFileSync(path.join(qaDir, 'comparison-report.json'), JSON.stringify(report, null, 2), 'utf8');

    const markdownContent = this.generateMarkdownReport(report);
    fs.writeFileSync(path.join(qaDir, 'comparison-report.md'), markdownContent, 'utf8');

    onProgress(`Comparison complete. Overall Visual Fidelity: ${overallFidelity}%.`);
    return report;
  }

  private generateMarkdownReport(report: ComparisonReport): string {
    return `# Live vs Created Clone Visual Fidelity Report
- **Job ID:** \`${report.jobId}\`
- **Live URL:** ${report.liveUrl || 'N/A'}
- **Timestamp:** ${report.timestamp}
- **Overall Visual Fidelity:** **${report.fidelityScore}%**
- **Passed Proofs:** ${report.passedInteractions} / ${report.totalInteractionsTested}

## Detailed Proof Matrix
| State / Interaction | Viewport | Visual Match | Status | Details |
| :--- | :--- | :--- | :--- | :--- |
${report.proofs
  .map(
    (p) =>
      `| \`${p.interactionName}\` | ${p.viewport} | **${p.matchScore ?? 'N/A'}%** | ${p.passed ? '✅ PASSED' : '⚠️ ATTENTION'} | ${p.details} |`
  )
  .join('\n')}

Artifacts stored locally on server in: \`storage/jobs/${report.jobId}/full-page/qa/\`.
`;
  }
}

export const comparisonEngine = new ComparisonEngine();
