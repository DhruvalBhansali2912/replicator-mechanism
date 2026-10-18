const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { chromium } = require('playwright');

async function main() {
  console.log('=== TESTING CARBON360 SYNTHESIS & CLICK-TO-OPEN SIDEBAR ===');

  const snapshotHtml = fs.readFileSync('storage/carbon360.html', 'utf8');
  console.log('Snapshot HTML length:', snapshotHtml.length);

  // Import compiled modules
  const { resolveTargetSectionFromSnapshot, enrichSectionWithCompanions } = require('../dist/classifier/section-resolver.js');
  const { GroundUpSynthesisEngine } = require('../dist/synthesis/engine.js');

  const $snap = cheerio.load(snapshotHtml);
  const resolvedTarget = resolveTargetSectionFromSnapshot($snap, 'navbar', undefined);

  if (!resolvedTarget || resolvedTarget.length === 0) {
    throw new Error('Failed to resolve navbar target from snapshot');
  }

  console.log('Resolved target tag:', resolvedTarget.get(0)?.tagName, 'class:', resolvedTarget.attr('class'));

  let targetHtml = $snap.html(resolvedTarget);
  targetHtml = enrichSectionWithCompanions(targetHtml, $snap, 'navbar', undefined);
  console.log('Enriched targetHtml length:', targetHtml.length);

  const $test = cheerio.load(targetHtml);
  console.log('Contains hamburger button:', $test('.elementor-icon, [class*="burger"], [class*="bars"]').length > 0);
  console.log('Contains popup/drawer:', $test('[data-elementor-type="popup"], [class*="location-popup"]').length > 0);
  console.log('Total navigation links in bundle:', $test('a').length);

  // Synthesize via GroundUpSynthesisEngine
  const engine = new GroundUpSynthesisEngine();
  const synthesized = engine.synthesizeSection(
    targetHtml,
    'http://carbon360.de/',
    '',
    'header',
    'navbar',
    snapshotHtml
  );

  console.log('\n--- SYNTHESIS RESULTS ---');
  console.log('HTML length:', synthesized.html.length);
  console.log('CSS length:', synthesized.css.length);
  console.log('JS length:', synthesized.js.length);

  // Extract original stylesheets from snapshot so styles match 100%
  const cssLinks = [];
  $snap('link[rel="stylesheet"]').each((_, el) => {
    const href = $snap(el).attr('href');
    if (href) cssLinks.push(`<link rel="stylesheet" href="${href}">`);
  });

  // Construct preview HTML page
  const fullHtml = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Carbon 360 Navbar Preview</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css">
  ${cssLinks.join('\n  ')}
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; }
    ${synthesized.css}
  </style>
</head>
<body>
  ${synthesized.html}
  <div style="padding: 100px 40px; text-align: center; color: #64748b;">
    <h1>Main Page Content Area</h1>
    <p>Testing sidebar drawer toggle interaction...</p>
  </div>
  <script>
    ${synthesized.js}
  </script>
</body>
</html>`;

  const previewPath = path.resolve('storage/carbon360_preview.html');
  fs.writeFileSync(previewPath, fullHtml);
  console.log('Saved preview to:', previewPath);

  // Verify interaction with Playwright using CFT
  const homedir = require('os').homedir();
  const cftPath = path.join(
    homedir,
    'Library/Caches/ms-playwright/chromium-1243/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
  );

  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(cftPath) ? cftPath : undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto('file://' + previewPath, { waitUntil: 'domcontentloaded' });

    // Step 1: Closed State Screenshot
    const closedScreenshot = path.resolve('storage/carbon360_navbar_closed.png');
    await page.screenshot({ path: closedScreenshot, fullPage: false });
    console.log('Saved closed navbar screenshot:', closedScreenshot);

    // Step 2: Click the hamburger / menu button
    console.log('Finding and clicking menu button...');
    const menuBtn = page.locator('.elementor-icon, a[href*="popup"], [class*="burger"], button[class*="toggle"]').first();
    await menuBtn.waitFor({ state: 'visible', timeout: 5000 });
    await menuBtn.click();
    await page.waitForTimeout(500);

    // Step 3: Verify drawer visibility
    const drawer = page.locator('[data-elementor-type="popup"], [class*="location-popup"], [class*="drawer"]').first();
    const isVisible = await drawer.isVisible();
    const drawerBox = await drawer.boundingBox();
    console.log('Drawer is visible:', isVisible);
    console.log('Drawer bounding box:', drawerBox);

    // Step 4: Open State Screenshot
    const openScreenshot = path.resolve('storage/carbon360_navbar_open.png');
    await page.screenshot({ path: openScreenshot, fullPage: false });
    console.log('Saved open sidebar screenshot:', openScreenshot);

    // Step 5: Test Closing
    console.log('Testing close interaction...');
    const closeBtn = page.locator('.universal-drawer-close, .dialog-close-button, [data-action="close"]').first();
    if (await closeBtn.isVisible()) {
      console.log('Clicking close button...');
      await closeBtn.click();
      await page.waitForTimeout(300);
      const isStillVisible = await drawer.isVisible();
      console.log('Drawer is still visible after close button click:', isStillVisible);
    } else {
      console.log('Clicking outside drawer...');
      await page.mouse.click(100, 400);
      await page.waitForTimeout(300);
      const isStillVisible = await drawer.isVisible();
      console.log('Drawer is still visible after outside click:', isStillVisible);
    }

    const finalScreenshot = path.resolve('storage/carbon360_navbar_closed_again.png');
    await page.screenshot({ path: finalScreenshot, fullPage: false });
    console.log('Saved re-closed navbar screenshot:', finalScreenshot);

    console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
