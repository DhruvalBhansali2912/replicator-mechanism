const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { GroundUpSynthesisEngine } = require('../dist/synthesis/engine.js');
const { chromium } = require('playwright');
const archiver = require('archiver');

const ARTIFACTS_DIR = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84';

async function run() {
  const job = JSON.parse(fs.readFileSync('storage/jobs/job_2c8182636e644eb8/job.json', 'utf8'));
  const authenticCss = (job.options.clientStylesheets || []).join('\n');
  const cheerio = require('cheerio');
  const $ = cheerio.load(job.options.htmlSnapshot);
  const promoHtml = $('section.section-promo').prop('outerHTML');

  console.log('[Apple Promo Grid] Synthesizing Section 3 with GroundUpSynthesisEngine...');
  const engine = new GroundUpSynthesisEngine();
  const synth = engine.synthesizeSection(
    promoHtml,
    'https://www.apple.com',
    authenticCss,
    'section.section-promo',
    'promo-grid',
    job.options.htmlSnapshot,
    job.options.recordedInteractions,
    job.options.rootCssVariables
  );

  console.log('Synthesized Promo HTML length:', synth.html.length);
  console.log('Synthesized Promo CSS length:', synth.css.length);
  console.log('Synthesized Promo JS length:', synth.js.length);
  console.log('Score:', synth.scoring.totalScore, 'Passed:', synth.scoring.passed);

  // Generate authentic hex job ID
  const jobId = 'job_' + crypto.randomBytes(8).toString('hex');
  const jobDir = path.join('storage/jobs', jobId);
  const fullPageDir = path.join(jobDir, 'full-page');
  fs.mkdirSync(fullPageDir, { recursive: true });

  const finalHtml = `<!DOCTYPE html>
<html lang="en" class="js enhanced no-reduced-motion desktop retina">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="no-referrer">
  <title>Apple Product Showcase Promo Replica</title>
  <link rel="stylesheet" href="style.css">
</head>
<body class="ac-nav-overlap globalheader-dark" style="margin: 0; padding: 0; background-color: #ffffff; color: #1d1d1f; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif;">
${synth.html}
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
    sectionSelector: 'section.section-promo',
    archetype: 'features',
    status: 'completed',
    sectionCount: 1,
    fidelityScore: synth.scoring.totalScore,
    completedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString()
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
  const previewUrl = `http://localhost:3000/api/jobs/${jobId}/preview/`;
  console.log(`Preview URL: ${previewUrl}`);

  // Multi-viewport verification with Playwright
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-web-security'],
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    });

    // 1. Desktop Verification (1440px)
    console.log('[Playwright] Verifying Desktop layout (1440x1200)...');
    const desktopPage = await browser.newPage({
      viewport: { width: 1440, height: 1200 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    await desktopPage.route(/\.(woff2?|ttf|otf)(\?.*)?$/, route => route.abort());
    await desktopPage.route(/wss\/fonts/, route => route.abort());
    await desktopPage.route(/fonts\.apple\.com/, route => route.abort());

    await desktopPage.goto(previewUrl, { waitUntil: 'domcontentloaded' });
    await desktopPage.waitForTimeout(1500);

    const promoLoc = desktopPage.locator('section.section-promo, [class*="section-promo"]').first();
    const tilesLoc = desktopPage.locator('.tile-wrapper, [class*="tile-wrapper"]');
    const tileCount = await tilesLoc.count();
    console.log(`Found ${tileCount} promo tiles on desktop.`);

    // Check 2-column layout (Tile 0 and Tile 1 should be side-by-side horizontally)
    const box0 = await tilesLoc.nth(0).boundingBox();
    const box1 = await tilesLoc.nth(1).boundingBox();
    console.log(`Tile 0 bounding box:`, box0);
    console.log(`Tile 1 bounding box:`, box1);

    const isSideBySide = box0 && box1 && Math.abs(box0.y - box1.y) < 10 && box0.x < box1.x;
    console.log(`Desktop 2-column grid assertion (Tile 0 & 1 side-by-side): ${isSideBySide ? 'PASS' : 'FAIL'}`);

    // Test Hover on CTA button
    const cta0 = tilesLoc.nth(0).locator('.tile-ctas a, a.button').first();
    let hoveredStyles = {};
    if (await cta0.count() > 0) {
      await cta0.hover();
      await desktopPage.waitForTimeout(300);
      hoveredStyles = await cta0.evaluate(el => {
        const s = window.getComputedStyle(el);
        return { background: s.backgroundColor, color: s.color };
      });
      console.log('CTA 0 hover styles:', hoveredStyles);
    }

    // Verify Upgrade Card Animation & Footnote '2'
    const upgradeLoc = desktopPage.locator('.tile-wrapper[data-tile-id="apple-upgrade"]');
    await upgradeLoc.scrollIntoViewIfNeeded();
    await desktopPage.waitForTimeout(1000);

    const supMetrics = await upgradeLoc.locator('sup').evaluate(el => {
      const s = window.getComputedStyle(el);
      const parentS = window.getComputedStyle(el.parentElement);
      return {
        text: el.innerText.trim(),
        fontSize: s.fontSize,
        parentFontSize: parentS.fontSize,
        verticalAlign: s.verticalAlign,
        top: s.top,
        isSmall: parseFloat(s.fontSize) < parseFloat(parentS.fontSize),
        isElevated: s.verticalAlign === 'super' || parseFloat(s.top) < 0
      };
    });
    console.log('Upgrade Card Sup 2 Metrics:', JSON.stringify(supMetrics, null, 2));

    const videoMetrics = await upgradeLoc.locator('video').evaluate(v => {
      const s = window.getComputedStyle(v);
      const wrapper = v.closest('.inline-media-wrapper');
      return {
        src: v.currentSrc || v.src,
        paused: v.paused,
        currentTime: v.currentTime,
        loop: v.loop,
        muted: v.muted,
        top: s.top,
        bottom: s.bottom,
        height: s.height,
        transform: s.transform,
        display: s.display,
        visibility: s.visibility,
        opacity: s.opacity,
        wrapperClasses: wrapper ? wrapper.className : null,
        isPlaying: !v.paused || v.currentTime > 0,
        playsOnlyOnce: v.loop === false,
        isNotOffset: s.top === '0px' && s.bottom === '0px'
      };
    });
    console.log('Upgrade Card Video Animation Metrics:', JSON.stringify(videoMetrics, null, 2));

    const upgradeCardPath = path.join(ARTIFACTS_DIR, 'apple_upgrade_card_animation.png');
    await upgradeLoc.screenshot({ path: upgradeCardPath });

    const desktopSecPath = path.join(ARTIFACTS_DIR, 'apple_promo_desktop_full.png');
    const desktopTilesPath = path.join(ARTIFACTS_DIR, 'apple_promo_desktop_tiles.png');
    await desktopPage.screenshot({ path: desktopSecPath, fullPage: true });
    await promoLoc.screenshot({ path: desktopTilesPath });
    console.log(`Saved desktop screenshots to artifacts.`);

    await desktopPage.close();

    // 2. Mobile Verification (390px)
    console.log('[Playwright] Verifying Mobile layout (390x844)...');
    const mobilePage = await browser.newPage({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
    });

    await mobilePage.route(/\.(woff2?|ttf|otf)(\?.*)?$/, route => route.abort());
    await mobilePage.route(/wss\/fonts/, route => route.abort());
    await mobilePage.route(/fonts\.apple\.com/, route => route.abort());

    await mobilePage.goto(previewUrl, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(1500);

    const mobileTilesLoc = mobilePage.locator('.tile-wrapper, [class*="tile-wrapper"]');
    const mBox0 = await mobileTilesLoc.nth(0).boundingBox();
    const mBox1 = await mobileTilesLoc.nth(1).boundingBox();
    console.log(`Mobile Tile 0 bounding box:`, mBox0);
    console.log(`Mobile Tile 1 bounding box:`, mBox1);

    const isStacked = mBox0 && mBox1 && (mBox1.y > mBox0.y + mBox0.height - 20);
    console.log(`Mobile 1-column stacked assertion (Tile 1 below Tile 0): ${isStacked ? 'PASS' : 'FAIL'}`);

    const mobileSecPath = path.join(ARTIFACTS_DIR, 'apple_promo_mobile_full.png');
    await mobilePage.screenshot({ path: mobileSecPath, fullPage: true });
    console.log(`Saved mobile screenshot to artifacts.`);

    await mobilePage.close();

    return {
      jobId,
      previewUrl,
      tileCount,
      isSideBySide,
      isStacked,
      desktopSecPath,
      mobileSecPath
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

run().then(res => {
  console.log('\n=== SECTION 3 REPLICATION COMPLETE ===');
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
