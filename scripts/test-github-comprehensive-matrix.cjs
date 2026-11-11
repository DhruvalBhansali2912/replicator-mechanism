const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { PNG } = require('pngjs');
const pm = require('pixelmatch');
const pixelmatch = pm.default || pm;
const cheerio = require('cheerio');

const { resolveTargetSectionFromSnapshot } = require('../dist/classifier/section-resolver.js');
const { synthesisEngine } = require('../dist/synthesis/engine.js');

const PROOFS_DIR = '/Users/dhanashreedhruval/.gemini/antigravity/brain/deb334e3-11a0-4c5a-9938-0d7f0b332688/proofs/github_matrix';
fs.mkdirSync(PROOFS_DIR, { recursive: true });

function computeStrictPixelmatch(buf1, buf2, diffOutPath) {
  if (!buf1 || !buf2) return { score: 0, diffPixels: 999999 };
  const img1 = PNG.sync.read(buf1);
  const img2 = PNG.sync.read(buf2);
  const width = Math.min(img1.width, img2.width);
  const height = Math.min(img1.height, img2.height);

  const cropped1 = new PNG({ width, height });
  const cropped2 = new PNG({ width, height });
  PNG.bitblt(img1, cropped1, 0, 0, width, height, 0, 0);
  PNG.bitblt(img2, cropped2, 0, 0, width, height, 0, 0);

  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(cropped1.data, cropped2.data, diff.data, width, height, {
    threshold: 0.1,
    includeAA: true,
  });

  const totalPixels = width * height;
  const matchRatio = Math.max(0, 1 - diffPixels / totalPixels);
  const score = Math.round(matchRatio * 10000) / 100;
  fs.writeFileSync(diffOutPath, PNG.sync.write(diff));
  return { score, diffPixels, totalPixels, width, height };
}

async function runComprehensiveMatrix() {
  console.log('======================================================================');
  console.log('🔬 GITHUB HEADER EXHAUSTIVE INTERACTION & VIEWPORT VERIFICATION MATRIX');
  console.log('======================================================================\n');

  const browser = await chromium.launch({ headless: true });

  // 1. Fetch live page assets and snapshot
  console.log('1. Loading live GitHub repository page...');
  const liveCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const livePage = await liveCtx.newPage();
  await livePage.goto('https://github.com/securecentricdev/secure-centric-website', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await livePage.waitForTimeout(1500);

  const pageHtml = await livePage.content();
  const $snap = cheerio.load(pageHtml);

  const { clientCss, inlinedStyles, capturedStylesheets } = await livePage.evaluate(async () => {
    let css = '';
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          css += rule.cssText + '\n';
        }
      } catch {}
    }
    let inlined = '';
    document.querySelectorAll('style').forEach((s) => { inlined += s.textContent + '\n'; });
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href);
    return { clientCss: css, inlinedStyles: inlined, capturedStylesheets: links };
  });

  const stylesheetsExtra = [];
  for (const href of capturedStylesheets.slice(0, 20)) {
    try {
      const resp = await livePage.request.get(href).catch(() => null);
      if (resp && resp.ok()) {
        const text = await resp.text().catch(() => '');
        if (text) stylesheetsExtra.push(text);
      }
    } catch {}
  }
  const combinedCss = clientCss + '\n' + stylesheetsExtra.join('\n') + '\n' + inlinedStyles;

  const rootVars = await livePage.evaluate(() => {
    const vars = {};
    const computed = window.getComputedStyle(document.documentElement);
    for (let i = 0; i < computed.length; i++) {
      const prop = computed[i];
      if (prop && prop.startsWith('--')) {
        vars[prop] = computed.getPropertyValue(prop).trim();
      }
    }
    return vars;
  });

  // Target the repository AppHeader & UnderlineNav
  const selector = 'header.GlobalNav, header[class*="GlobalNav"], header[class*="appHeader"], header';
  const resolvedCheerio = resolveTargetSectionFromSnapshot($snap, 'navbar', selector);
  const resolvedHtml = resolvedCheerio ? $snap.html(resolvedCheerio) : '';

  console.log('2. Synthesizing section with current engine...');
  const synthResult = synthesisEngine.synthesizeSection(
    resolvedHtml,
    'https://github.com/securecentricdev/secure-centric-website',
    combinedCss,
    selector,
    'navbar',
    pageHtml,
    [],
    rootVars
  );

  // Start clone server
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="en" data-color-mode="dark" data-dark-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    html, body { margin: 0; padding: 0; background: #0d1117 !important; color: #f0f6fc; }
    ${synthResult.css}
  </style>
</head>
<body style="margin: 0; padding: 0; background: #0d1117 !important;">
  ${synthResult.html}
  <script>
    ${synthResult.js}
  </script>
</body>
</html>`);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const cloneUrl = `http://127.0.0.1:${port}/`;
  console.log(`Clone server running at ${cloneUrl}\n`);

  const viewports = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 412, height: 924 } // Pixel 9 exactly
  ];

  const results = [];

  for (const vp of viewports) {
    console.log(`======================================================================`);
    console.log(`📱 TESTING VIEWPORT: ${vp.name.toUpperCase()} (${vp.width}x${vp.height})`);
    console.log(`======================================================================`);

    const liveTestPage = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await liveTestPage.goto('https://github.com/securecentricdev/secure-centric-website', { waitUntil: 'domcontentloaded' });
    await liveTestPage.waitForTimeout(1000);

    const cloneTestPage = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const clonePageErrors = [];
    cloneTestPage.on('pageerror', (err) => {
      console.error(`  ❌ [${vp.name.toUpperCase()} PAGE_ERROR]`, err.message);
      clonePageErrors.push(err.message);
    });

    await cloneTestPage.goto(cloneUrl, { waitUntil: 'load' });
    await cloneTestPage.waitForTimeout(600);

    // Locate header element in live and clone
    const liveHeader = await liveTestPage.$('header.GlobalNav, header[class*="GlobalNav"], header').catch(() => null);
    const cloneHeader = await cloneTestPage.$('header.GlobalNav, header[class*="GlobalNav"], header, body > div').catch(() => null);

    // 1. Resting State
    const liveRestingBuf = liveHeader ? await liveHeader.screenshot().catch(() => null) : await liveTestPage.screenshot({ clip: { x: 0, y: 0, width: vp.width, height: 150 } });
    const cloneRestingBuf = cloneHeader ? await cloneHeader.screenshot().catch(() => null) : await cloneTestPage.screenshot({ clip: { x: 0, y: 0, width: vp.width, height: 150 } });

    const restingDiffPath = path.join(PROOFS_DIR, `${vp.name}_resting_diff.png`);
    fs.writeFileSync(path.join(PROOFS_DIR, `${vp.name}_live_resting.png`), liveRestingBuf);
    fs.writeFileSync(path.join(PROOFS_DIR, `${vp.name}_clone_resting.png`), cloneRestingBuf);

    const restingScore = computeStrictPixelmatch(liveRestingBuf, cloneRestingBuf, restingDiffPath);
    console.log(`  📸 Resting State Match: ${restingScore.score}%`);
    results.push({ viewport: vp.name, state: 'resting', score: restingScore.score, errors: clonePageErrors.length });

    // 2. Interactive Targets to Test
    const interactiveTargets = [
      { id: 'hamburger_drawer', desc: 'Hamburger Menu / Global Nav Drawer', selector: 'button[aria-label="Toggle navigation"], button[aria-haspopup="dialog"], button:has(svg.octicon-three-bars)' },
      { id: 'tab_code', desc: 'Code Tab', selector: 'a[data-tab-item="code-tab"], a:has-text("Code"), [role="tab"]:has-text("Code")' },
      { id: 'tab_issues', desc: 'Issues Tab', selector: 'a[data-tab-item="issues-tab"], a:has-text("Issues"), [role="tab"]:has-text("Issues")' },
      { id: 'tab_pulls', desc: 'Pull Requests Tab', selector: 'a[data-tab-item="pull-requests-tab"], a:has-text("Pull requests"), [role="tab"]:has-text("Pull requests")' },
      { id: 'overflow_more', desc: 'More Overflow Dropdown', selector: 'button:has-text("More"), [data-component="ActionMenu"] button, [aria-label*="More"]' },
    ];

    for (const target of interactiveTargets) {
      console.log(`\n  --- Probing Action: ${target.desc} ---`);

      // Find trigger on clone
      const cloneTrigger = await cloneTestPage.$(target.selector).catch(() => null);
      const liveTrigger = await liveTestPage.$(target.selector).catch(() => null);

      if (!cloneTrigger) {
        console.log(`    ⚠️ Clone trigger not found for selector: ${target.selector}`);
        continue;
      }

      // Test Hover
      try {
        await cloneTrigger.hover({ timeout: 1500 }).catch(() => {});
        await cloneTestPage.waitForTimeout(200);

        if (liveTrigger) {
          await liveTrigger.hover({ timeout: 1500 }).catch(() => {});
          await liveTestPage.waitForTimeout(200);
        }

        const cloneHoverBuf = cloneHeader ? await cloneHeader.screenshot().catch(() => null) : await cloneTestPage.screenshot({ clip: { x: 0, y: 0, width: vp.width, height: 150 } });
        const liveHoverBuf = liveHeader ? await liveHeader.screenshot().catch(() => null) : await liveTestPage.screenshot({ clip: { x: 0, y: 0, width: vp.width, height: 150 } });

        const hoverDiffPath = path.join(PROOFS_DIR, `${vp.name}_hover_${target.id}_diff.png`);
        fs.writeFileSync(path.join(PROOFS_DIR, `${vp.name}_hover_${target.id}_clone.png`), cloneHoverBuf);
        if (liveHoverBuf) fs.writeFileSync(path.join(PROOFS_DIR, `${vp.name}_hover_${target.id}_live.png`), liveHoverBuf);

        const hoverScore = computeStrictPixelmatch(liveHoverBuf, cloneHoverBuf, hoverDiffPath);
        console.log(`    🎯 Hover State Match: ${hoverScore.score}%`);
        results.push({ viewport: vp.name, state: `hover_${target.id}`, score: hoverScore.score, errors: clonePageErrors.length });
      } catch (err) {
        console.warn(`    Hover probe notice: ${err.message}`);
      }

      // Test Click / Toggle
      try {
        console.log(`    👉 Clicking trigger: ${target.desc}`);
        await cloneTrigger.click({ timeout: 1500 }).catch(() => {});
        await cloneTestPage.waitForTimeout(350);

        if (liveTrigger) {
          await liveTrigger.click({ timeout: 1500 }).catch(() => {});
          await liveTestPage.waitForTimeout(350);
        }

        // Measure what opened on clone
        const cloneOpenedInfo = await cloneTestPage.evaluate(() => {
          const portals = Array.from(document.querySelectorAll('[data-interactive-portal]'));
          const openPortals = portals.filter(p => window.getComputedStyle(p).display !== 'none' && window.getComputedStyle(p).visibility !== 'hidden');
          const dialogs = Array.from(document.querySelectorAll('dialog, [role="dialog"]')).filter(d => window.getComputedStyle(d).display !== 'none' && window.getComputedStyle(d).visibility !== 'hidden');
          const menus = Array.from(document.querySelectorAll('[role="menu"], [class*="ActionMenu"], [class*="Overlay"]')).filter(m => window.getComputedStyle(m).display !== 'none');
          return {
            openPortalsCount: openPortals.length,
            openDialogsCount: dialogs.length,
            openMenusCount: menus.length,
            visibleItems: Array.from(document.querySelectorAll('li, a, button')).filter(el => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
            }).length
          };
        });

        console.log(`    Active state DOM verification:`, cloneOpenedInfo);

        // Capture full screen click state (dialogs and dropdowns extend below header)
        const cloneClickBuf = await cloneTestPage.screenshot({ clip: { x: 0, y: 0, width: vp.width, height: Math.min(vp.height, 600) } });
        const liveClickBuf = await liveTestPage.screenshot({ clip: { x: 0, y: 0, width: vp.width, height: Math.min(vp.height, 600) } });

        const clickDiffPath = path.join(PROOFS_DIR, `${vp.name}_click_${target.id}_diff.png`);
        fs.writeFileSync(path.join(PROOFS_DIR, `${vp.name}_click_${target.id}_clone.png`), cloneClickBuf);
        fs.writeFileSync(path.join(PROOFS_DIR, `${vp.name}_click_${target.id}_live.png`), liveClickBuf);

        const clickScore = computeStrictPixelmatch(liveClickBuf, cloneClickBuf, clickDiffPath);
        console.log(`    🎉 Click/Toggled State Match: ${clickScore.score}%`);
        results.push({ viewport: vp.name, state: `click_${target.id}`, score: clickScore.score, errors: clonePageErrors.length });

        // Close / Click outside
        await cloneTestPage.mouse.click(vp.width - 20, vp.height - 20).catch(() => {});
        await cloneTestPage.waitForTimeout(200);
        if (liveTrigger) {
          await liveTestPage.mouse.click(vp.width - 20, vp.height - 20).catch(() => {});
          await liveTestPage.waitForTimeout(200);
        }
      } catch (err) {
        console.warn(`    Click probe notice: ${err.message}`);
      }
    }

    console.log(`\n  Total uncaught runtime page errors on ${vp.name.toUpperCase()}: ${clonePageErrors.length}`);
    await cloneTestPage.close();
    await liveTestPage.close();
  }

  server.close();
  await liveCtx.close();
  await browser.close();

  // Summary Report
  console.log('\n======================================================================');
  console.log('📊 FINAL COMPREHENSIVE GITHUB MATRIX AUDIT REPORT');
  console.log('======================================================================');
  console.table(results);

  const reportPath = path.join(PROOFS_DIR, 'matrix_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`Audit saved to ${reportPath}`);
}

runComprehensiveMatrix().catch(e => {
  console.error('Matrix execution failed:', e);
  process.exit(1);
});
