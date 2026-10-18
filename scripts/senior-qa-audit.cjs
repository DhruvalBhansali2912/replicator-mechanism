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

const TEST_SITES = [
  { id: 'site_1_linear', name: 'Linear', url: 'https://linear.app/', theme: 'dark' },
  { id: 'site_2_vercel', name: 'Vercel', url: 'https://vercel.com/', theme: 'dark' },
  { id: 'site_3_github', name: 'GitHub', url: 'https://github.com/', theme: 'dark' },
  { id: 'site_4_airbnb', name: 'Airbnb', url: 'https://www.airbnb.com/', theme: 'light' },
  { id: 'site_5_notion', name: 'Notion', url: 'https://www.notion.so/', theme: 'light' },
  { id: 'site_6_figma', name: 'Figma', url: 'https://www.figma.com/', theme: 'light' },
  { id: 'site_7_spotify', name: 'Spotify', url: 'https://open.spotify.com/', theme: 'dark' },
  { id: 'site_8_dropbox', name: 'Dropbox', url: 'https://www.dropbox.com/', theme: 'light' },
  { id: 'site_9_slack', name: 'Slack', url: 'https://slack.com/', theme: 'light' },
  { id: 'site_10_shopify', name: 'Shopify', url: 'https://www.shopify.com/', theme: 'light' },
  { id: 'site_11_discord', name: 'Discord', url: 'https://discord.com/', theme: 'dark' },
  { id: 'site_12_webflow', name: 'Webflow', url: 'https://webflow.com/', theme: 'dark' },
  { id: 'site_13_raycast', name: 'Raycast', url: 'https://www.raycast.com/', theme: 'dark' },
  { id: 'site_14_supabase', name: 'Supabase', url: 'https://supabase.com/', theme: 'dark' },
  { id: 'site_15_resend', name: 'Resend', url: 'https://resend.com/', theme: 'dark' },
  { id: 'site_16_framer', name: 'Framer', url: 'https://www.framer.com/', theme: 'dark' }
];

function calculateSimilarity(buf1, buf2) {
  try {
    const img1 = PNG.sync.read(buf1);
    const img2 = PNG.sync.read(buf2);
    const width = Math.max(img1.width, img2.width);
    const height = Math.max(img1.height, img2.height);

    const norm1 = new PNG({ width, height });
    const norm2 = new PNG({ width, height });
    norm1.data.fill(255);
    norm2.data.fill(255);

    PNG.bitblt(img1, norm1, 0, 0, img1.width, img1.height, 0, 0);
    PNG.bitblt(img2, norm2, 0, 0, img2.width, img2.height, 0, 0);

    const diff = new PNG({ width, height });
    const diffPixels = pixelmatch(norm1.data, norm2.data, diff.data, width, height, { threshold: 0.15 });
    const totalPixels = width * height;
    return Math.max(0, Math.round(((totalPixels - diffPixels) / totalPixels) * 100));
  } catch (e) {
    return 0;
  }
}

async function testSite(browser, site) {
  console.log(`\n======================================================`);
  console.log(`🧪 [Senior QA Audit] Testing Site: ${site.name} (${site.url})`);
  console.log(`======================================================`);

  const report = {
    id: site.id,
    name: site.name,
    url: site.url,
    theme: site.theme,
    timestamp: new Date().toISOString(),
    status: 'PASS',
    sectionsDiscovered: 0,
    sectionsAudited: 0,
    functionalTests: {
      navigationExtracted: false,
      dropdownsDetected: 0,
      interactiveButtonsExtracted: 0,
      mediaPreserved: 0,
      mobileResponsivenessChecked: false,
      fidelityScore: 0,
      visualMatchScore: 0
    },
    defectsFound: [],
    developerNotes: []
  };

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  let liveHtml = '';
  let liveStyles = '';
  let liveBuf = null;

  try {
    const res = await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2500);

    if (res && res.status() >= 400) {
      report.defectsFound.push(`HTTP ${res.status()} response: Bot protection or access restriction`);
      report.status = 'BLOCKED';
      return report;
    }

    liveHtml = await page.content();
    liveStyles = await page.evaluate(async () => {
      const list = [];
      document.querySelectorAll('style').forEach(s => { if (s.textContent) list.push(s.textContent); });
      for (const link of Array.from(document.querySelectorAll('link[rel="stylesheet"]'))) {
        try {
          const resp = await fetch(link.href);
          if (resp.ok) list.push(await resp.text());
        } catch {}
      }
      return list.join('\n');
    });

    liveBuf = await page.screenshot({ fullPage: false });
    const liveImgPath = path.join(ARTIFACTS_DIR, `qa_${site.id}_live.png`);
    fs.writeFileSync(liveImgPath, liveBuf);
  } catch (err) {
    report.defectsFound.push(`Navigation failed: ${err.message}`);
    report.status = 'FAILED';
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    return report;
  }

  // 1. Visual Segmentation Audit
  const segWorker = new VisualSegmentationWorker();
  const segRes = await segWorker.execute(liveHtml);
  report.sectionsDiscovered = segRes.sections.length;

  if (report.sectionsDiscovered === 0) {
    report.defectsFound.push(`Zero sections discovered by VisualSegmentationWorker`);
    report.status = 'FAILED';
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    return report;
  }

  // 2. Select target primary section (Navbar or Hero)
  const navSec = segRes.sections.find(s => s.archetype === 'navbar') || segRes.sections[0];
  const heroSec = segRes.sections.find(s => s.archetype === 'hero') || segRes.sections[1] || segRes.sections[0];

  const engine = new GroundUpSynthesisEngine();
  const guard = new FidelityGuard();

  // Test Synthesis & Self-Healing Guard on Hero/Main section
  const targetSec = heroSec;
  const synth = engine.synthesizeSection(
    targetSec.html,
    site.url,
    liveStyles,
    targetSec.selector,
    targetSec.archetype,
    liveHtml
  );

  const guardRes = await guard.auditAndHeal({
    html: synth.html,
    css: synth.css,
    js: synth.js,
    rawWebsiteCss: liveStyles,
    rawSnapshotHtml: liveHtml,
    sourceUrl: site.url
  });

  const { SectionInspector } = require('../dist/synthesis/inspector.js');
  const inspector = new SectionInspector();
  const ast = inspector.inspect(
    targetSec.html,
    site.url,
    liveStyles,
    targetSec.selector,
    targetSec.archetype,
    liveHtml
  );

  report.functionalTests.fidelityScore = guardRes.fidelityScore;
  report.functionalTests.dropdownsDetected = (ast.navLinks || []).filter(l => l.hasDropdown).length;
  report.functionalTests.interactiveButtonsExtracted = (ast.actions || []).length;
  report.functionalTests.mediaPreserved = (ast.media || []).length + (ast.images || []).length;

  // Log any defects surfaced by FidelityGuard
  if (guardRes.initialDefects && guardRes.initialDefects.length > 0) {
    guardRes.initialDefects.forEach(d => {
      report.defectsFound.push(`[${d.type}] on ${d.selector}: ${d.details || ''}`);
    });
  }

  // 3. Render Replicated Output in Desktop and Mobile Viewports
  const bgCol = site.theme === 'dark' ? '#000000' : '#ffffff';
  const textCol = site.theme === 'dark' ? '#ffffff' : '#000000';

  const fullDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <base href="${site.url}">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: ${bgCol}; color: ${textCol}; }
    ${guardRes.healedCss}
  </style>
</head>
<body>
  ${guardRes.healedHtml}
  <script>
    ${guardRes.healedJs}
  </script>
</body>
</html>`.trim();

  // Desktop render test
  const replicaPage = await context.newPage();
  try {
    await replicaPage.setContent(fullDoc, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await replicaPage.waitForTimeout(1000);

    const replicaBuf = await replicaPage.screenshot({ fullPage: false, animations: 'disabled' });
    const replicaImgPath = path.join(ARTIFACTS_DIR, `qa_${site.id}_replica.png`);
    fs.writeFileSync(replicaImgPath, replicaBuf);

    report.functionalTests.visualMatchScore = calculateSimilarity(liveBuf, replicaBuf);

    // Mobile Viewport Test (375x812 iPhone X)
    await replicaPage.setViewportSize({ width: 375, height: 812 });
    await replicaPage.waitForTimeout(500);

    // Check for horizontal overflow defect
    const hasHorizontalOverflow = await replicaPage.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    if (hasHorizontalOverflow) {
      report.defectsFound.push(`[Mobile Defect] Page content causes horizontal scrollbar on 375px viewport`);
    } else {
      report.functionalTests.mobileResponsivenessChecked = true;
    }

    const mobileBuf = await replicaPage.screenshot({ fullPage: false, animations: 'disabled' });
    const mobileImgPath = path.join(ARTIFACTS_DIR, `qa_${site.id}_mobile.png`);
    fs.writeFileSync(mobileImgPath, mobileBuf);

  } catch (err) {
    report.defectsFound.push(`Replica render failure: ${err.message}`);
  } finally {
    await replicaPage.close().catch(() => {});
  }

  await page.close().catch(() => {});
  await context.close().catch(() => {});

  if (report.defectsFound.length > 2 || report.functionalTests.visualMatchScore < 50) {
    report.status = 'NEEDS_DEV_ATTENTION';
  }

  console.log(`QA Result: ${report.name} => Status: ${report.status}, Match: ${report.functionalTests.visualMatchScore}%, Defects: ${report.defectsFound.length}`);
  return report;
}

async function runSeniorQaAudit() {
  console.log('🚀 Starting Senior QA Benchmark on 16 Live Commercial Websites...');
  const browser = await chromium.launch({
    executablePath: CHROME_EXECUTABLE,
    headless: true,
    args: ['--no-sandbox']
  });

  const fullReport = [];

  for (const site of TEST_SITES) {
    try {
      const res = await testSite(browser, site);
      fullReport.push(res);
    } catch (e) {
      console.error(`Error auditing ${site.name}:`, e.message);
      fullReport.push({
        id: site.id,
        name: site.name,
        url: site.url,
        status: 'CRASHED',
        defectsFound: [e.message]
      });
    }
  }

  await browser.close();

  const outJson = path.join(ARTIFACTS_DIR, 'senior_qa_audit_results.json');
  fs.writeFileSync(outJson, JSON.stringify(fullReport, null, 2));
  console.log(`\n✅ Senior QA Audit Completed. Saved full audit results to: ${outJson}`);
}

runSeniorQaAudit().catch(console.error);
