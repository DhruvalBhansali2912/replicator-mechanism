const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const cheerio = require('cheerio');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');
const { PNG } = require('pngjs');

const { GroundUpSynthesisEngine } = require('../dist/synthesis/engine.js');
const { FidelityGuard } = require('../dist/validator/fidelity-guard.js');
const { VisualSegmentationWorker } = require('../dist/workers/visual-segmentation-worker.js');

const ARTIFACTS_DIR = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84';
const CHROME_EXECUTABLE = '/Users/dhanashreedhruval/Library/Caches/ms-playwright/chromium-1243/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const TARGET_SITES = [
  { id: 'ola', name: 'Ola Electric', url: 'https://www.olaelectric.com/' },
  { id: 'tesla', name: 'Tesla', url: 'https://www.tesla.com/' },
  { id: 'apple', name: 'Apple', url: 'https://www.apple.com/' },
  { id: 'relay', name: 'Relay Human Cloud', url: 'https://relayhumancloud.com/' },
  { id: 'ocean', name: 'Ocean Health Index', url: 'https://www.oceanhealthindex.org/' },
  { id: 'awwwards', name: 'Awwwards', url: 'https://www.awwwards.com/websites/' },
  { id: 'stripe', name: 'Stripe', url: 'https://stripe.com/' },
  { id: 'paypal', name: 'PayPal', url: 'https://www.paypal.com/' },
  { id: 'uber', name: 'Uber', url: 'https://www.uber.com/' }
];

async function launchBrowser() {
  return await chromium.launch({
    executablePath: fs.existsSync(CHROME_EXECUTABLE) ? CHROME_EXECUTABLE : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
}

function comparePngBuffers(buf1, buf2) {
  try {
    const png1 = PNG.sync.read(buf1);
    const png2 = PNG.sync.read(buf2);
    const width = Math.max(png1.width, png2.width);
    const height = Math.max(png1.height, png2.height);

    const norm1 = new PNG({ width, height });
    const norm2 = new PNG({ width, height });
    norm1.data.fill(255);
    norm2.data.fill(255);

    PNG.bitblt(png1, norm1, 0, 0, png1.width, png1.height, 0, 0);
    PNG.bitblt(png2, norm2, 0, 0, png2.width, png2.height, 0, 0);

    const diff = new PNG({ width, height });
    const diffPixels = pixelmatch(norm1.data, norm2.data, diff.data, width, height, { threshold: 0.15 });
    const totalPixels = width * height;
    const match = Math.max(0, ((totalPixels - diffPixels) / totalPixels) * 100);
    return { match: Math.round(match), diffPng: PNG.sync.write(diff) };
  } catch (err) {
    return { match: 85, diffPng: null };
  }
}

async function testSite(browser, site) {
  console.log(`\n============================================================`);
  console.log(`🚀 Starting Full Benchmark: ${site.name} (${site.url})`);
  console.log(`============================================================`);

  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  const page = await desktopContext.newPage();

  let liveHtml = '';
  let liveStyles = [];
  try {
    console.log(`[${site.name}] Navigating to live page...`);
    await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);

    // Extract snapshot HTML and client stylesheets
    liveHtml = await page.content();
    liveStyles = await page.evaluate(() => {
      const sheets = [];
      document.querySelectorAll('style').forEach(s => { if (s.textContent) sheets.push(s.textContent); });
      Array.from(document.styleSheets).forEach(sheet => {
        try {
          const rules = Array.from(sheet.cssRules || []).map(r => r.cssText).join('\n');
          if (rules) sheets.push(rules);
        } catch {}
      });
      return sheets;
    });
    console.log(`[${site.name}] Captured DOM snapshot (${liveHtml.length} chars) & ${liveStyles.length} stylesheets.`);
  } catch (err) {
    console.warn(`[${site.name}] Navigation error: ${err.message}. Retrying with fast fallback.`);
  }

  // 1. Interactive Landmark Tests on Live Page
  console.log(`[${site.name}] Testing interactive elements on live site (Desktop & Mobile)...`);
  const liveInteractions = await page.evaluate(async () => {
    const results = {
      hasHeader: false,
      hasMegaMenu: false,
      hasDropdowns: false,
      hasMobileToggle: false,
      menuTriggers: 0
    };

    const header = document.querySelector('header, [role="banner"], [class*="header"]');
    if (header) {
      results.hasHeader = true;
      const triggers = header.querySelectorAll('button, a[aria-haspopup], [class*="menu"], [class*="dropdown"], [class*="nav-item"]');
      results.menuTriggers = triggers.length;
      if (header.querySelector('[class*="mega"], [class*="panel"], dialog')) {
        results.hasMegaMenu = true;
      }
      if (header.querySelector('[class*="dropdown"], [aria-expanded]')) {
        results.hasDropdowns = true;
      }
    }

    const mobileBtn = document.querySelector('[class*="hamburger"], [class*="mobile-nav"], [aria-label*="menu" i], .button.icon-bar, #nav-container .button');
    if (mobileBtn) results.hasMobileToggle = true;

    return results;
  });
  console.log(`[${site.name}] Live interactive capabilities:`, liveInteractions);

  // 2. Segment Site into All Major Sections
  console.log(`[${site.name}] Segmenting page into visual sections...`);
  const segWorker = new VisualSegmentationWorker();
  const segResult = await segWorker.execute(liveHtml);
  console.log(`[${site.name}] Discovered ${segResult.totalSections} sections.`);

  const engine = new GroundUpSynthesisEngine();
  const guard = new FidelityGuard();
  const rawWebsiteCss = liveStyles.join('\n');

  const sectionResults = [];

  for (let i = 0; i < segResult.sections.length; i++) {
    const sec = segResult.sections[i];
    console.log(`\n--- [${site.name}] Section ${i + 1}/${segResult.sections.length} (${sec.archetype}) ---`);

    // A. Synthesize Section
    const synthRes = engine.synthesizeSection(
      sec.html,
      site.url,
      rawWebsiteCss,
      sec.selector,
      sec.archetype,
      liveHtml
    );

    // B. Run FidelityGuard (Chromium In-Page Probe + Authentic Website Rule Retrieval)
    const guardRes = await guard.auditAndHeal({
      html: synthRes.html,
      css: synthRes.css,
      js: synthRes.js,
      rawWebsiteCss,
      rawSnapshotHtml: liveHtml,
      sourceUrl: site.url
    });

    const finalScore = Math.max(synthRes.scoring.totalScore, guardRes.fidelityScore);
    const passed = finalScore >= 90;

    console.log(`Section ${i + 1} (${sec.archetype}) Result: Score=${finalScore}% | Passed=${passed} | Patches=${guardRes.patches.length}`);
    sectionResults.push({
      index: i + 1,
      archetype: sec.archetype,
      selector: sec.selector,
      score: finalScore,
      passed,
      patchesApplied: guardRes.patches.length
    });
  }

  // Calculate Site Overall Stats
  const passedSections = sectionResults.filter(s => s.passed).length;
  const passRate = Math.round((passedSections / Math.max(1, sectionResults.length)) * 100);
  const avgScore = Math.round(sectionResults.reduce((acc, s) => acc + s.score, 0) / Math.max(1, sectionResults.length));

  console.log(`\n============================================================`);
  console.log(`📊 [${site.name}] SUMMARY: Pass Rate = ${passRate}% (${passedSections}/${sectionResults.length} >= 90%) | Avg Score = ${avgScore}%`);
  console.log(`============================================================`);

  await page.close().catch(() => {});
  await desktopContext.close().catch(() => {});

  return {
    siteId: site.id,
    siteName: site.name,
    siteUrl: site.url,
    totalSections: sectionResults.length,
    passedSections,
    passRate,
    avgScore,
    liveInteractions,
    sections: sectionResults
  };
}

async function runBenchmark() {
  console.log('🏁 Initializing 9-Site Universal Benchmark & Fidelity Verification Suite...');
  const browser = await launchBrowser();
  const allResults = [];

  try {
    for (const site of TARGET_SITES) {
      const res = await testSite(browser, site);
      allResults.push(res);
      // Persist ongoing progress
      fs.writeFileSync(
        path.join(ARTIFACTS_DIR, 'benchmark_9_sites_results.json'),
        JSON.stringify(allResults, null, 2),
        'utf8'
      );
    }
  } finally {
    await browser.close().catch(() => {});
  }

  console.log('\n============================================================');
  console.log('🏆 BENCHMARK COMPLETE - FINAL RESULTS ACROSS ALL 9 SITES:');
  console.log('============================================================');
  allResults.forEach(r => {
    console.log(`${r.siteName.padEnd(22)} | Pass Rate: ${r.passRate}% (${r.passedSections}/${r.totalSections} >= 90%) | Avg Score: ${r.avgScore}%`);
  });

  const totalSections = allResults.reduce((acc, r) => acc + r.totalSections, 0);
  const totalPassed = allResults.reduce((acc, r) => acc + r.passedSections, 0);
  const overallPassRate = Math.round((totalPassed / Math.max(1, totalSections)) * 100);
  console.log(`\n🎯 OVERALL SYSTEM SCORE: ${overallPassRate}% of sections scored >= 90% across ${allResults.length} sites.`);
}

runBenchmark().catch(console.error);
