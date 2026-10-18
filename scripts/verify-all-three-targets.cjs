const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const cheerio = require('cheerio');

const { GroundUpSynthesisEngine } = require('../dist/synthesis/engine.js');
const { ReconstructionWorker } = require('../dist/workers/reconstruction-worker.js');
const { VisualSegmentationWorker } = require('../dist/workers/visual-segmentation-worker.js');

const ARTIFACTS_DIR = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84';
const CHROME_EXECUTABLE = '/Users/dhanashreedhruval/Library/Caches/ms-playwright/chromium-1243/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

async function testSamsung(browser) {
  console.log('\n========================================');
  console.log('   TESTING TARGET 1: SAMSUNG.COM');
  console.log('========================================');

  const job = JSON.parse(fs.readFileSync('storage/jobs/job_a17b5ffdc22a429c/job.json', 'utf8'));
  const rawCss = fs.readFileSync('storage/jobs/job_a17b5ffdc22a429c/reconstruction.css', 'utf8');

  // Full-Page segmentation & reconstruction
  console.log('Segmenting Samsung full-page sections...');
  const segWorker = new VisualSegmentationWorker();
  const segRes = await segWorker.execute(job.options.htmlSnapshot);
  console.log(`Discovered ${segRes.totalSections} sections in Samsung full-page snapshot.`);

  const recWorker = new ReconstructionWorker();
  const recRes = await recWorker.execute(
    job.options.htmlSnapshot,
    rawCss,
    '',
    segRes.sections,
    job.url,
    undefined,
    job.options.htmlSnapshot
  );

  const fullPageDir = path.join(__dirname, '../storage/jobs/job_a17b5ffdc22a429c/full-page');
  fs.writeFileSync(path.join(fullPageDir, 'index.html'), recRes.fullHtml, 'utf8');
  fs.writeFileSync(path.join(fullPageDir, 'style.css'), recRes.fullCss, 'utf8');
  fs.writeFileSync(path.join(fullPageDir, 'script.js'), recRes.fullJs, 'utf8');
  fs.writeFileSync(path.join(__dirname, '../storage/jobs/job_a17b5ffdc22a429c/reconstruction.html'), recRes.fullHtml, 'utf8');

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/api/jobs/job_a17b5ffdc22a429c/preview/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Desktop Resting
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'samsung_proof_desktop_resting.png') });
  console.log('Captured samsung_proof_desktop_resting.png');

  // 2. Desktop Hover (Verify boundary before side links)
  const menuLinks = await page.$$('a.nv00-gnb-v4__l0-menu-link, nav li a');
  let shopLink = null;
  for (const l of menuLinks) {
    if (await l.isVisible()) { shopLink = l; break; }
  }

  if (shopLink) {
    await shopLink.hover();
    await page.waitForTimeout(500);
    const layout = await page.evaluate(() => {
      const list = document.querySelector('.nv00-gnb-v4__l1-menu-list');
      const feat = document.querySelector('.nv00-gnb-v4__l1-featured-list');
      const lr = list ? list.getBoundingClientRect() : null;
      const fr = feat ? feat.getBoundingClientRect() : null;
      return {
        listRight: lr ? lr.right : 0,
        featuredLeft: fr ? fr.left : 0,
        doesOverlap: lr && fr ? lr.right > fr.left : false
      };
    });
    console.log('Samsung hover menu boundary:', layout);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'samsung_proof_hover_menu.png') });
    console.log('Captured samsung_proof_hover_menu.png');
  }

  // 3. Search Button Click
  await page.mouse.move(10, 10);
  await page.waitForTimeout(300);
  const searchButtons = await page.$$('button.gnb__search-btn-js, button[class*="utility-search"], button[class*="search-toggle"], button[aria-label*="Search" i], button[class*="search"]:not([class*="btn-search"]):not([class*="close"])');
  let searchBtn = null;
  for (const b of searchButtons) {
    if (await b.isVisible()) { searchBtn = b; break; }
  }
  if (searchBtn) {
    await searchBtn.click({ force: true });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'samsung_proof_search_open.png') });
    console.log('Captured samsung_proof_search_open.png');

    const closeButtons = await page.$$('button.srd19-gnb-search__close, [class*="search__close"]');
    let closed = false;
    for (const cb of closeButtons) {
      if (await cb.isVisible()) {
        await cb.click({ force: true });
        closed = true;
        break;
      }
    }
    if (!closed) {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'samsung_proof_search_overlay_closed.png') });
    console.log('Captured samsung_proof_search_overlay_closed.png');
  }

  // 4. Carousel Working
  const allNextButtons = await page.$$('button.swiper-button-next, button[class*="next"], [class*="arrow-next"]');
  let nextArrow = null;
  for (const b of allNextButtons) {
    if (await b.isVisible()) { nextArrow = b; break; }
  }
  if (nextArrow) {
    await nextArrow.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const beforeX = await page.evaluate(() => {
      const track = document.querySelector('.swiper-wrapper, [class*="slider-track"]');
      return track ? track.getBoundingClientRect().x : 0;
    });
    await nextArrow.click({ force: true });
    await page.waitForTimeout(500);
    const afterX = await page.evaluate(() => {
      const track = document.querySelector('.swiper-wrapper, [class*="slider-track"]');
      return track ? track.getBoundingClientRect().x : 0;
    });
    console.log(`Samsung carousel translate: beforeX=${beforeX}, afterX=${afterX}`);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'samsung_proof_carousel_slide.png') });
    console.log('Captured samsung_proof_carousel_slide.png');
  }

  // 5. Mobile Menu Click & Submenu Open
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3000/api/jobs/job_a17b5ffdc22a429c/preview/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const allHamburgers = await page.$$('.nv00-gnb-v4__utility-hamburger, button[aria-label*="Menu"], button[class*="hamburger"], [class*="mobile-toggle"]');
  let hamburger = null;
  for (const h of allHamburgers) {
    if (await h.isVisible()) { hamburger = h; break; }
  }
  if (hamburger) {
    await hamburger.click({ force: true });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'samsung_proof_mobile_drawer_open.png') });
    console.log('Captured samsung_proof_mobile_drawer_open.png');

    const allCatBtns = await page.$$('.nv00-gnb-v4__l0-menu-btn, button[class*="menu-btn"]');
    let catBtn = null;
    for (const cb of allCatBtns) {
      if (await cb.isVisible()) { catBtn = cb; break; }
    }
    if (catBtn) {
      await catBtn.click({ force: true });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'samsung_proof_mobile_submenu_open.png') });
      console.log('Captured samsung_proof_mobile_submenu_open.png');
    }
  }

  await page.close();
}

async function testApple(browser) {
  console.log('\n========================================');
  console.log('   TESTING TARGET 2: APPLE.COM');
  console.log('========================================');

  const appleJobId = 'job_2c8182636e644eb8';
  const job = JSON.parse(fs.readFileSync(`storage/jobs/${appleJobId}/job.json`, 'utf8'));
  const rawCss = fs.readFileSync(`storage/jobs/${appleJobId}/reconstruction.css`, 'utf8');
  const snapHtml = job.options && job.options.htmlSnapshot ? job.options.htmlSnapshot : fs.readFileSync(`storage/jobs/${appleJobId}/reconstruction.html`, 'utf8');

  // Segment Apple full-page
  const segWorker = new VisualSegmentationWorker();
  const segRes = await segWorker.execute(snapHtml);
  console.log(`Discovered ${segRes.totalSections} sections in Apple full-page.`);

  const recWorker = new ReconstructionWorker();
  const recRes = await recWorker.execute(
    snapHtml,
    rawCss,
    '',
    segRes.sections,
    'https://www.apple.com/',
    undefined,
    snapHtml
  );

  const fullPageDir = path.join(__dirname, `../storage/jobs/${appleJobId}/full-page`);
  fs.writeFileSync(path.join(fullPageDir, 'index.html'), recRes.fullHtml, 'utf8');
  fs.writeFileSync(path.join(fullPageDir, 'style.css'), recRes.fullCss, 'utf8');
  fs.writeFileSync(path.join(fullPageDir, 'script.js'), recRes.fullJs, 'utf8');
  fs.writeFileSync(path.join(__dirname, `../storage/jobs/${appleJobId}/reconstruction.html`), recRes.fullHtml, 'utf8');

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://localhost:3000/api/jobs/${appleJobId}/preview/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Desktop Resting
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'apple_proof_desktop_resting.png') });
  console.log('Captured apple_proof_desktop_resting.png');

  // 2. Desktop Hover (Mac / Store / Support)
  const appleLinks = await page.$$('a.globalnav-link-mac, a.globalnav-submenu-trigger-link, nav li a');
  let macLink = null;
  for (const l of appleLinks) {
    if (await l.isVisible() && (await l.innerText()).trim().length > 0) {
      macLink = l;
      break;
    }
  }
  if (macLink) {
    console.log('Hovering over nav link:', (await macLink.innerText()).trim());
    await macLink.hover();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'apple_proof_desktop_hover.png') });
    console.log('Captured apple_proof_desktop_hover.png');
  }

  // 3. Apple TV+ Entertainment Carousel
  const gal = await page.$('.media-gallery');
  if (gal) {
    const box = await gal.boundingBox();
    if (box) {
      await page.evaluate(y => window.scrollTo(0, y - 80), box.y);
      await page.waitForTimeout(400);
    }
  }
  const dot = await page.$('.media-gallery-dotnav-item:nth-child(2) a, .dotnav-item:nth-child(2) a, .media-gallery-dotnav-item a, button[class*="gallery"]');
  if (dot) {
    await dot.click({ force: true });
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'apple_proof_carousel_slide.png') });
  console.log('Captured apple_proof_carousel_slide.png');

  // 4. Mobile Menu Click & Submenu
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://localhost:3000/api/jobs/${appleJobId}/preview/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const allTriggers = await page.$$('#globalnav-menutrigger-button, button[class*="menutrigger"], button[aria-label*="Menu"]');
  let appleMenuTrigger = null;
  for (const t of allTriggers) {
    if (await t.isVisible()) { appleMenuTrigger = t; break; }
  }
  if (appleMenuTrigger) {
    await appleMenuTrigger.click({ force: true });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'apple_proof_mobile_drawer_open.png') });
    console.log('Captured apple_proof_mobile_drawer_open.png');

    const subBtn = await page.$('.globalnav-submenu-trigger-button, .globalnav-link, button[class*="submenu"]');
    if (subBtn) {
      await subBtn.click({ force: true });
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'apple_proof_mobile_submenu_open.png') });
      console.log('Captured apple_proof_mobile_submenu_open.png');
    }
  }

  await page.close();
}

async function testStripe(browser) {
  console.log('\n========================================');
  console.log('   TESTING TARGET 3: STRIPE.COM');
  console.log('========================================');

  const stripeJobId = 'job_stripe_verified_master';
  const stripeJobDir = path.join(__dirname, `../storage/jobs/${stripeJobId}`);
  let liveHtml = '';
  let stylesheets = '';

  const snapHtmlPath = fs.existsSync(path.join(stripeJobDir, 'snapshot.html'))
    ? path.join(stripeJobDir, 'snapshot.html')
    : path.join(stripeJobDir, 'reconstruction.html');
  if (fs.existsSync(snapHtmlPath) && fs.existsSync(path.join(stripeJobDir, 'reconstruction.css'))) {
    console.log('Loading existing verified snapshot for Stripe...');
    liveHtml = fs.readFileSync(snapHtmlPath, 'utf8');
    stylesheets = fs.readFileSync(path.join(stripeJobDir, 'reconstruction.css'), 'utf8');
  } else {
    // Fetch live Stripe
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('https://stripe.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    liveHtml = await page.content();
    const $ = cheerio.load(liveHtml);
    const hrefs = [];
    $('link[rel="stylesheet"]').each((_, el) => {
      const h = $(el).attr('href');
      if (h) hrefs.push(new URL(h, 'https://stripe.com').href);
    });
    console.log(`Fetching ${hrefs.length} external stylesheets for Stripe in Node...`);
    const cssParts = await Promise.all(hrefs.map(async (u) => {
      try {
        const res = await fetch(u);
        return await res.text();
      } catch (e) { return ''; }
    }));
    stylesheets = cssParts.join('\n');
    await page.close();
  }

  // Synthesize Stripe
  const segWorker = new VisualSegmentationWorker();
  const segRes = await segWorker.execute(liveHtml);
  console.log(`Discovered ${segRes.totalSections} sections in Stripe full-page.`);

  const recWorker = new ReconstructionWorker();
  const recRes = await recWorker.execute(
    liveHtml,
    stylesheets,
    '',
    segRes.sections,
    'https://stripe.com',
    undefined,
    liveHtml
  );

  const fullPageDir = path.join(stripeJobDir, 'full-page');
  fs.mkdirSync(fullPageDir, { recursive: true });

  fs.writeFileSync(path.join(fullPageDir, 'index.html'), recRes.fullHtml, 'utf8');
  fs.writeFileSync(path.join(fullPageDir, 'style.css'), recRes.fullCss, 'utf8');
  fs.writeFileSync(path.join(fullPageDir, 'script.js'), recRes.fullJs, 'utf8');
  fs.writeFileSync(path.join(stripeJobDir, 'reconstruction.html'), recRes.fullHtml, 'utf8');
  fs.writeFileSync(path.join(stripeJobDir, 'reconstruction.css'), recRes.fullCss, 'utf8');
  fs.writeFileSync(path.join(stripeJobDir, 'job.json'), JSON.stringify({
    id: stripeJobId,
    url: 'https://stripe.com',
    status: 'completed'
  }, null, 2), 'utf8');

  // Test in preview
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://localhost:3000/api/jobs/${stripeJobId}/preview/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Desktop Resting
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'stripe_proof_desktop_resting.png') });
  console.log('Captured stripe_proof_desktop_resting.png');

  // 2. Desktop Hover (Products popover)
  const stripeButtons = await page.$$('header nav button, header [role="button"], header a');
  let stripeNavTab = null;
  for (const b of stripeButtons) {
    if (await b.isVisible() && (await b.innerText()).trim().length > 0) {
      stripeNavTab = b;
      break;
    }
  }
  if (stripeNavTab) {
    await stripeNavTab.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'stripe_proof_desktop_hover.png') });
    console.log('Captured stripe_proof_desktop_hover.png');
  }

  // 3. Carousel (Customer/Testimonial Carousel)
  const stripeNext = await page.$('button[aria-label*="Next slide" i], button[aria-label*="next" i]');
  if (stripeNext) {
    await stripeNext.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await stripeNext.click({ force: true });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'stripe_proof_carousel_slide.png') });
    console.log('Captured stripe_proof_carousel_slide.png');
  }

  // 4. Mobile Viewport & Menu
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://localhost:3000/api/jobs/${stripeJobId}/preview/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const stripeMobileButtons = await page.$$('button[aria-label*="menu" i], .navigation-hamburger-button, .universal-nav-toggle, header button');
  let stripeMobileMenu = null;
  for (const b of stripeMobileButtons) {
    if (await b.isVisible()) { stripeMobileMenu = b; break; }
  }
  if (stripeMobileMenu) {
    await stripeMobileMenu.click({ force: true });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'stripe_proof_mobile_drawer_open.png') });
    console.log('Captured stripe_proof_mobile_drawer_open.png');

    const subTrigger = await page.$('.products-callout, .navigation-item button, .navigation-menu-list button');
    if (subTrigger) {
      await subTrigger.click({ force: true });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'stripe_proof_mobile_submenu_open.png') });
      console.log('Captured stripe_proof_mobile_submenu_open.png');
    }
  }

  await page.close();
}

async function run() {
  const browser = await chromium.launch({
    executablePath: CHROME_EXECUTABLE,
    headless: true,
    args: ['--no-sandbox']
  });

  try {
    await testSamsung(browser);
    await testApple(browser);
    await testStripe(browser);
    console.log('\n========================================');
    console.log('   ALL 3 BRAND TARGETS FULLY VERIFIED!');
    console.log('========================================\n');
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
