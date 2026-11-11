const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { PNG } = require('pngjs');
const pm = require('pixelmatch');
const pixelmatch = pm.default || pm;
const cheerio = require('cheerio');

const { resolveTargetSectionFromSnapshot } = require('../dist/classifier/section-resolver.js');
const { synthesisEngine } = require('../dist/synthesis/engine.js');

const PROOFS_DIR = '/Users/dhanashreedhruval/.gemini/antigravity/brain/deb334e3-11a0-4c5a-9938-0d7f0b332688/proofs/github_matrix';
fs.mkdirSync(PROOFS_DIR, { recursive: true });

function fetchUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', () => resolve(''));
  });
}

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

async function runFullMatrixEvaluation() {
  console.log('======================================================================');
  console.log('🎯 AUTONOMOUS GOAL: 100% GITHUB HEADER REPLICATION MATRIX');
  console.log('Proving each and every hover, click, and screen size');
  console.log('======================================================================\n');

  // Fetch job metadata for authentic recorded interactions
  const jobMetaStr = await fetchUrl('https://replicator.inventkid.com/api/jobs/job_0e5c7a7eca1541ce');
  let recordedInteractions = [];
  try {
    const jobMeta = JSON.parse(jobMetaStr);
    recordedInteractions = jobMeta.options?.recordedInteractions || [];
  } catch {}
  console.log(`Loaded ${recordedInteractions.length} authentic recorded interactions from live job.`);

  const browser = await chromium.launch({ headless: true });
  const liveCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const livePage = await liveCtx.newPage();

  console.log('Navigating to live GitHub repository...');
  await livePage.goto('https://github.com/securecentricdev/secure-centric-website', { waitUntil: 'domcontentloaded', timeout: 35000 });
  await livePage.waitForTimeout(1500);

  const pageHtml = await livePage.content();
  const $snap = cheerio.load(pageHtml);

  // Harvest client stylesheets
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

  // Target the exact GitHub GlobalNav header
  const selector = 'header.GlobalNav';
  const resolvedCheerio = resolveTargetSectionFromSnapshot($snap, 'navbar', selector);
  const resolvedHtml = resolvedCheerio ? $snap.html(resolvedCheerio) : '';

  console.log('Synthesizing section with updated engine...');
  const synthResult = synthesisEngine.synthesizeSection(
    resolvedHtml,
    'https://github.com/securecentricdev/secure-centric-website',
    combinedCss,
    selector,
    'navbar',
    pageHtml,
    recordedInteractions,
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

  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const cloneUrl = `http://127.0.0.1:${port}/`;
  console.log(`Local Clone Server running at ${cloneUrl}\n`);

  const trials = [
    {
      name: 'Desktop (1440x900)',
      viewport: { width: 1440, height: 900 },
      prefix: 'desktop',
      targets: [
        { id: 'logo', name: 'Home / Logo', sel: 'a[href="https://github.com/"]' },
        { id: 'repo_name', name: 'Repo Name Breadcrumb', sel: 'a:has-text("secure-centric-website")' },
        { id: 'tab_code', name: 'Code Tab', sel: 'a:has-text("Code")' },
        { id: 'tab_issues', name: 'Issues Tab', sel: 'a:has-text("Issues")' },
        { id: 'tab_pulls', name: 'Pull requests Tab', sel: 'a:has-text("Pull requests")' },
        { id: 'tab_more', name: 'More Items Button', sel: 'button:has-text("More"), button[aria-label*="More"]' },
        { id: 'hamburger', name: 'Hamburger Menu', sel: 'button:has(svg.octicon-three-bars), button[aria-label="Toggle navigation"]' }
      ]
    },
    {
      name: 'Tablet (768x1024)',
      viewport: { width: 768, height: 1024 },
      prefix: 'tablet',
      targets: [
        { id: 'tab_code', name: 'Code Tab', sel: 'a:has-text("Code")' },
        { id: 'tab_more', name: 'More Overflow Button', sel: 'button:has-text("More"), button[aria-label*="More"]' },
        { id: 'hamburger', name: 'Hamburger Menu', sel: 'button:has(svg.octicon-three-bars), button[aria-label="Toggle navigation"]' }
      ]
    },
    {
      name: 'Mobile Pixel 9 (412x924)',
      viewport: { width: 412, height: 924 },
      prefix: 'mobile',
      targets: [
        { id: 'tab_code', name: 'Code Tab', sel: 'a:has-text("Code")' },
        { id: 'tab_issues', name: 'Issues Tab', sel: 'a:has-text("Issues")' },
        { id: 'tab_more', name: 'More Overflow Button', sel: 'button:has-text("More"), button[aria-label*="More"]' },
        { id: 'hamburger', name: 'Hamburger Menu', sel: 'button:has(svg.octicon-three-bars), button[aria-label="Toggle navigation"]' }
      ]
    }
  ];

  const report = [];

  for (const trial of trials) {
    console.log(`\n======================================================================`);
    console.log(`🎬 TRIAL: ${trial.name}`);
    console.log(`======================================================================`);

    const liveTestPage = await browser.newPage({ viewport: trial.viewport });
    await liveTestPage.goto('https://github.com/securecentricdev/secure-centric-website', { waitUntil: 'domcontentloaded' });
    await liveTestPage.waitForTimeout(1000);

    const cloneTestPage = await browser.newPage({ viewport: trial.viewport });
    const pageErrors = [];
    cloneTestPage.on('pageerror', (err) => {
      console.error(`  ❌ [${trial.prefix} PAGE_ERROR]`, err.message);
      pageErrors.push(err.message);
    });

    await cloneTestPage.goto(cloneUrl, { waitUntil: 'load' });
    await cloneTestPage.waitForTimeout(600);

    // Locate header element
    const liveHeader = await liveTestPage.$('header.GlobalNav, header').catch(() => null);
    const cloneHeader = await cloneTestPage.$('header.GlobalNav, header, body > div').catch(() => null);

    // Resting state comparison
    const liveRestingBuf = liveHeader ? await liveHeader.screenshot().catch(() => null) : await liveTestPage.screenshot({ clip: { x: 0, y: 0, width: trial.viewport.width, height: 160 } });
    const cloneRestingBuf = cloneHeader ? await cloneHeader.screenshot().catch(() => null) : await cloneTestPage.screenshot({ clip: { x: 0, y: 0, width: trial.viewport.width, height: 160 } });

    const restingDiffPath = path.join(PROOFS_DIR, `${trial.prefix}_resting_diff.png`);
    fs.writeFileSync(path.join(PROOFS_DIR, `${trial.prefix}_live_resting.png`), liveRestingBuf);
    fs.writeFileSync(path.join(PROOFS_DIR, `${trial.prefix}_clone_resting.png`), cloneRestingBuf);

    const restingScore = computeStrictPixelmatch(liveRestingBuf, cloneRestingBuf, restingDiffPath);
    console.log(`📸 [${trial.name}] Resting State Match: ${restingScore.score}%`);
    report.push({ trial: trial.name, action: 'Resting State', score: restingScore.score, errors: pageErrors.length });

    // Test each target
    for (const t of trial.targets) {
      const cloneEl = await cloneTestPage.$(t.sel).catch(() => null);
      const liveEl = await liveTestPage.$(t.sel).catch(() => null);

      if (!cloneEl) {
        console.log(`  ⚠️ Clone element not found for ${t.name} (${t.sel})`);
        continue;
      }

      // 1. Hover State
      await cloneEl.hover({ timeout: 1500 }).catch(() => {});
      await cloneTestPage.waitForTimeout(200);
      if (liveEl) {
        await liveEl.hover({ timeout: 1500 }).catch(() => {});
        await liveTestPage.waitForTimeout(200);
      }

      const liveHoverBuf = liveHeader ? await liveHeader.screenshot().catch(() => null) : await liveTestPage.screenshot({ clip: { x: 0, y: 0, width: trial.viewport.width, height: 160 } });
      const cloneHoverBuf = cloneHeader ? await cloneHeader.screenshot().catch(() => null) : await cloneTestPage.screenshot({ clip: { x: 0, y: 0, width: trial.viewport.width, height: 160 } });

      const hoverDiffPath = path.join(PROOFS_DIR, `${trial.prefix}_hover_${t.id}_diff.png`);
      fs.writeFileSync(path.join(PROOFS_DIR, `${trial.prefix}_hover_${t.id}_live.png`), liveHoverBuf);
      fs.writeFileSync(path.join(PROOFS_DIR, `${trial.prefix}_hover_${t.id}_clone.png`), cloneHoverBuf);

      const hoverScore = computeStrictPixelmatch(liveHoverBuf, cloneHoverBuf, hoverDiffPath);
      console.log(`  🎯 [Hover] ${t.name}: Match = ${hoverScore.score}%`);
      report.push({ trial: trial.name, action: `Hover ${t.name}`, score: hoverScore.score, errors: pageErrors.length });

      // 2. Click State
      await cloneEl.click({ timeout: 1500 }).catch(() => {});
      await cloneTestPage.waitForTimeout(400);
      if (liveEl) {
        await liveEl.click({ timeout: 1500 }).catch(() => {});
        await liveTestPage.waitForTimeout(400);
      }

      const liveClickBuf = await liveTestPage.screenshot({ clip: { x: 0, y: 0, width: trial.viewport.width, height: Math.min(trial.viewport.height, 600) } });
      const cloneClickBuf = await cloneTestPage.screenshot({ clip: { x: 0, y: 0, width: trial.viewport.width, height: Math.min(trial.viewport.height, 600) } });

      const clickDiffPath = path.join(PROOFS_DIR, `${trial.prefix}_click_${t.id}_diff.png`);
      fs.writeFileSync(path.join(PROOFS_DIR, `${trial.prefix}_click_${t.id}_live.png`), liveClickBuf);
      fs.writeFileSync(path.join(PROOFS_DIR, `${trial.prefix}_click_${t.id}_clone.png`), cloneClickBuf);

      const clickScore = computeStrictPixelmatch(liveClickBuf, cloneClickBuf, clickDiffPath);
      console.log(`  👉 [Click] ${t.name}: Match = ${clickScore.score}%`);
      report.push({ trial: trial.name, action: `Click ${t.name}`, score: clickScore.score, errors: pageErrors.length });

      // Dismiss / Close
      await cloneTestPage.mouse.click(trial.viewport.width - 15, trial.viewport.height - 15).catch(() => {});
      await cloneTestPage.waitForTimeout(150);
      if (liveEl) {
        await liveTestPage.mouse.click(trial.viewport.width - 15, trial.viewport.height - 15).catch(() => {});
        await liveTestPage.waitForTimeout(150);
      }
    }

    console.log(`  Total Uncaught Page Errors on ${trial.name}: ${pageErrors.length}`);
    await cloneTestPage.close();
    await liveTestPage.close();
  }

  server.close();
  await liveCtx.close();
  await browser.close();

  console.log('\n======================================================================');
  console.log('📊 FINAL COMPREHENSIVE GITHUB INTERACTION MATRIX REPORT');
  console.log('======================================================================');
  console.table(report);

  const reportPath = path.join(PROOFS_DIR, 'full_matrix_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report written to ${reportPath}`);
}

runFullMatrixEvaluation().catch(e => {
  console.error('Matrix run failed:', e);
  process.exit(1);
});
