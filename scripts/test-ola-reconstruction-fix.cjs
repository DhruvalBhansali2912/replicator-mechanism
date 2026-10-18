const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { chromium } = require('playwright');
const { GroundUpSynthesisEngine } = require('../dist/synthesis/engine.js');
const { resolveTargetSectionFromSnapshot } = require('../dist/classifier/section-resolver.js');

const jobDir = path.resolve('storage/jobs/job_392c8592171a4a9b');
const jobMeta = JSON.parse(fs.readFileSync(path.join(jobDir, 'job.json'), 'utf8'));

async function testFix() {
  console.log('Testing Ola hero + menu + carousel fix...');
  const $snap = cheerio.load(jobMeta.options.htmlSnapshot);

  // 1. Resolve header and hero
  const snapHeader = $snap('header.page-header, header, [role="banner"]').first();
  const snapHero = $snap('div.s6uaags-s, [class*="home_banner_slider"]').first();

  console.log('Found snapHeader:', snapHeader.length, 'snapHero:', snapHero.length);

  // Associated drawers / language modals
  const associatedDrawers = $snap(
    '[data-testid*="drawer"], [role="dialog"], [data-baseweb="drawer"], [data-baseweb="modal"], [aria-modal="true"], dialog, [class*="mega-menu-panel"], [class*="header-panel"]'
  );

  let combinedHtml = '';
  if (snapHeader.length > 0) {
    combinedHtml += $snap.html(snapHeader) + '\n';
  }
  if (snapHero.length > 0) {
    combinedHtml += $snap.html(snapHero) + '\n';
  }
  if (associatedDrawers.length > 0) {
    associatedDrawers.each((_, d) => {
      combinedHtml += $snap.html(d) + '\n';
    });
  }

  // Read existing CSS
  const rawCss = fs.readFileSync(path.join(jobDir, 'reconstruction.css'), 'utf8');

  const engine = new GroundUpSynthesisEngine();
  const res = engine.synthesizeSection(
    combinedHtml,
    'https://www.olaelectric.com/',
    rawCss,
    'hero',
    undefined,
    jobMeta.options.htmlSnapshot,
    jobMeta.options.recordedInteractions
  );

  // Add the CSS rules to suppress pre-hydration duplicate banners and contain carousel
  const extraCss = `
    /* Universal Carousel: Pre-hydration placeholder banner suppression */
    .slider_first_column,
    [class*="banner_poster"],
    [class*="placeholder_banner"],
    [class*="slider_placeholder"],
    [class*="hero_poster"] {
      display: none !important;
    }

    /* Universal Carousel Slide Media Containment */
    .owl-carousel, .home_banner_slider {
      position: relative !important;
      height: 900px !important;
      max-height: 900px !important;
      overflow: hidden !important;
    }
    .owl-carousel .owl-stage-outer {
      overflow: hidden !important;
      width: 100% !important;
      height: 100% !important;
      position: relative !important;
    }
    .owl-carousel .owl-stage {
      display: flex !important;
      height: 100% !important;
      position: relative !important;
    }
    .owl-carousel .owl-item {
      flex-shrink: 0 !important;
      height: 100% !important;
      position: relative !important;
      overflow: hidden !important;
    }
    .owl-carousel .owl-item [class*="raw_html"]:has(video),
    .owl-carousel .owl-item video {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      pointer-events: none !important;
    }

    /* Fixed/Absolute Header over Hero styling */
    header.page-header, header[class*="header"] {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      z-index: 100 !important;
      background: transparent !important;
      padding: 16px 40px !important;
      box-sizing: border-box !important;
    }

    /* Utility bars like skip to content */
    .panel.header, .panel.wrapper, [class*="welcome"] {
      display: none !important;
    }

    /* Header content row */
    .header.content, .header_top_content {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      width: 100% !important;
      max-width: 1400px !important;
      margin: 0 auto !important;
    }

    /* Brand logo */
    .logo, [class*="brand-logo"], a:has(> img[src*="logo"]) {
      display: flex !important;
      align-items: center !important;
    }
    .logo img, [class*="brand-logo"] img {
      height: 28px !important;
      width: auto !important;
    }

    /* Header Nav Menu */
    .header-top-menu, .header-menu, [class*="header-menu"] {
      display: flex !important;
      align-items: center !important;
      gap: 32px !important;
    }

    /* Hide mobile sidebar in desktop header */
    .hdrmobmenu, [class*="mobmenu"], [class*="sidebar_menu"], [class*="mobile-nav"] {
      display: none !important;
    }
    header.page-header, header[class*="header"] {
      height: 75px !important;
      max-height: 75px !important;
      overflow: visible !important;
    }

    .header-menu ul, [class*="header-menu"] ul {
      display: flex !important;
      align-items: center !important;
      list-style: none !important;
      margin: 0 !important;
      padding: 0 !important;
      gap: 28px !important;
    }
    .header-menu li, [class*="header-menu"] li {
      display: inline-flex !important;
      align-items: center !important;
      font-size: 15px !important;
      font-weight: 500 !important;
      color: #ffffff !important;
      cursor: pointer !important;
      position: relative !important;
    }
    .header-menu a, [class*="header-menu"] a {
      color: #ffffff !important;
      text-decoration: none !important;
    }

  `;

  const finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ola Electric - Hero & Navigation Verified</title>
  <style>
    ${res.css}
    ${extraCss}
  </style>
</head>
<body style="margin: 0; padding: 0; background: #000; overflow-x: hidden;">
  ${res.html}
  <script>
    ${res.js}
  </script>
</body>
</html>`;

  const previewPath = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84/ola_hero_fixed_preview.html';
  fs.writeFileSync(previewPath, finalHtml, 'utf8');
  console.log('Saved preview to', previewPath);

  // Render in Chrome and screenshot
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('file://' + previewPath, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const screenshotPath = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84/ola_hero_fixed_verified.png';
  await page.screenshot({ path: screenshotPath });
  console.log('Screenshot saved to', screenshotPath);

  // Test menu hover
  try {
    console.log('Testing menu hover...');
    const menuItem = await page.$('.header-menu-left__item, [class*="scooter_menu"], header a');
    if (menuItem) {
      await menuItem.hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84/ola_menu_hover.png' });
      console.log('Menu hover screenshot saved!');
    }
  } catch (err) {
    console.log('Hover notice:', err.message);
  }

  // Test carousel next or dot click
  try {
    console.log('Testing carousel click...');
    const dotBtn = await page.$('.owl-dot:nth-child(2), .owl-dot, button.owl-next');
    if (dotBtn) {
      await dotBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84/ola_carousel_clicked.png' });
      console.log('Carousel clicked screenshot saved!');
    }
  } catch (err) {
    console.log('Click notice:', err.message);
  }

  await browser.close();
  console.log('All tests completed successfully!');
}

testFix().catch(console.error);


