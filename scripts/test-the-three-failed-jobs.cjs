const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { chromium } = require('playwright');
const { GroundUpSynthesisEngine } = require('../dist/synthesis/engine.js');
const { FidelityGuard } = require('../dist/validator/fidelity-guard.js');

const CHROME_EXECUTABLE = '/Users/dhanashreedhruval/Library/Caches/ms-playwright/chromium-1243/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

async function resynthesizeAndTest(jobId, name, interactionFn) {
  console.log(`\n======================================================`);
  console.log(`Re-synthesizing & Testing [${name}] (jobId: ${jobId})...`);
  console.log(`======================================================`);

  const jobDir = path.join(__dirname, '../storage/jobs', jobId);
  const jobMetaPath = path.join(jobDir, 'job.json');
  if (!fs.existsSync(jobMetaPath)) {
    console.error(`Job metadata not found: ${jobMetaPath}`);
    return;
  }

  const job = JSON.parse(fs.readFileSync(jobMetaPath, 'utf8'));
  const sourceUrl = job.url;
  const options = job.options || {};

  // 1. Gather raw CSS
  const rawSheets = Array.isArray(options.clientStylesheets)
    ? options.clientStylesheets
    : options.clientStylesheets ? [options.clientStylesheets] : [];

  const seen = new Set();
  const sheets = [];
  for (const s of rawSheets) {
    const t = (s || '').trim();
    if (!t) continue;
    const k = t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/[\s"';\\]+/g, '').slice(0, 300);
    if (!seen.has(k)) { seen.add(k); sheets.push(t); }
  }

  if (options.htmlSnapshot) {
    const $snap = cheerio.load(options.htmlSnapshot);
    $snap('style').each((_, el) => {
      const c = $snap(el).html();
      if (c && c.trim()) {
        const k = c.trim().replace(/\/\*[\s\S]*?\*\//g, '').replace(/[\s"';\\]+/g, '').slice(0, 300);
        if (!seen.has(k)) { seen.add(k); sheets.push(c.trim()); }
      }
    });
  }

  // Also read stored reconstruction.css as fallback if sheets are small
  const existingCssPath = path.join(jobDir, 'reconstruction.css');
  if (sheets.length === 0 && fs.existsSync(existingCssPath)) {
    sheets.push(fs.readFileSync(existingCssPath, 'utf8'));
  }

  const rawCss = sheets.join('\n');
  console.log(`  Raw CSS: ${rawCss.length} bytes`);

  let targetHtml = options.sectionHtml || '';
  const effectiveSelector = options.sectionSelector || 'section';
  if (!targetHtml && options.htmlSnapshot) {
    try {
      const $snap = cheerio.load(options.htmlSnapshot);
      const selTarget = $snap(effectiveSelector).first();
      if (selTarget.length > 0) targetHtml = $snap.html(selTarget);
    } catch {}
  }
  if (!targetHtml && fs.existsSync(path.join(jobDir, 'reconstruction.html'))) {
    targetHtml = fs.readFileSync(path.join(jobDir, 'reconstruction.html'), 'utf8');
  }

  console.log(`  Target HTML: ${targetHtml.length} bytes`);

  const synthesisEngine = new GroundUpSynthesisEngine();
  const secRes = synthesisEngine.synthesizeSection(
    targetHtml,
    sourceUrl,
    rawCss,
    effectiveSelector,
    options.targetArchetype,
    options.htmlSnapshot,
    options.recordedInteractions,
    options.rootCssVariables
  );

  let htmlAttrs = 'lang="en"';
  let bodyAttrs = '';
  if (options.htmlSnapshot) {
    try {
      const $snap = cheerio.load(options.htmlSnapshot);
      const hCls = $snap('html').attr('class') || '';
      const bCls = $snap('body').attr('class') || '';
      if (hCls) htmlAttrs += ` class="${hCls}"`;
      if (bCls) bodyAttrs = ` class="${bCls}"`;
    } catch {}
  }

  let fullHtml = `<!DOCTYPE html>
<html ${htmlAttrs}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name} - Verified Synthesis</title>
  <link rel="stylesheet" href="style.css">
</head>
<body${bodyAttrs}>
${secRes.html}
  <script src="script.js" defer></script>
</body>
</html>`;

  let fullCss = secRes.css;
  let fullJs = secRes.js;

  // FidelityGuard
  try {
    const guard = new FidelityGuard();
    const guardRes = await guard.auditAndHeal({
      html: fullHtml,
      css: fullCss,
      js: fullJs,
      rawWebsiteCss: rawCss,
      rawSnapshotHtml: options.htmlSnapshot || options.sectionHtml || '',
      sourceUrl: sourceUrl,
    });
    if (guardRes.patches.length > 0) {
      console.log(`  FidelityGuard applied ${guardRes.patches.length} patches.`);
      fullHtml = guardRes.healedHtml;
      fullCss = guardRes.healedCss;
      fullJs = guardRes.healedJs;
    }
  } catch (err) {
    console.warn(`  FidelityGuard warning:`, err.message);
  }

  // Save to test folder
  const testDir = path.join(__dirname, '../storage/test_eval', jobId);
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(path.join(testDir, 'index.html'), fullHtml, 'utf8');
  fs.writeFileSync(path.join(testDir, 'style.css'), fullCss, 'utf8');
  fs.writeFileSync(path.join(testDir, 'script.js'), fullJs, 'utf8');

  // Also update full-page inside job dir
  const fullPageDir = path.join(jobDir, 'full-page');
  fs.mkdirSync(fullPageDir, { recursive: true });
  fs.writeFileSync(path.join(fullPageDir, 'index.html'), fullHtml, 'utf8');
  fs.writeFileSync(path.join(fullPageDir, 'style.css'), fullCss, 'utf8');
  fs.writeFileSync(path.join(fullPageDir, 'script.js'), fullJs, 'utf8');
  fs.writeFileSync(path.join(jobDir, 'reconstruction.html'), fullHtml, 'utf8');
  fs.writeFileSync(path.join(jobDir, 'reconstruction.css'), fullCss, 'utf8');

  // Launch Playwright & Capture Screenshot
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(CHROME_EXECUTABLE) ? CHROME_EXECUTABLE : undefined,
    args: ['--disable-web-security', '--allow-running-insecure-content']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`file://${path.join(testDir, 'index.html')}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const defaultScreenshotPath = path.join(__dirname, '../storage', `${name.toLowerCase()}_overhaul_default.png`);
  await page.screenshot({ path: defaultScreenshotPath });
  console.log(`  ✓ Saved resting screenshot: ${defaultScreenshotPath}`);

  if (interactionFn) {
    await interactionFn(page);
    await page.waitForTimeout(1000);
    const interactedScreenshotPath = path.join(__dirname, '../storage', `${name.toLowerCase()}_overhaul_interacted.png`);
    await page.screenshot({ path: interactedScreenshotPath });
    console.log(`  ✓ Saved interaction screenshot: ${interactedScreenshotPath}`);
  }

  await browser.close();
}

async function run() {
  // 1. Makenica
  await resynthesizeAndTest('job_028ee1d1a2e148da', 'Makenica', async (page) => {
    // Check airplane/testimonial hero is visible
    const heroVisible = await page.evaluate(() => {
      const hero = document.querySelector('.hidden.lg\\:flex, [class*="hidden"][class*="lg:flex"]');
      return hero ? window.getComputedStyle(hero).display : 'not-found';
    });
    console.log(`  Makenica hero computed display: ${heroVisible}`);
  });

  // 2. Casio
  await resynthesizeAndTest('job_00b975f754a74ea8', 'Casio', async (page) => {
    // Check logo dimensions
    const logoDimensions = await page.evaluate(() => {
      const svg = document.querySelector('svg.gshock, svg.casio, svg.music, .cmp-header-logo svg');
      return svg ? { width: svg.getBoundingClientRect().width, height: svg.getBoundingClientRect().height } : null;
    });
    console.log(`  Casio SVG logo dimensions:`, logoDimensions);

    // Click "Watches"
    console.log(`  Clicking "Watches" trigger...`);
    const clicked = await page.evaluate(() => {
      const a = document.querySelector('a[data-accordion-title*="nav-item-1"], .cmp-header-navigation__item a');
      if (a) {
        a.click();
        return true;
      }
      return false;
    });
    console.log(`  Clicked: ${clicked}`);
  });

  // 3. The Printable Watch
  await resynthesizeAndTest('job_5408df4dd42b49b1', 'PrintableWatch', async (page) => {
    const headerDisplay = await page.evaluate(() => {
      const h = document.querySelector('header, .header, sticky-header');
      return h ? { display: window.getComputedStyle(h).display, height: h.getBoundingClientRect().height } : null;
    });
    console.log(`  PrintableWatch header display & height:`, headerDisplay);
  });

  console.log('\n=== ALL 3 TARGET TESTS FINISHED ===\n');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
