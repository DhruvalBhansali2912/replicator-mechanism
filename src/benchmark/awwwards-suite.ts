import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

export interface BenchmarkSite {
  id: string;
  name: string;
  url: string;
  preloaderSelector?: string;
  expectedKeywords: string[];
}

export const BENCHMARK_SITES: BenchmarkSite[] = [
  {
    id: 'forge-automotive',
    name: 'Forge Automotive',
    url: 'https://forgeautomotive.co.uk/',
    expectedKeywords: ['Forge', 'Ordinary', 'Bespoke', 'Builds'],
  },
  {
    id: 'emotion-agency',
    name: 'Emotion Agency',
    url: 'https://emotion-agency.com/',
    expectedKeywords: ['Emotion', 'Digital', 'Awards', 'Projects'],
  },
  {
    id: 'brandon-yasin',
    name: 'Brandon Yasin',
    url: 'https://brandonyasin.com/',
    expectedKeywords: ['Brandon', 'Yasin', 'Archive', 'Work'],
  },
  {
    id: 'basic-agency',
    name: 'BASIC/DEPT®',
    url: 'https://basicagency.com/',
    expectedKeywords: ['BASIC', 'DEPT', 'Digital', 'Brand'],
  },
  {
    id: 'apple-iphone',
    name: 'Apple iPhone 16 Pro',
    url: 'https://www.apple.com/iphone-16-pro/',
    expectedKeywords: ['iPhone', 'Apple', 'Titanium', 'Camera'],
  },
  {
    id: 'phantom-land',
    name: 'Phantom',
    url: 'https://phantom.land/',
    expectedKeywords: ['Phantom', 'Creative', 'Design', 'Studio'],
  },
  {
    id: 'monopo-london',
    name: 'Monopo London',
    url: 'https://monopo.london/',
    expectedKeywords: ['monopo', 'london', 'design', 'culture'],
  },
  {
    id: 'kffein-com',
    name: 'Kffein',
    url: 'https://kffein.com/',
    expectedKeywords: ['Kffein', 'Digital', 'Studio', 'Projets'],
  },
  {
    id: 'linear-app',
    name: 'Linear',
    url: 'https://linear.app/',
    expectedKeywords: ['Linear', 'Issue', 'Tracking', 'Software'],
  },
  {
    id: 'stripe-com',
    name: 'Stripe',
    url: 'https://stripe.com/',
    expectedKeywords: ['Stripe', 'Financial', 'Infrastructure', 'Payments'],
  },
];

const API_BASE = 'https://replicator.inventkid.com';
const API_TOKEN = 'rep_live_4a23e9b593096174984d563f62ee77a3';
const ARTIFACTS_DIR = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84';

/**
 * Simulate authentic human user behavior:
 * - Dismiss preloaders or cookie banners
 * - Progressive scroll through document to trigger GSAP, Lenis, and intersection observers
 * - Hover over interactive buttons and media cards
 * - Scroll back to resting hero position
 */
export async function simulateUserInteraction(page: Page, isPreview: boolean = false): Promise<void> {
  // 1. Preloader / banner dismiss
  try {
    const dismissButtons = await page.$$('button:has-text("Accept"), button:has-text("accept"), button:has-text("Agree"), button:has-text("Allow"), button:has-text("OK"), [id*="cookie"] button, [class*="cookie"] button');
    if (dismissButtons.length > 0) {
      await dismissButtons[0].click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  } catch {}

  // 2. Progressive scroll down to load lazy assets & trigger animations
  const scrollHeight = await page.evaluate(() => document.body.scrollHeight || 3000);
  const step = 450;
  const maxScroll = Math.min(scrollHeight, 7000); // sample up to 7000px

  for (let y = 0; y < maxScroll; y += step) {
    await page.evaluate((pos) => window.scrollTo({ top: pos, behavior: 'instant' }), y);
    await page.waitForTimeout(100);

    // Hover over elements near current viewport
    if (!isPreview && y % 900 === 0) {
      try {
        const hoverTarget = await page.$('a, button, [class*="item"], [class*="card"]');
        if (hoverTarget) {
          const box = await hoverTarget.boundingBox();
          if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          }
        }
      } catch {}
    }
  }

  // 3. Scroll back to top
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(800);
}

/**
 * Extract runtime client stylesheets just like the Chrome Extension does
 */
export async function extractRuntimeStylesheets(page: Page): Promise<Array<{ href?: string; cssText: string }>> {
  return await page.evaluate(() => {
    const sheets: Array<{ href?: string; cssText: string }> = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = Array.from(sheet.cssRules || []).map((r) => r.cssText).join('\n');
        sheets.push({ href: sheet.href || undefined, cssText: rules });
      } catch {
        // Cross-origin sheet access restriction fallback
        if (sheet.href) {
          sheets.push({ href: sheet.href, cssText: '' });
        }
      }
    }
    return sheets;
  });
}

/**
 * Run benchmark on a single site
 */
export async function benchmarkSite(site: BenchmarkSite): Promise<{
  siteId: string;
  name: string;
  jobId: string;
  previewUrl: string;
  score: number;
  checks: {
    heroFound: boolean;
    headerFound: boolean;
    textMatchScore: number;
    sectionCount: number;
    bgContrastPassed: boolean;
  };
}> {
  console.log(`\n======================================================`);
  console.log(`🚀 Benchmarking Site: ${site.name} (${site.url})`);
  console.log(`======================================================`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // 1. Visit original site
  console.log(`[${site.id}] Navigating to original site...`);
  await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // 2. Simulate User Behavior
  console.log(`[${site.id}] Simulating authentic user interaction (scroll, hover)...`);
  await simulateUserInteraction(page, false);

  // 3. Take original screenshot and extract client DOM/CSS
  const origScreenshotBuffer = await page.screenshot({ fullPage: false });
  const origScreenshotBase64 = `data:image/png;base64,${origScreenshotBuffer.toString('base64')}`;
  const origHtml = await page.evaluate(() => document.documentElement.outerHTML);
  const clientStylesheets = await extractRuntimeStylesheets(page);

  const origInfo = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, [class*="hero"] [class*="title"], [class*="hero"] h2')).map((el) => el.textContent?.trim() || '');
    const bodyText = document.body.innerText || '';
    return { headings, bodyTextLength: bodyText.length };
  });

  console.log(`[${site.id}] Original headings:`, origInfo.headings.slice(0, 3));

  // 4. Submit Job to API
  console.log(`[${site.id}] Submitting reconstruction job to API...`);
  const submitRes = await fetch(`${API_BASE}/api/v1/reconstruction`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: site.url,
      htmlSnapshot: origHtml,
      clientStylesheets,
      clientScreenshot: origScreenshotBase64,
      options: {
        url: site.url,
        htmlSnapshot: origHtml,
        clientStylesheets,
        clientScreenshot: origScreenshotBase64,
      },
    }),
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text();
    await browser.close();
    throw new Error(`Failed to submit job for ${site.name}: ${submitRes.status} ${errText}`);
  }

  const submitData = (await submitRes.json()) as any;
  const jobId = submitData.job_id;
  console.log(`[${site.id}] Job queued: ${jobId}. Polling for completion...`);

  // 5. Poll Job
  let completedJob: any = null;
  for (let attempt = 1; attempt <= 45; attempt++) {
    await new Promise((r) => setTimeout(r, 2500));
    const pollRes = await fetch(`${API_BASE}/api/v1/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
    });
    if (pollRes.ok) {
      const data = (await pollRes.json()) as any;
      if (data.status === 'completed') {
        completedJob = data;
        break;
      }
      if (data.status === 'failed') {
        throw new Error(`Job ${jobId} failed: ${data.error_message || 'unknown error'}`);
      }
    }
  }

  if (!completedJob) {
    await browser.close();
    throw new Error(`Job ${jobId} timed out after polling.`);
  }

  const previewUrl = `${API_BASE}/api/jobs/${jobId}/preview/`;
  console.log(`[${site.id}] Job completed! Preview URL: ${previewUrl}`);

  // 6. Test Reconstructed Preview with Playwright Interactive Simulation
  const previewPage = await context.newPage();
  await previewPage.goto(previewUrl, { waitUntil: 'networkidle', timeout: 25000 }).catch(() => {});
  await previewPage.waitForTimeout(2000);
  await simulateUserInteraction(previewPage, true);

  const previewScreenshotPath = path.join(ARTIFACTS_DIR, `${site.id}_preview.png`);
  await previewPage.screenshot({ path: previewScreenshotPath, fullPage: false });

  const previewInfo = await previewPage.evaluate(() => {
    const header = document.querySelector('header, [role="banner"], [class*="site-header"]');
    const hero = document.querySelector('[class*="hero"], main > section:first-of-type, body > section:nth-of-type(2)');
    const h1 = document.querySelector('h1, [class*="title"]');
    const bodyText = document.body.innerText || '';
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    const allSections = Array.from(document.querySelectorAll('body > section, body > header, body > footer, main > section'));

    return {
      hasHeader: !!header,
      hasHero: !!hero,
      h1Text: h1 ? h1.textContent?.trim() || '' : '',
      bodyText,
      bodyTextLength: bodyText.length,
      bodyBg,
      sectionCount: allSections.length,
      sections: allSections.map((s, idx) => ({
        index: idx,
        tag: s.tagName,
        rect: s.getBoundingClientRect(),
        snippet: (s.textContent || '').slice(0, 80).replace(/\n/g, ' '),
      })),
    };
  });

  await browser.close();

  // 7. Calculate Fidelity Score
  let score = 100;

  // Header check
  const headerFound = previewInfo.hasHeader || previewInfo.sections.some((s) => s.tag === 'HEADER');
  if (!headerFound) score -= 10;

  // Hero check
  const heroFound = previewInfo.hasHero || previewInfo.h1Text.length > 0;
  if (!heroFound) score -= 10;

  // Keyword check
  let matchedKeywords = 0;
  const fullPreviewText = (previewInfo.bodyText || '').toLowerCase();
  for (const kw of site.expectedKeywords) {
    if (fullPreviewText.includes(kw.toLowerCase()) || previewInfo.h1Text.toLowerCase().includes(kw.toLowerCase())) {
      matchedKeywords++;
    }
  }
  const keywordRatio = site.expectedKeywords.length > 0 ? matchedKeywords / site.expectedKeywords.length : 1;
  const keywordScore = Math.round(keywordRatio * 20);
  score -= (20 - keywordScore);

  // Section flow check (should have distinct sections, not 0 and not overlapping)
  const validSections = previewInfo.sectionCount >= 2;
  if (!validSections) score -= 15;

  const bgContrastPassed = previewInfo.bodyBg !== '' && previewInfo.bodyBg !== 'rgba(0, 0, 0, 0)';

  score = Math.max(0, Math.min(100, score));

  console.log(`[${site.id}] Fidelity Evaluation:`);
  console.log(`  - Header Present: ${headerFound}`);
  console.log(`  - Hero Present: ${heroFound}`);
  console.log(`  - Headline / Text: "${previewInfo.h1Text.slice(0, 50)}"`);
  console.log(`  - Matched Keywords: ${matchedKeywords}/${site.expectedKeywords.length}`);
  console.log(`  - Total Flow Sections: ${previewInfo.sectionCount}`);
  console.log(`  - Composite Score: ${score}%`);

  return {
    siteId: site.id,
    name: site.name,
    jobId,
    previewUrl,
    score,
    checks: {
      heroFound,
      headerFound,
      textMatchScore: keywordScore,
      sectionCount: previewInfo.sectionCount,
      bgContrastPassed,
    },
  };
}
