const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const EVAL_DIR = '/Users/dhanashreedhruval/.gemini/antigravity/brain/deb334e3-11a0-4c5a-9938-0d7f0b332688/proofs/matrix_eval';
fs.mkdirSync(EVAL_DIR, { recursive: true });

function combineImages(buf1, buf2, label1 = 'LIVE GITHUB', label2 = 'CLONE PREVIEW') {
  const p1 = PNG.sync.read(buf1);
  const p2 = PNG.sync.read(buf2);
  const height = Math.max(p1.height, p2.height);
  const width = p1.width + p2.width + 16;
  const combined = new PNG({ width, height });

  // Fill background with dark grey separator #161b22
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      combined.data[idx] = 22;
      combined.data[idx + 1] = 27;
      combined.data[idx + 2] = 34;
      combined.data[idx + 3] = 255;
    }
  }

  PNG.bitblt(p1, combined, 0, 0, p1.width, p1.height, 0, 0);
  PNG.bitblt(p2, combined, 0, 0, p2.width, p2.height, p1.width + 16, 0);
  return PNG.sync.write(combined);
}

async function capture() {
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Drawer (1280x800)
  const dContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  const dPage = await dContext.newPage();
  await dPage.goto('https://replicator.inventkid.com/api/jobs/job_b3bc4f33d07a4af6/preview/', { waitUntil: 'networkidle' });
  await dPage.waitForTimeout(1000);

  // Desktop resting screenshot
  const cloneDesktopResting = await dPage.screenshot();
  fs.writeFileSync(path.join(EVAL_DIR, 'clone_desktop_resting.png'), cloneDesktopResting);

  // Click hamburger to open desktop drawer
  await dPage.evaluate(() => {
    const btn = document.querySelector('button:has(svg.octicon-three-bars), button[aria-label*="menu" i]');
    if (btn) btn.click();
  });
  await dPage.waitForTimeout(1000);
  const cloneDesktopDrawer = await dPage.screenshot();
  fs.writeFileSync(path.join(EVAL_DIR, 'clone_desktop_drawer.png'), cloneDesktopDrawer);
  console.log('Captured clone_desktop_drawer.png');

  // 2. Mobile (412x924)
  const mContext = await browser.newContext({
    viewport: { width: 412, height: 924 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
  });
  const mPage = await mContext.newPage();
  await mPage.goto('https://replicator.inventkid.com/api/jobs/job_b3bc4f33d07a4af6/preview/', { waitUntil: 'networkidle' });
  await mPage.waitForTimeout(1000);

  // Mobile resting screenshot
  const cloneMobileResting = await mPage.screenshot();
  fs.writeFileSync(path.join(EVAL_DIR, 'clone_mobile_resting.png'), cloneMobileResting);

  // Mobile drawer: click hamburger
  await mPage.evaluate(() => {
    const btn = document.querySelector('button:has(svg.octicon-three-bars), button[aria-label*="menu" i]');
    if (btn) btn.click();
  });
  await mPage.waitForTimeout(1000);
  const cloneMobileDrawer = await mPage.screenshot();
  fs.writeFileSync(path.join(EVAL_DIR, 'clone_mobile_drawer.png'), cloneMobileDrawer);
  console.log('Captured clone_mobile_drawer.png');

  // Mobile More items: reload to fresh resting state then click "More"
  await mPage.reload({ waitUntil: 'networkidle' });
  await mPage.waitForTimeout(1000);
  await mPage.evaluate(() => {
    const btn = document.querySelector('[data-component="overflow-menu-button"], [class*="MoreButton"], button[id*="More"]') ||
                Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim().includes('More'));
    if (btn) btn.click();
  });
  await mPage.waitForTimeout(1000);
  const cloneMobileMore = await mPage.screenshot();
  fs.writeFileSync(path.join(EVAL_DIR, 'clone_mobile_more.png'), cloneMobileMore);
  console.log('Captured clone_mobile_more.png');

  await browser.close();

  // Combine with live images uploaded by user
  const userDir = '/Users/dhanashreedhruval/.gemini/antigravity/brain/deb334e3-11a0-4c5a-9938-0d7f0b332688/.user_uploaded';

  // State 1: Desktop Sidebar Drawer
  const liveDesktopDrawerBuf = fs.readFileSync(path.join(userDir, 'media_1794466535533_e4a816e3.png'));
  fs.writeFileSync(
    path.join(EVAL_DIR, 'matrix_1_desktop_drawer_comparison.png'),
    combineImages(liveDesktopDrawerBuf, cloneDesktopDrawer, 'LIVE GITHUB DESKTOP DRAWER', 'CLONE DESKTOP DRAWER')
  );

  // State 2: Mobile Sidebar Drawer
  const liveMobileDrawerBuf = fs.readFileSync(path.join(userDir, 'media_1794466636396_8a53a06f.png'));
  fs.writeFileSync(
    path.join(EVAL_DIR, 'matrix_2_mobile_drawer_comparison.png'),
    combineImages(liveMobileDrawerBuf, cloneMobileDrawer, 'LIVE GITHUB MOBILE DRAWER', 'CLONE MOBILE DRAWER')
  );

  // State 3: Mobile UnderlineNav "More" Dropdown
  const liveMobileMoreBuf = fs.readFileSync(path.join(userDir, 'media_1794466580060_32d8dcff.png'));
  fs.writeFileSync(
    path.join(EVAL_DIR, 'matrix_3_mobile_more_dropdown_comparison.png'),
    combineImages(liveMobileMoreBuf, cloneMobileMore, 'LIVE GITHUB MOBILE MORE', 'CLONE MOBILE MORE')
  );

  // State 4: Mobile Resting
  const liveMobileRestingBuf = fs.readFileSync(path.join(userDir, 'media_1794466645344_655f8cdd.png'));
  fs.writeFileSync(
    path.join(EVAL_DIR, 'matrix_4_mobile_resting_comparison.png'),
    combineImages(liveMobileRestingBuf, cloneMobileResting, 'LIVE GITHUB MOBILE RESTING', 'CLONE MOBILE RESTING')
  );

  console.log('=== ALL MATRIX COMPARISONS ASSEMBLED SUCCESSFULLY ===');
}

capture().catch(console.error);
