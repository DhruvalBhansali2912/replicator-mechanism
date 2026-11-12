const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT_DIR = '/Users/dhanashreedhruval/.gemini/antigravity/brain/deb334e3-11a0-4c5a-9938-0d7f0b332688/proofs/clone_states';
fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop 1280x800
  const dContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  const dPage = await dContext.newPage();
  dPage.on('console', msg => console.log('[Desktop Console]', msg.type(), msg.text()));
  await dPage.goto('https://replicator.inventkid.com/api/jobs/job_b3bc4f33d07a4af6/preview/', { waitUntil: 'networkidle' });
  await dPage.waitForTimeout(1000);

  // Desktop Resting
  await dPage.screenshot({ path: path.join(OUT_DIR, 'clone_desktop_resting.png') });
  console.log('Saved clone_desktop_resting.png');

  // Check hamburger button attributes
  const hamInfo = await dPage.evaluate(() => {
    const btn = document.querySelector('button[data-component="IconButton"], button:has(svg.octicon-three-bars)');
    if (!btn) return { found: false };
    return {
      found: true,
      tagName: btn.tagName,
      className: btn.className,
      ariaLabel: btn.getAttribute('aria-label'),
      hasDataMenuBound: btn.hasAttribute('data-menu-bound'),
      hasClickHandlers: typeof btn.onclick === 'function' || !!btn.__replicator_has_bound,
      innerHTML: btn.innerHTML.slice(0, 100)
    };
  });
  console.log('Desktop hamburger info:', hamInfo);

  // Click hamburger button to open drawer
  const ham = dPage.locator('button[data-component="IconButton"]:has(svg.octicon-three-bars), button:has(svg.octicon-three-bars)').first();
  if (await ham.count() > 0) {
    await ham.click();
    await dPage.waitForTimeout(800);
  }
  await dPage.screenshot({ path: path.join(OUT_DIR, 'clone_desktop_drawer.png') });
  console.log('Saved clone_desktop_drawer.png');

  // Check drawer state
  const drawerInfo = await dPage.evaluate(() => {
    const drawer = document.querySelector('[role="dialog"], [class*="Dialog-Dialog"]');
    const backdrop = document.querySelector('[class*="Dialog-Backdrop"]');
    return {
      drawer: drawer ? {
        display: window.getComputedStyle(drawer).display,
        visibility: window.getComputedStyle(drawer).visibility,
        opacity: window.getComputedStyle(drawer).opacity,
        zIndex: window.getComputedStyle(drawer).zIndex,
        box: drawer.getBoundingClientRect()
      } : null,
      backdrop: backdrop ? {
        display: window.getComputedStyle(backdrop).display,
        visibility: window.getComputedStyle(backdrop).visibility,
        opacity: window.getComputedStyle(backdrop).opacity,
        zIndex: window.getComputedStyle(backdrop).zIndex,
        box: backdrop.getBoundingClientRect()
      } : null
    };
  });
  console.log('Drawer computed styles after click:', JSON.stringify(drawerInfo, null, 2));

  // 2. Mobile 412x924
  const mContext = await browser.newContext({
    viewport: { width: 412, height: 924 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
  });
  const mPage = await mContext.newPage();
  mPage.on('console', msg => console.log('[Mobile Console]', msg.type(), msg.text()));
  await mPage.goto('https://replicator.inventkid.com/api/jobs/job_b3bc4f33d07a4af6/preview/', { waitUntil: 'networkidle' });
  await mPage.waitForTimeout(1000);

  // Mobile Resting
  await mPage.screenshot({ path: path.join(OUT_DIR, 'clone_mobile_resting.png') });
  console.log('Saved clone_mobile_resting.png');

  // Mobile Drawer: Click hamburger
  const mHam = mPage.locator('button[data-component="IconButton"]:has(svg.octicon-three-bars), button:has(svg.octicon-three-bars)').first();
  if (await mHam.count() > 0) {
    await mHam.click();
    await mPage.waitForTimeout(800);
  }
  await mPage.screenshot({ path: path.join(OUT_DIR, 'clone_mobile_drawer.png') });
  console.log('Saved clone_mobile_drawer.png');

  // Reload mobile page to close drawer and test "More" dropdown
  await mPage.reload({ waitUntil: 'networkidle' });
  await mPage.waitForTimeout(1000);

  // Mobile "More" dropdown
  const moreBtn = mPage.locator('button:has-text("More"), [data-component="overflow-menu-button"], [class*="MoreButton"]').first();
  console.log('Mobile "More" button count:', await moreBtn.count());
  if (await moreBtn.count() > 0) {
    await moreBtn.click();
    await mPage.waitForTimeout(800);
  }
  await mPage.screenshot({ path: path.join(OUT_DIR, 'clone_mobile_more_dropdown.png') });
  console.log('Saved clone_mobile_more_dropdown.png');

  const moreInfo = await mPage.evaluate(() => {
    const activePanels = Array.from(document.querySelectorAll('[role="menu"], [data-component="Overlay"], [class*="Overlay"], [class*="ActionList"]')).map(el => ({
      tag: el.tagName,
      className: el.className,
      display: window.getComputedStyle(el).display,
      visibility: window.getComputedStyle(el).visibility,
      box: el.getBoundingClientRect()
    }));
    return activePanels.filter(p => p.box.width > 0 && p.box.height > 0);
  });
  console.log('Active panels after clicking More:', JSON.stringify(moreInfo, null, 2));

  await browser.close();
}

run().catch(console.error);
