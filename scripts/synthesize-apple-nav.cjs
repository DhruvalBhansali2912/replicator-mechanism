const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { GroundUpSynthesisEngine } = require('../dist/synthesis/engine.js');
const { chromium } = require('playwright');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');
const { PNG } = require('pngjs');
const archiver = require('archiver');

const ARTIFACTS_DIR = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84';

function compareImages(img1Buf, img2Buf, diffPath) {
  const png1 = PNG.sync.read(img1Buf);
  const png2 = PNG.sync.read(img2Buf);
  const width = Math.min(png1.width, png2.width);
  const height = Math.min(png1.height, png2.height);

  const norm1 = new PNG({ width, height });
  const norm2 = new PNG({ width, height });

  PNG.bitblt(png1, norm1, 0, 0, width, height, 0, 0);
  PNG.bitblt(png2, norm2, 0, 0, width, height, 0, 0);

  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(norm1.data, norm2.data, diff.data, width, height, {
    threshold: 0.15,
    includeAA: false,
  });

  const totalPixels = width * height;
  const matchPercentage = Math.max(0, ((totalPixels - diffPixels) / totalPixels) * 100);
  if (diffPath) fs.writeFileSync(diffPath, PNG.sync.write(diff));

  return {
    width,
    height,
    diffPixels,
    totalPixels,
    matchPercentage: parseFloat(matchPercentage.toFixed(2))
  };
}

async function run() {
  const dump = JSON.parse(fs.readFileSync('storage/apple_nav_dump.json', 'utf8'));
  const authenticCss = dump.sheets.join('\n');

  const engine = new GroundUpSynthesisEngine();
  const synth = engine.synthesizeSection(
    dump.html,
    'https://www.apple.com',
    authenticCss,
    'navigation',
    'nav',
    dump.fullHtml,
    undefined,
    dump.rootVars
  );

  console.log('Synthesized Navigation HTML length:', synth.html.length);
  console.log('Synthesized Navigation CSS length:', synth.css.length);
  console.log('Synthesized Navigation JS length:', synth.js.length);

  // Generate authentic hex job ID
  const jobId = 'job_' + crypto.randomBytes(8).toString('hex');
  const jobDir = path.join('storage/jobs', jobId);
  const fullPageDir = path.join(jobDir, 'full-page');
  fs.mkdirSync(fullPageDir, { recursive: true });

  const finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Apple Global Navigation Replica</title>
  <link rel="stylesheet" href="style.css">
</head>
<body class="ac-nav-overlap globalheader-light globalnav-scrim" style="margin: 0; padding: 0; background-color: #ffffff; color: #1d1d1f; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif; min-height: 100vh;">
${synth.html}
  <main style="padding: 100px 40px; text-align: center; color: #6e6e73;">
    <h1 style="color: #1d1d1f; font-size: 48px; font-weight: 600; margin-bottom: 16px;">Apple Design Verification</h1>
    <p style="font-size: 21px; max-width: 600px; margin: 0 auto;">High-fidelity navigation reproduction with interactive flyout menus, search & shopping bag integration.</p>
  </main>
  <script src="script.js" defer></script>
</body>
</html>`;

  fs.writeFileSync(path.join(fullPageDir, 'index.html'), finalHtml);
  fs.writeFileSync(path.join(fullPageDir, 'style.css'), synth.css);
  fs.writeFileSync(path.join(fullPageDir, 'script.js'), synth.js);

  fs.writeFileSync(path.join(jobDir, 'reconstruction.html'), finalHtml);
  fs.writeFileSync(path.join(jobDir, 'reconstruction.css'), synth.css);
  fs.writeFileSync(path.join(jobDir, 'reconstruction.js'), synth.js);

  // Write job.json
  const jobMeta = {
    id: jobId,
    url: 'https://www.apple.com',
    sectionSelector: 'nav#globalnav',
    archetype: 'navigation',
    status: 'completed',
    createdAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(jobDir, 'job.json'), JSON.stringify(jobMeta, null, 2));

  // Package zip
  const zipPath = path.join(jobDir, 'site-package.zip');
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(output);
  archive.file(path.join(fullPageDir, 'index.html'), { name: 'index.html' });
  archive.file(path.join(fullPageDir, 'style.css'), { name: 'style.css' });
  archive.file(path.join(fullPageDir, 'script.js'), { name: 'script.js' });
  await archive.finalize();

  console.log(`Created job ${jobId} at ${jobDir}`);
  console.log(`Preview URL: http://localhost:3000/api/jobs/${jobId}/preview/`);

  // Launch Playwright
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-web-security'],
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 950 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  await page.route(/\.(woff2?|ttf|otf)(\?.*)?$/, route => route.abort());
  await page.route(/wss\/fonts/, route => route.abort());
  await page.route(/fonts\.apple\.com/, route => route.abort());
  await page.route(/.*\.apple\.com\/wss\/.*/, route => route.abort());

  // 1. Capture authentic live Apple nav resting state
  const origRestingPath = path.join(ARTIFACTS_DIR, 'apple_nav_original_resting.png');
  const origFlyoutPath = path.join(ARTIFACTS_DIR, 'apple_nav_original_flyout.png');

  if (!fs.existsSync(origRestingPath) || fs.statSync(origRestingPath).size < 1000) {
    console.log('Capturing live Apple navigation section...');
    try {
      const livePage = await browser.newPage({
        viewport: { width: 1440, height: 950 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      await livePage.goto('https://www.apple.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await livePage.waitForTimeout(2000);

      const liveNav = livePage.locator('nav#globalnav, nav.globalnav').first();
      await liveNav.screenshot({ path: origRestingPath });

      // Hover on "Store" or "Mac" to capture live flyout
      const storeItem = livePage.locator('nav .globalnav-item a, nav li a').filter({ hasText: 'Store' }).first();
      if (await storeItem.count() > 0) {
        await storeItem.hover();
        await livePage.waitForTimeout(600);
        await livePage.screenshot({ path: origFlyoutPath, clip: { x: 0, y: 0, width: 1440, height: 500 } });
      }
      await livePage.close();
    } catch (e) {
      console.warn('Live page capture warning:', e.message);
    }
  }

  // 2. Load Replica Preview
  await page.goto(`http://localhost:3000/api/jobs/${jobId}/preview/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Measure metrics
  const metrics = await page.evaluate(() => {
    const nav = document.querySelector('nav#globalnav, nav.globalnav');
    const links = Array.from(document.querySelectorAll('nav a'));
    const flyouts = Array.from(document.querySelectorAll('[class*="flyout"], [class*="submenu"], [class*="menu-content"]'));
    return {
      navFound: !!nav,
      navBox: nav ? nav.getBoundingClientRect() : null,
      linksCount: links.length,
      linksText: links.map(a => a.textContent.trim()).filter(Boolean).slice(0, 12),
      flyoutCount: flyouts.length
    };
  });
  console.log('Replica Navigation Metrics:', metrics);

  // Capture replica resting screenshots
  const repNav = page.locator('nav').first();
  const repNavPath = path.join(ARTIFACTS_DIR, 'apple_nav_replica_element.png');
  await repNav.screenshot({ path: repNavPath });

  const repRestingPath = path.join(ARTIFACTS_DIR, 'apple_nav_replica_resting.png');
  await page.screenshot({ path: repRestingPath, clip: { x: 0, y: 0, width: 1440, height: 500 } });

  // 3. Test interactive hover on nav links: Store
  console.log('Testing interactive hover on "Store"...');
  const storeLink = page.locator('.globalnav-item-store').first();
  let storeFlyoutOpen = false;
  try {
    if (await storeLink.count() > 0 && await storeLink.isVisible()) {
      await storeLink.hover({ timeout: 2000, force: true });
      await page.waitForTimeout(600);
      storeFlyoutOpen = await page.evaluate(() => {
        const dd = document.querySelector('#globalnav-submenu-link-store');
        return dd ? (dd.classList.contains('is-open') || window.getComputedStyle(dd).visibility === 'visible') : false;
      });
    }
  } catch (e) {
    console.warn('Store hover skipped:', e.message);
  }
  const repFlyoutPath = path.join(ARTIFACTS_DIR, 'apple_nav_replica_flyout.png');
  await page.screenshot({ path: repFlyoutPath, clip: { x: 0, y: 0, width: 1440, height: 500 } });
  console.log('Store flyout open:', storeFlyoutOpen);

  // Check SVG text orientation (Issue 4 verification)
  const svgTextTransform = await page.evaluate(() => {
    const svgs = Array.from(document.querySelectorAll('nav .globalnav-link-image svg, nav .globalnav-link svg'));
    return svgs.map(s => {
      const t = window.getComputedStyle(s).transform;
      return t;
    });
  });
  const hasInvertedText = svgTextTransform.some(t => t.includes('matrix(-1') || t.includes('rotate(180deg)'));
  console.log('SVG text inverted (should be FALSE):', hasInvertedText);

  // Test interactive hover on Mac (Issue 2 verification)
  console.log('Testing interactive hover on "Mac"...');
  const macLink = page.locator('.globalnav-item-mac').first();
  let macFlyoutOpen = false;
  let storeClosedOnMacHover = false;
  try {
    if (await macLink.count() > 0 && await macLink.isVisible()) {
      await macLink.hover({ timeout: 2000, force: true });
      await page.waitForTimeout(600);
      const res = await page.evaluate(() => {
        const macDd = document.querySelector('#globalnav-submenu-link-mac');
        const storeDd = document.querySelector('#globalnav-submenu-link-store');
        const macVis = macDd ? (macDd.classList.contains('is-open') || window.getComputedStyle(macDd).visibility === 'visible') : false;
        const storeVis = storeDd ? (storeDd.classList.contains('is-open') || window.getComputedStyle(storeDd).visibility === 'visible') : false;
        return { macVis, storeVis };
      });
      macFlyoutOpen = res.macVis;
      storeClosedOnMacHover = !res.storeVis;
    }
  } catch (e) {
    console.warn('Mac hover skipped:', e.message);
  }
  const repMacFlyoutPath = path.join(ARTIFACTS_DIR, 'apple_nav_replica_mac_hover.png');
  await page.screenshot({ path: repMacFlyoutPath, clip: { x: 0, y: 0, width: 1440, height: 500 } });
  console.log('Mac flyout open:', macFlyoutOpen, 'Store closed on Mac hover:', storeClosedOnMacHover);

  // 4. Calculate pixel match score
  if (fs.existsSync(origRestingPath) && fs.existsSync(repNavPath)) {
    const comp = compareImages(
      fs.readFileSync(origRestingPath),
      fs.readFileSync(repNavPath),
      path.join(ARTIFACTS_DIR, 'apple_nav_element_diff.png')
    );
    console.log(`Apple navigation pixel match score: ${comp.matchPercentage}% (${comp.diffPixels} diff pixels out of ${comp.totalPixels})`);
  }

  // 5. Test Mobile Menu (Issue 3 verification)
  console.log('Testing mobile menu drawer on 390x844 viewport...');
  const mobilePage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
  });
  await mobilePage.route(/\.(woff2?|ttf|otf)(\?.*)?$/, route => route.abort());
  await mobilePage.route(/wss\/fonts/, route => route.abort());
  await mobilePage.goto(`http://localhost:3000/api/jobs/${jobId}/preview/`, { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(1000);

  const mobRestingPath = path.join(ARTIFACTS_DIR, 'apple_nav_replica_mobile_resting.png');
  await mobilePage.screenshot({ path: mobRestingPath });

  const mobBtn = mobilePage.locator('#globalnav-menutrigger-button, button.globalnav-menutrigger-button, [id*="menutrigger"], [class*="menutrigger"] button').first();
  let mobOpenSuccess = false;
  let mobItemsRendered = 0;
  if (await mobBtn.count() > 0) {
    await mobBtn.click();
    await mobilePage.waitForTimeout(600);

    const mobRes = await mobilePage.evaluate(() => {
      const nav = document.querySelector('#globalnav, nav');
      const items = Array.from(document.querySelectorAll('#globalnav .globalnav-item, nav .globalnav-item, nav li, nav a')).map(el => {
        const r = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        return {
          text: el.textContent.trim().replace(/\s+/g, ' '),
          vis: cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0',
          height: r.height
        };
      }).filter(x => x.text && x.vis && x.height > 10);
      return {
        classes: nav ? nav.className : '',
        renderedItemsCount: items.length,
        sample: items.slice(0, 12)
      };
    });
    console.log('Mobile menu open classes:', mobRes.classes);
    console.log('Mobile rendered items count:', mobRes.renderedItemsCount);
    console.log('Mobile items sample:', mobRes.sample);
    mobItemsRendered = mobRes.renderedItemsCount;
    mobOpenSuccess = mobItemsRendered >= 8;
  }

  const mobOpenPath = path.join(ARTIFACTS_DIR, 'apple_nav_replica_mobile_open.png');
  await mobilePage.screenshot({ path: mobOpenPath });
  await mobilePage.close();

  await browser.close();
  console.log(`FINAL_APPLE_NAV_JOB_ID=${jobId}`);
  console.log(`SUMMARY: StoreOpen=${storeFlyoutOpen}, MacOpen=${macFlyoutOpen}, InvertedText=${hasInvertedText}, MobItems=${mobItemsRendered}`);
}

run().catch(console.error);

