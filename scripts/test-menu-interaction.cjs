const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const PROOFS_DIR = '/Users/dhanashreedhruval/.gemini/antigravity/brain/deb334e3-11a0-4c5a-9938-0d7f0b332688/proofs/matrix_visuals';
fs.mkdirSync(PROOFS_DIR, { recursive: true });

function combineSideBySide(bufLive, bufClone) {
  const p1 = PNG.sync.read(bufLive);
  const p2 = PNG.sync.read(bufClone);
  const width = p1.width + p2.width + 12;
  const height = Math.max(p1.height, p2.height);
  const combined = new PNG({ width, height });

  // Fill background with #1e1e1e dark separator
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      combined.data[idx] = 30;
      combined.data[idx + 1] = 30;
      combined.data[idx + 2] = 30;
      combined.data[idx + 3] = 255;
    }
  }

  PNG.bitblt(p1, combined, 0, 0, p1.width, p1.height, 0, 0);
  PNG.bitblt(p2, combined, 0, 0, p2.width, p2.height, p1.width + 12, 0);
  return PNG.sync.write(combined);
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Test (1280x800)
  console.log('Testing Desktop interactions...');
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });

  const pageLive = await desktopContext.newPage();
  await pageLive.goto('https://github.com/securecentricdev/secure-centric-website', { waitUntil: 'domcontentloaded' });
  await pageLive.waitForTimeout(2000);

  const pageClone = await desktopContext.newPage();
  pageClone.on('console', msg => {
    if (msg.type() === 'error') console.log('[Clone Console Error]', msg.text());
  });
  await pageClone.goto('https://replicator.inventkid.com/api/jobs/job_b3bc4f33d07a4af6/preview/', { waitUntil: 'domcontentloaded' });
  await pageClone.waitForTimeout(2000);

  // Desktop Resting
  const liveDesktopResting = await pageLive.screenshot();
  const cloneDesktopResting = await pageClone.screenshot();
  fs.writeFileSync(path.join(PROOFS_DIR, 'compare_desktop_resting.png'), combineSideBySide(liveDesktopResting, cloneDesktopResting));
  console.log('Saved compare_desktop_resting.png');

  // Desktop Drawer: Click hamburger on both
  console.log('Clicking hamburger on live and clone...');
  const liveHam = pageLive.locator('button[aria-label*="navigation" i], button:has(svg.octicon-three-bars)').first();
  if (await liveHam.count() > 0) {
    await liveHam.click();
    await pageLive.waitForTimeout(800);
  }

  const cloneHam = pageClone.locator('button[aria-label*="navigation" i], button:has(svg.octicon-three-bars)').first();
  console.log('Clone hamburger button count:', await cloneHam.count());
  if (await cloneHam.count() > 0) {
    await cloneHam.click();
    await pageClone.waitForTimeout(800);
  }

  const liveDesktopDrawer = await pageLive.screenshot();
  const cloneDesktopDrawer = await pageClone.screenshot();
  fs.writeFileSync(path.join(PROOFS_DIR, 'compare_desktop_drawer.png'), combineSideBySide(liveDesktopDrawer, cloneDesktopDrawer));
  console.log('Saved compare_desktop_drawer.png');

  // 2. Mobile Test (412x924)
  console.log('Testing Mobile interactions...');
  const mobileContext = await browser.newContext({
    viewport: { width: 412, height: 924 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
  });

  const mobLive = await mobileContext.newPage();
  await mobLive.goto('https://github.com/securecentricdev/secure-centric-website', { waitUntil: 'domcontentloaded' });
  await mobLive.waitForTimeout(2000);

  const mobClone = await mobileContext.newPage();
  mobClone.on('console', msg => {
    if (msg.type() === 'error') console.log('[Mobile Clone Console Error]', msg.text());
  });
  await mobClone.goto('https://replicator.inventkid.com/api/jobs/job_b3bc4f33d07a4af6/preview/', { waitUntil: 'domcontentloaded' });
  await mobClone.waitForTimeout(2000);

  // Mobile Resting
  const liveMobResting = await mobLive.screenshot();
  const cloneMobResting = await mobClone.screenshot();
  fs.writeFileSync(path.join(PROOFS_DIR, 'compare_mobile_resting.png'), combineSideBySide(liveMobResting, cloneMobResting));
  console.log('Saved compare_mobile_resting.png');

  // Mobile Drawer: Click hamburger on both
  const mobLiveHam = mobLive.locator('button[aria-label*="navigation" i], button:has(svg.octicon-three-bars)').first();
  if (await mobLiveHam.count() > 0) {
    await mobLiveHam.click();
    await mobLive.waitForTimeout(800);
  }

  const mobCloneHam = mobClone.locator('button[aria-label*="navigation" i], button:has(svg.octicon-three-bars)').first();
  if (await mobCloneHam.count() > 0) {
    await mobCloneHam.click();
    await mobClone.waitForTimeout(800);
  }

  const liveMobDrawer = await mobLive.screenshot();
  const cloneMobDrawer = await mobClone.screenshot();
  fs.writeFileSync(path.join(PROOFS_DIR, 'compare_mobile_drawer.png'), combineSideBySide(liveMobDrawer, cloneMobDrawer));
  console.log('Saved compare_mobile_drawer.png');

  // Mobile UnderlineNav "More items" dropdown
  // First reload pages to close drawer
  await mobLive.reload({ waitUntil: 'domcontentloaded' });
  await mobClone.reload({ waitUntil: 'domcontentloaded' });
  await mobLive.waitForTimeout(1000);
  await mobClone.waitForTimeout(1000);

  const mobLiveMore = mobLive.locator('button:has-text("More"), [data-component="UnderlineNav"] button[aria-haspopup]').first();
  if (await mobLiveMore.count() > 0) {
    await mobLiveMore.click();
    await mobLive.waitForTimeout(800);
  }

  const mobCloneMore = mobClone.locator('button:has-text("More"), [data-component="UnderlineNav"] button[aria-haspopup]').first();
  if (await mobCloneMore.count() > 0) {
    await mobCloneMore.click();
    await mobClone.waitForTimeout(800);
  }

  const liveMobMore = await mobLive.screenshot();
  const cloneMobMore = await mobClone.screenshot();
  fs.writeFileSync(path.join(PROOFS_DIR, 'compare_mobile_more_dropdown.png'), combineSideBySide(liveMobMore, cloneMobMore));
  console.log('Saved compare_mobile_more_dropdown.png');

  await browser.close();
  console.log('All comparisons captured successfully!');
}

run().catch(console.error);
