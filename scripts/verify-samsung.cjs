const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const cheerio = require('cheerio');

const { GroundUpSynthesisEngine } = require('../dist/synthesis/engine.js');
const { ReconstructionWorker } = require('../dist/workers/reconstruction-worker.js');
const { JsTransformer } = require('../dist/transformer/js-transformer.js');

const ARTIFACTS_DIR = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84';
const CHROME_EXECUTABLE = '/Users/dhanashreedhruval/Library/Caches/ms-playwright/chromium-1243/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

async function main() {
  console.log('--- Verifying Samsung Re-Synthesis ---');
  const jobPath = path.join(__dirname, '../storage/jobs/job_a17b5ffdc22a429c/job.json');
  const job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));

  const sectionHtml = job.options.sectionHtml;
  const rawCss = fs.readFileSync(path.join(__dirname, '../storage/jobs/job_a17b5ffdc22a429c/reconstruction.css'), 'utf8');

  // Synthesize single section
  const engine = new GroundUpSynthesisEngine();
  const synthRes = engine.synthesizeSection(
    sectionHtml,
    job.url,
    rawCss,
    '#component-id',
    'navbar',
    job.options.htmlSnapshot
  );
  console.log('Synthesis archetype:', synthRes.archetype, 'score:', synthRes.score);

  // Reconstruct with ReconstructionWorker
  const recWorker = new ReconstructionWorker();
  const recRes = await recWorker.execute(
    sectionHtml,
    rawCss,
    '',
    [
      {
        id: 'sec_samsung_nav',
        index: 0,
        selector: '#component-id',
        tagName: 'nav',
        archetype: 'navbar',
        confidence: 1.0,
        html: sectionHtml,
        rect: { x: 0, y: 0, width: 1440, height: 75 }
      }
    ],
    job.url,
    'navbar',
    job.options.htmlSnapshot
  );

  console.log('Reconstruction passed:', recRes.passed, 'Average score:', recRes.averageScore);

  // Write to full-page directory
  const fullPageDir = path.join(__dirname, '../storage/jobs/job_a17b5ffdc22a429c/full-page');
  fs.writeFileSync(path.join(fullPageDir, 'index.html'), recRes.fullHtml, 'utf8');
  fs.writeFileSync(path.join(fullPageDir, 'style.css'), recRes.fullCss, 'utf8');
  fs.writeFileSync(path.join(fullPageDir, 'script.js'), recRes.fullJs, 'utf8');
  fs.writeFileSync(path.join(__dirname, '../storage/jobs/job_a17b5ffdc22a429c/reconstruction.html'), recRes.fullHtml, 'utf8');

  console.log('Wrote updated reconstruction files.');

  // Playwright verification
  const browser = await chromium.launch({
    executablePath: fs.existsSync(CHROME_EXECUTABLE) ? CHROME_EXECUTABLE : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // 1. Desktop Test
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktopPage = await desktopContext.newPage();
  const fileUrl = `file://${path.resolve(fullPageDir, 'index.html')}`;
  await desktopPage.goto(fileUrl, { waitUntil: 'load' });
  await desktopPage.waitForTimeout(1000);

  // Take resting screenshot
  const restShot = path.join(ARTIFACTS_DIR, 'samsung_desktop_resting.png');
  await desktopPage.screenshot({ path: restShot });
  console.log('Saved resting screenshot:', restShot);

  // Check navbar visibility
  const navVisible = await desktopPage.evaluate(() => {
    const nav = document.querySelector('.nv00-gnb-v4') || document.querySelector('nav');
    if (!nav) return { found: false };
    const rect = nav.getBoundingClientRect();
    const style = window.getComputedStyle(nav);
    return {
      found: true,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      height: rect.height,
      width: rect.width
    };
  });
  console.log('Desktop Nav visibility:', navVisible);

  // Test Hover on first menu item
  const hoverSelector = '.nv00-gnb-v4__l0-menu, nav li, [class*="l0-menu"]';
  const menuItems = await desktopPage.$$(hoverSelector);
  console.log(`Found ${menuItems.length} menu items for hover test.`);

  let hoverSuccess = false;
  let targetItem = null;
  for (const it of menuItems) {
    if (await it.isVisible()) {
      targetItem = it;
      break;
    }
  }

  if (targetItem) {
    console.log('Hovering on visible menu item...');
    await targetItem.hover({ timeout: 5000 });
    await desktopPage.waitForTimeout(500);

    const hoverState = await desktopPage.evaluate(() => {
      const activeFlyout = document.querySelector('.nv00-gnb-v4__l1-menu-container, [class*="l1-menu-container"], [class*="submenu"], [class*="flyout"], [class*="dropdown-menu"]');
      const navContainer = document.querySelector('.nv00-gnb-v4, nav');
      const isShowClass = navContainer && navContainer.className.includes('--show');
      const style = activeFlyout ? window.getComputedStyle(activeFlyout) : null;
      return {
        hasFlyout: !!activeFlyout,
        hasShowClass: isShowClass,
        flyoutDisplay: style ? style.display : 'none',
        flyoutVisibility: style ? style.visibility : 'hidden',
        flyoutOpacity: style ? style.opacity : '0',
        flyoutHeight: activeFlyout ? activeFlyout.getBoundingClientRect().height : 0
      };
    });
    console.log('Desktop Hover state:', hoverState);

    const hoverShot = path.join(ARTIFACTS_DIR, 'samsung_desktop_hover.png');
    await desktopPage.screenshot({ path: hoverShot });
    console.log('Saved hover screenshot:', hoverShot);
    hoverSuccess = hoverState.hasShowClass || hoverState.flyoutHeight > 10 || hoverState.flyoutVisibility === 'visible';
  }

  await desktopContext.close();

  // 2. Mobile Test
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(fileUrl, { waitUntil: 'load' });
  await mobilePage.waitForTimeout(1000);

  const mobileRestShot = path.join(ARTIFACTS_DIR, 'samsung_mobile_resting.png');
  await mobilePage.screenshot({ path: mobileRestShot });
  console.log('Saved mobile resting screenshot:', mobileRestShot);

  // Click hamburger
  const hamburgerSelector = '.nv00-gnb-v4__utility-hamburger, button[aria-label*="Menu"], button[class*="hamburger"], [class*="mobile-toggle"]';
  const hamburger = await mobilePage.$(hamburgerSelector);
  let mobileDrawerOpened = false;
  let submenuOpened = false;

  if (hamburger) {
    console.log('Found mobile hamburger button. Clicking...');
    await hamburger.click();
    await mobilePage.waitForTimeout(500);

    const openState = await mobilePage.evaluate(() => {
      const container = document.querySelector('.nv00-gnb-v4__container') || document.querySelector('nav');
      const isOpened = container ? (container.classList.contains('nv00-gnb-v4--show') || container.classList.contains('nv00-gnb-v4--opended') || container.getAttribute('aria-hidden') === 'false') : false;
      const drawerVisible = container && container.getBoundingClientRect().height > 100;
      return { isOpened, drawerVisible, rect: container ? container.getBoundingClientRect() : null };
    });
    console.log('Mobile Drawer open state:', openState);

    const mobileOpenShot = path.join(ARTIFACTS_DIR, 'samsung_mobile_opened.png');
    await mobilePage.screenshot({ path: mobileOpenShot });
    console.log('Saved mobile opened screenshot:', mobileOpenShot);
    mobileDrawerOpened = openState.drawerVisible;

    // Test clicking submenu inside drawer
    const submenuBtnSelector = '.nv00-gnb-v4__l0-menu-btn, .nv00-gnb-v4__l0-menu-toggle-btn, [class*="l0-menu"] button, [class*="l0-menu"] a';
    const submenuBtns = await mobilePage.$$(submenuBtnSelector);
    let submenuBtn = null;
    for (const b of submenuBtns) {
      if (await b.isVisible()) {
        submenuBtn = b;
        break;
      }
    }
    if (submenuBtn) {
      console.log('Clicking visible mobile submenu button...');
      await submenuBtn.click();
      await mobilePage.waitForTimeout(500);

      const subState = await mobilePage.evaluate(() => {
        const activeSubmenu = document.querySelector('.nv00-gnb-v4__l0-menu--show, [class*="l0-menu--show"], [class*="submenu--open"]');
        return { hasActiveSubmenu: !!activeSubmenu };
      });
      console.log('Mobile Submenu state:', subState);
      submenuOpened = subState.hasActiveSubmenu;

      const mobileSubShot = path.join(ARTIFACTS_DIR, 'samsung_mobile_submenu.png');
      await mobilePage.screenshot({ path: mobileSubShot });
      console.log('Saved mobile submenu screenshot:', mobileSubShot);
    }
  }

  await mobileContext.close();
  await browser.close();

  console.log('\n======================================');
  console.log('SAMSUNG VERIFICATION SUMMARY:');
  console.log('Desktop Nav Visible:', navVisible.found && navVisible.display !== 'none');
  console.log('Desktop Hover Menu Working:', hoverSuccess);
  console.log('Mobile Drawer Opened:', mobileDrawerOpened);
  console.log('Mobile Submenu Opened:', submenuOpened);
  console.log('======================================\n');
}

main().catch(err => {
  console.error('Error running Samsung verification:', err);
  process.exit(1);
});
