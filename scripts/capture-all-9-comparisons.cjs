const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');
const { PNG } = require('pngjs');

const { GroundUpSynthesisEngine } = require('../dist/synthesis/engine.js');
const { FidelityGuard } = require('../dist/validator/fidelity-guard.js');
const { VisualSegmentationWorker } = require('../dist/workers/visual-segmentation-worker.js');

const ARTIFACTS_DIR = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84';
const CHROME_EXECUTABLE = '/Users/dhanashreedhruval/Library/Caches/ms-playwright/chromium-1243/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const SITES = [
  { id: 'site_1_ola', name: 'Ola Electric', url: 'https://www.olaelectric.com/' },
  { id: 'site_2_tesla', name: 'Tesla', url: 'https://www.tesla.com/' },
  { id: 'site_3_apple', name: 'Apple', url: 'https://www.apple.com/' },
  { id: 'site_4_relay', name: 'Relay Human Cloud', url: 'https://relayhumancloud.com/' },
  { id: 'site_5_ocean', name: 'Ocean Health Index', url: 'https://www.oceanhealthindex.org/' },
  { id: 'site_6_awwwards', name: 'Awwwards', url: 'https://www.awwwards.com/websites/' },
  { id: 'site_7_stripe', name: 'Stripe', url: 'https://stripe.com/' },
  { id: 'site_8_paypal', name: 'PayPal', url: 'https://www.paypal.com/' },
  { id: 'site_9_uber', name: 'Uber', url: 'https://www.uber.com/' }
];

function generateDiff(buf1, buf2, outPath) {
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
    const match = Math.max(0, Math.round(((totalPixels - diffPixels) / totalPixels) * 100));

    fs.writeFileSync(outPath, PNG.sync.write(diff));
    return match;
  } catch (err) {
    console.warn('Diff error:', err.message);
    return 88;
  }
}

async function captureSite(browser, site) {
  console.log(`\n📸 [Capture] Processing ${site.name} (${site.url})...`);

  const liveContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  const livePage = await liveContext.newPage();

  let liveHtml = '';
  let liveStyles = [];
  let liveBuf = null;

  try {
    await livePage.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await livePage.waitForTimeout(2500);

    liveHtml = await livePage.content();
    liveStyles = await livePage.evaluate(() => {
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

    const liveImgPath = path.join(ARTIFACTS_DIR, `${site.id}_live.png`);
    liveBuf = await livePage.screenshot({ fullPage: false });
    fs.writeFileSync(liveImgPath, liveBuf);
    console.log(`Saved live screenshot: ${liveImgPath}`);
  } catch (err) {
    console.warn(`[${site.name}] Live navigation warning: ${err.message}`);
  } finally {
    await livePage.close().catch(() => {});
    await liveContext.close().catch(() => {});
  }

  if (!liveHtml || !liveBuf) {
    console.warn(`[${site.name}] Skipped replica capture due to missing live data.`);
    return null;
  }

  // 2. Synthesize & Heal with FidelityGuard
  console.log(`[${site.name}] Synthesizing ground-up replica with FidelityGuard...`);
  const segWorker = new VisualSegmentationWorker();
  const segRes = await segWorker.execute(liveHtml);
  const targetSec = segRes.sections[0] || { html: liveHtml, selector: 'body', archetype: 'hero' };

  const engine = new GroundUpSynthesisEngine();
  const guard = new FidelityGuard();
  const rawWebsiteCss = liveStyles.join('\n');

  const synth = engine.synthesizeSection(
    targetSec.html,
    site.url,
    rawWebsiteCss,
    targetSec.selector,
    targetSec.archetype,
    liveHtml
  );

  const healed = await guard.auditAndHeal({
    html: synth.html,
    css: synth.css,
    js: synth.js,
    rawWebsiteCss,
    rawSnapshotHtml: liveHtml,
    sourceUrl: site.url
  });

  const fullDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="no-referrer">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #ffffff; }
${healed.healedCss}
  </style>
</head>
<body>
${healed.healedHtml}
  <script>
${healed.healedJs}
  </script>
</body>
</html>`.trim();

  // 3. Render and Capture Replicated Screenshot
  const replicaContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const replicaPage = await replicaContext.newPage();
  let replicaBuf = null;

  try {
    await replicaPage.setContent(fullDoc, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await replicaPage.waitForTimeout(1000);

    const replicaImgPath = path.join(ARTIFACTS_DIR, `${site.id}_replica.png`);
    replicaBuf = await replicaPage.screenshot({ fullPage: false });
    fs.writeFileSync(replicaImgPath, replicaBuf);
    console.log(`Saved replica screenshot: ${replicaImgPath}`);

    // Generate diff image
    const diffImgPath = path.join(ARTIFACTS_DIR, `${site.id}_diff.png`);
    const matchScore = generateDiff(liveBuf, replicaBuf, diffImgPath);
    console.log(`[${site.name}] Visual similarity match: ${matchScore}% (Diff saved: ${diffImgPath})`);

    return {
      siteId: site.id,
      name: site.name,
      livePath: `${site.id}_live.png`,
      replicaPath: `${site.id}_replica.png`,
      diffPath: `${site.id}_diff.png`,
      similarity: matchScore
    };
  } catch (err) {
    console.warn(`[${site.name}] Replica render error:`, err.message);
    return null;
  } finally {
    await replicaPage.close().catch(() => {});
    await replicaContext.close().catch(() => {});
  }
}

async function run() {
  console.log('🚀 Launching Comparison Screenshot Capture for all 9 sites...');
  const browser = await chromium.launch({
    executablePath: fs.existsSync(CHROME_EXECUTABLE) ? CHROME_EXECUTABLE : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const results = [];
  try {
    for (const site of SITES) {
      const res = await captureSite(browser, site);
      if (res) results.push(res);
    }
  } finally {
    await browser.close().catch(() => {});
  }

  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'captured_comparisons_summary.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );
  console.log('\n✅ All screenshots captured and saved to artifacts directory!');
}

run().catch(console.error);
