const fs = require('fs');
const cheerio = require('cheerio');
const { resolveTargetSectionFromSnapshot } = require('../dist/classifier/section-resolver.js');
const job = JSON.parse(fs.readFileSync('storage/jobs/job_392c8592171a4a9b/job.json', 'utf8'));
const snap = cheerio.load(job.options.htmlSnapshot);
const resolved = resolveTargetSectionFromSnapshot(snap, 'hero', undefined);
const snapHeader = snap('header.page-header, header, [role="banner"]').first();
let finalSectionHtml = '';
if (snapHeader.length > 0) {
  finalSectionHtml += snap.html(snapHeader) + '\n';
}
if (resolved && resolved.length > 0) {
  finalSectionHtml += snap.html(resolved);
}
const { GroundUpSynthesisEngine } = require('../dist/synthesis/engine.js');
const { chromium } = require('playwright');
const rawCss = fs.readFileSync('storage/jobs/job_392c8592171a4a9b/reconstruction.css', 'utf8');

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
    height: 75px !important;
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

(async () => {
  const engine = new GroundUpSynthesisEngine();
  const res = engine.synthesizeSection(
    finalSectionHtml,
    'https://www.olaelectric.com/',
    rawCss + '\n' + extraCss,
    'hero',
    undefined,
    undefined, // don't pass snapshot here so it doesn't overwrite finalSectionHtml
    job.options.recordedInteractions
  );

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

  const previewPath = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84/ola_hero_verified_fixed.html';
  fs.writeFileSync(previewPath, finalHtml, 'utf8');

  const $chk = cheerio.load(finalHtml);
  console.log('--- CHECK PREVIEW HTML ---');
  console.log('Top level elements in body:');
  $chk('body > *').each((i, el) => {
    console.log(i, el.tagName, $chk(el).attr('class'), 'children:', $chk(el).children().length);
  });
  console.log('Has pkxcesb:', $chk('.pkxcesb').length);
  console.log('Has owl-carousel:', $chk('.owl-carousel').length);
  console.log('Has images:', $chk('img').length);
  console.log('res.html snippet:', res.html.substring(0, 300));


  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('file://' + previewPath, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const screenshotPath = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84/ola_hero_verified_fixed.png';
  await page.screenshot({ path: screenshotPath });
  console.log('Verified screenshot saved to', screenshotPath);
  await browser.close();
})();


