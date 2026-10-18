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
  const dump = JSON.parse(fs.readFileSync('storage/anthropic_nav_dump.json', 'utf8'));
  const authenticCss = dump.sheets.join('\n');

  const engine = new GroundUpSynthesisEngine();
  const synth = engine.synthesizeSection(
    dump.navHtml,
    'https://www.anthropic.com',
    authenticCss,
    '.nav_component',
    'navigation',
    dump.fullHtml,
    undefined,
    dump.rootVars
  );

  console.log('Synthesized Navigation HTML length:', synth.html.length);
  console.log('Synthesized Navigation CSS length:', synth.css.length);
  console.log('Synthesized Navigation JS length:', synth.js.length);

  // Generate authentic job ID
  const jobId = 'job_' + crypto.randomBytes(8).toString('hex');
  const jobDir = path.join('storage/jobs', jobId);
  const fullPageDir = path.join(jobDir, 'full-page');
  fs.mkdirSync(fullPageDir, { recursive: true });

  // Native synthesized JS handles dropdowns and mobile drawer universally
  const finalJs = synth.js;

  // Root CSS variables block
  let rootVarsCss = ':root {\n';
  if (dump.rootVars) {
    for (const [k, v] of Object.entries(dump.rootVars)) {
      rootVarsCss += `  ${k}: ${v};\n`;
    }
  }
  rootVarsCss += '  --nav--height: 4.25rem;\n  --nav--banner-height: 2.75rem;\n  --nav--hamburger-thickness: 1.5px;\n  --nav--hamburger-gap: 5px;\n  --nav--hamburger-rotate: 45;\n  --nav--menu-open-duration: 400ms;\n  --nav--menu-close-duration: 300ms;\n}\n';

  // Responsive switching fallback if container queries are inside narrow containers
  const responsiveFixCss = `
  @media (min-width: 56em) {
    .nav_wrap.is-desktop { display: block !important; }
    .nav_wrap.is-mobile { display: none !important; }
  }
  @media (max-width: 55.99em) {
    .nav_wrap.is-desktop { display: none !important; }
    .nav_wrap.is-mobile {
      display: block !important;
      position: relative !important;
      z-index: 1000000 !important;
    }
    .w-nav-button {
      display: block !important;
      position: relative !important;
      z-index: 1000001 !important;
    }
  }
  .w-nav-overlay {
    width: 100% !important;
    left: 0 !important;
    right: 0 !important;
    z-index: 999990 !important;
    background-color: var(--_color-theme---background, #faf9f5) !important;
  }
  .nav_menu_wrap.w-nav-menu {
    width: 100% !important;
    box-sizing: border-box !important;
    background-color: var(--_color-theme---background, #faf9f5) !important;
    padding-top: 5rem !important;
    padding-left: 1.5rem !important;
    padding-right: 1.5rem !important;
    padding-bottom: 3rem !important;
  }
  /* Strict Desktop Hover Stability: Prevent any shift or height change on hover */
  .nav_links_link.is-desktop,
  .w-dropdown-toggle.is-desktop {
    display: flex !important;
    align-items: center !important;
    height: 100% !important;
    box-sizing: border-box !important;
    margin: 0 !important;
  }
  .nav_links_link.is-desktop:hover,
  .w-dropdown-toggle.is-desktop:hover,
  .w-dropdown-toggle.is-desktop.w--open {
    display: flex !important;
    align-items: center !important;
    height: 100% !important;
    transform: none !important;
  }

  /* Mobile Submenu: Seamless inline flow with transparent background and auto height */
  @media (max-width: 55.99em) {
    .nav_wrap.is-mobile .w-dropdown-list,
    .nav_wrap.is-mobile [class*="dropdown-list"],
    .nav_wrap.is-mobile nav.nav_dropdown_main_wrap {
      position: static !important;
      width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      background: transparent !important;
      background-color: transparent !important;
      box-shadow: none !important;
      border: none !important;
      padding: 0 0 1rem 1.25rem !important;
      margin: 0 !important;
      overflow: visible !important;
    }
    .nav_wrap.is-mobile .w-dropdown-list .nav_dropdown_link {
      padding: 0.5rem 0 !important;
      font-size: 1.05rem !important;
      color: inherit !important;
      background: transparent !important;
    }
  }

  .w-dropdown-list.is-desktop.w--open {
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
  }
  .w-dropdown-list.is-mobile.w--open {
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    background: transparent !important;
    height: auto !important;
  }
  .w-nav-overlay.w--open {
    display: block !important;
  }
  `;

  const finalCss = rootVarsCss + '\n' + synth.css + '\n' + responsiveFixCss;

  const finalHtml = `<!DOCTYPE html>
<html lang="en" class="${dump.htmlClass || 'w-mod-js w-mod-ix w-mod-ix3'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Anthropic Global Navigation Replica</title>
  <link rel="stylesheet" href="style.css">
</head>
<body class="${dump.bodyClass || ''}" style="margin: 0; padding: 0; background-color: #faf9f5; color: #191919; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; min-height: 100vh;">
${synth.html}
  <main style="padding: 120px 40px; text-align: center; color: #6b6b6b; max-width: 900px; margin: 0 auto;">
    <h1 style="color: #191919; font-size: 52px; font-weight: 500; letter-spacing: -0.02em; margin-bottom: 20px;">Anthropic AI Navigation Verification</h1>
    <p style="font-size: 22px; line-height: 1.5; color: #555555;">High-fidelity multi-viewport navigation replica with container-query responsive layout, interactive dropdown flyouts (Research, Commitments, Learn, Claude), and animated mobile hamburger drawer.</p>
  </main>
  <script src="script.js" defer></script>
</body>
</html>`;

  fs.writeFileSync(path.join(fullPageDir, 'index.html'), finalHtml);
  fs.writeFileSync(path.join(fullPageDir, 'style.css'), finalCss);
  fs.writeFileSync(path.join(fullPageDir, 'script.js'), finalJs);

  fs.writeFileSync(path.join(jobDir, 'reconstruction.html'), finalHtml);
  fs.writeFileSync(path.join(jobDir, 'reconstruction.css'), finalCss);
  fs.writeFileSync(path.join(jobDir, 'reconstruction.js'), finalJs);

  const jobMeta = {
    id: jobId,
    url: 'https://www.anthropic.com',
    sectionSelector: '.nav_component',
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

  // Launch Playwright for multi-viewport validation
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-web-security']
  });

  // 1. Desktop Validation (1440px)
  console.log('Validating Desktop Navigation at 1440px...');
  const desktopPage = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });

  await desktopPage.goto(`http://localhost:3000/api/jobs/${jobId}/preview/`, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);

  const desktopRestingPath = path.join(ARTIFACTS_DIR, 'anthropic_nav_desktop_resting.png');
  await desktopPage.screenshot({ path: desktopRestingPath, clip: { x: 0, y: 0, width: 1440, height: 500 } });
  console.log('Captured desktop resting screenshot:', desktopRestingPath);

  // Test Hover Flyout: Research
  console.log('Testing Desktop dropdown hover: "Research"...');
  const researchTrigger = desktopPage.locator('.nav_wrap.is-desktop .w-dropdown-toggle').filter({ hasText: 'Research' }).first();
  let researchFlyoutOpen = false;
  if (await researchTrigger.count() > 0) {
    await researchTrigger.hover();
    await desktopPage.waitForTimeout(600);
    researchFlyoutOpen = await desktopPage.evaluate(() => {
      const toggles = Array.from(document.querySelectorAll('.nav_wrap.is-desktop .w-dropdown-toggle'));
      const rToggle = toggles.find(t => t.textContent.includes('Research'));
      const dd = rToggle ? rToggle.closest('.w-dropdown') : null;
      const list = dd ? dd.querySelector('.w-dropdown-list') : null;
      return list ? (list.classList.contains('w--open') || window.getComputedStyle(list).display === 'block') : false;
    });
  }
  const desktopResearchPath = path.join(ARTIFACTS_DIR, 'anthropic_nav_desktop_research_flyout.png');
  await desktopPage.screenshot({ path: desktopResearchPath, clip: { x: 0, y: 0, width: 1440, height: 500 } });
  console.log('Research flyout open:', researchFlyoutOpen);

  // Test Hover Flyout: Commitments
  console.log('Testing Desktop dropdown hover: "Commitments"...');
  const commitmentsTrigger = desktopPage.locator('.nav_wrap.is-desktop .w-dropdown-toggle').filter({ hasText: 'Commitments' }).first();
  let commitmentsFlyoutOpen = false;
  if (await commitmentsTrigger.count() > 0) {
    await commitmentsTrigger.hover();
    await desktopPage.waitForTimeout(600);
    commitmentsFlyoutOpen = await desktopPage.evaluate(() => {
      const toggles = Array.from(document.querySelectorAll('.nav_wrap.is-desktop .w-dropdown-toggle'));
      const cToggle = toggles.find(t => t.textContent.includes('Commitments'));
      const dd = cToggle ? cToggle.closest('.w-dropdown') : null;
      const list = dd ? dd.querySelector('.w-dropdown-list') : null;
      return list ? (list.classList.contains('w--open') || window.getComputedStyle(list).display === 'block') : false;
    });
  }
  const desktopCommitmentsPath = path.join(ARTIFACTS_DIR, 'anthropic_nav_desktop_commitments_flyout.png');
  await desktopPage.screenshot({ path: desktopCommitmentsPath, clip: { x: 0, y: 0, width: 1440, height: 500 } });
  console.log('Commitments flyout open:', commitmentsFlyoutOpen);

  // Test Hover Flyout: Learn
  console.log('Testing Desktop dropdown hover: "Learn"...');
  const learnTrigger = desktopPage.locator('.nav_wrap.is-desktop .w-dropdown-toggle').filter({ hasText: 'Learn' }).first();
  let learnFlyoutOpen = false;
  if (await learnTrigger.count() > 0) {
    await learnTrigger.hover();
    await desktopPage.waitForTimeout(600);
    learnFlyoutOpen = await desktopPage.evaluate(() => {
      const toggles = Array.from(document.querySelectorAll('.nav_wrap.is-desktop .w-dropdown-toggle'));
      const lToggle = toggles.find(t => t.textContent.includes('Learn') && !t.textContent.includes('Claude'));
      const dd = lToggle ? lToggle.closest('.w-dropdown') : null;
      const list = dd ? dd.querySelector('.w-dropdown-list') : null;
      return list ? (list.classList.contains('w--open') || window.getComputedStyle(list).display === 'block') : false;
    });
  }
  const desktopLearnPath = path.join(ARTIFACTS_DIR, 'anthropic_nav_desktop_learn_flyout.png');
  await desktopPage.screenshot({ path: desktopLearnPath, clip: { x: 0, y: 0, width: 1440, height: 500 } });
  console.log('Learn flyout open:', learnFlyoutOpen);

  // Measure if menu shifts on hover
  const shiftTest = await desktopPage.evaluate(async () => {
    const items = Array.from(document.querySelectorAll('.nav_wrap.is-desktop .nav_links_item, .nav_wrap.is-desktop .w-dropdown'));
    const before = items.map(el => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    const toggle = document.querySelector('.nav_wrap.is-desktop .w-dropdown-toggle');
    if (toggle) {
      toggle.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    }
    await new Promise(r => setTimeout(r, 300));
    const after = items.map(el => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    const shifts = [];
    for (let i = 0; i < before.length; i++) {
      if (Math.abs(before[i].x - after[i].x) > 1 || Math.abs(before[i].y - after[i].y) > 1) {
        shifts.push({ index: i, diffX: after[i].x - before[i].x, diffY: after[i].y - before[i].y });
      }
    }
    return { shiftCount: shifts.length, shifts };
  });
  console.log('Desktop hover shift test (must be 0):', shiftTest);

  await desktopPage.close();

  // 2. Mobile Validation (390px)
  console.log('Validating Mobile Navigation at 390px...');
  const mobilePage = await browser.newPage({
    viewport: { width: 390, height: 844 }
  });

  await mobilePage.goto(`http://localhost:3000/api/jobs/${jobId}/preview/`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);

  const mobileRestingPath = path.join(ARTIFACTS_DIR, 'anthropic_nav_mobile_resting.png');
  await mobilePage.screenshot({ path: mobileRestingPath, clip: { x: 0, y: 0, width: 390, height: 600 } });
  console.log('Captured mobile resting screenshot:', mobileRestingPath);

  // Check mobile hamburger button
  const mobileBtn = mobilePage.locator('.w-nav-button').first();
  const mobileBtnVisible = await mobileBtn.isVisible();
  console.log('Mobile hamburger button visible:', mobileBtnVisible);

  // Click hamburger button to open mobile menu
  console.log('Clicking mobile hamburger button...');
  await mobileBtn.click();
  await mobilePage.waitForTimeout(600);

  const drawerState = await mobilePage.evaluate(() => {
    const btn = document.querySelector('.w-nav-button');
    const overlay = document.querySelector('.w-nav-overlay');
    const menu = document.querySelector('.w-nav-menu');
    return {
      btnHasOpenClass: btn ? btn.classList.contains('w--open') : false,
      btnAriaExpanded: btn ? btn.getAttribute('aria-expanded') : null,
      overlayDisplay: overlay ? window.getComputedStyle(overlay).display : null,
      menuDisplay: menu ? window.getComputedStyle(menu).display : null,
      linksCount: menu ? menu.querySelectorAll('a').length : 0
    };
  });
  console.log('Mobile drawer state after tap:', drawerState);

  const mobileDrawerOpenPath = path.join(ARTIFACTS_DIR, 'anthropic_nav_mobile_drawer_open.png');
  await mobilePage.screenshot({ path: mobileDrawerOpenPath, clip: { x: 0, y: 0, width: 390, height: 844 } });
  console.log('Captured mobile drawer open screenshot:', mobileDrawerOpenPath);

  // Test clicking "Research" inside mobile drawer to open submenu
  console.log('Testing mobile submenu click on "Research"...');
  const mobileResearchToggle = mobilePage.locator('.w-nav-menu .w-dropdown-toggle').filter({ hasText: 'Research' }).first();
  let mobileSubmenuOpen = false;
  let pageScrollHeight = 0;
  let submenuBg = '';
  if (await mobileResearchToggle.count() > 0) {
    await mobileResearchToggle.click({ force: true });
    await mobilePage.waitForTimeout(500);
    const subInfo = await mobilePage.evaluate(() => {
      const list = document.querySelector('.w-nav-menu .w-dropdown-list');
      const cs = list ? window.getComputedStyle(list) : {};
      return {
        isOpen: list ? (list.classList.contains('w--open') || cs.display === 'block') : false,
        bg: cs.backgroundColor,
        height: cs.height,
        scrollHeight: document.documentElement.scrollHeight
      };
    });
    mobileSubmenuOpen = subInfo.isOpen;
    pageScrollHeight = subInfo.scrollHeight;
    submenuBg = subInfo.bg;
    console.log('Mobile submenu opened state:', subInfo);
  }

  const mobileSubmenuOpenPath = path.join(ARTIFACTS_DIR, 'anthropic_nav_mobile_submenu_open.png');
  await mobilePage.screenshot({ path: mobileSubmenuOpenPath, clip: { x: 0, y: 0, width: 390, height: 844 } });
  console.log('Captured mobile submenu open screenshot:', mobileSubmenuOpenPath);

  // Click hamburger again to close
  console.log('Clicking mobile hamburger button to close...');
  await mobileBtn.click({ force: true });
  await mobilePage.waitForTimeout(500);

  const mobileDrawerClosedPath = path.join(ARTIFACTS_DIR, 'anthropic_nav_mobile_drawer_closed.png');
  await mobilePage.screenshot({ path: mobileDrawerClosedPath, clip: { x: 0, y: 0, width: 390, height: 600 } });

  await mobilePage.close();
  await browser.close();

  const report = {
    jobId,
    previewUrl: `http://localhost:3000/api/jobs/${jobId}/preview/`,
    desktop: {
      resting: true,
      researchFlyoutOpen,
      commitmentsFlyoutOpen,
      learnFlyoutOpen
    },
    mobile: {
      resting: true,
      hamburgerVisible: mobileBtnVisible,
      drawerOpened: drawerState.btnHasOpenClass && (drawerState.overlayDisplay === 'block' || drawerState.menuDisplay === 'block'),
      linksFound: drawerState.linksCount
    }
  };

  fs.writeFileSync('storage/anthropic_nav_report.json', JSON.stringify(report, null, 2));
  console.log('Validation complete. Summary:', JSON.stringify(report, null, 2));
}

run().catch(err => {
  console.error('Synthesis error:', err);
  process.exit(1);
});
