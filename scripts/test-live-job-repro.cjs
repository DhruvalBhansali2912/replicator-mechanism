const { chromium } = require('playwright');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { JsSynthesizer } = require('../dist/synthesis/js-synthesizer.js');
const jsSynthesizer = new JsSynthesizer();

const PROOFS_DIR = '/Users/dhanashreedhruval/.gemini/antigravity/brain/deb334e3-11a0-4c5a-9938-0d7f0b332688/proofs/live_job_repro';
fs.mkdirSync(PROOFS_DIR, { recursive: true });

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function testLiveJobRepro() {
  console.log('1. Fetching live job_0e5c7a7eca1541ce HTML and metadata...');
  const html = await fetchUrl('https://replicator.inventkid.com/api/jobs/job_0e5c7a7eca1541ce/preview/index.html');
  const jobMeta = JSON.parse(await fetchUrl('https://replicator.inventkid.com/api/jobs/job_0e5c7a7eca1541ce'));
  const recordedInteractions = jobMeta.options?.recordedInteractions || [];
  console.log(`Job has ${recordedInteractions.length} recorded interactions.`);

  // Synthesize fresh JS using our fixed synthesizer
  console.log('2. Synthesizing fresh JS with our fixed synthesizer...');
  const freshJs = jsSynthesizer.synthesize(html, 'https://github.com/securecentricdev/secure-centric-website', recordedInteractions);

  // Serve fresh page locally
  const $ = cheerio.load(html);
  $('script[src*="script.js"]').remove();
  const modifiedHtml = $.html();

  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
${modifiedHtml}
<script>
${freshJs}
</script>`);
  });

  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const localUrl = `http://127.0.0.1:${port}/`;
  console.log('Local test server at', localUrl);

  const browser = await chromium.launch({ headless: true });
  // Viewport: Pixel 9 (412x924)
  const page = await browser.newPage({ viewport: { width: 412, height: 924 } });

  const pageErrors = [];
  page.on('pageerror', err => {
    console.error('❌ [PAGE ERROR]:', err.message);
    pageErrors.push(err.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') console.error('❌ [CONSOLE ERROR]:', msg.text());
  });

  await page.goto(localUrl, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  // Screenshot resting
  await page.screenshot({ path: path.join(PROOFS_DIR, '01_resting_mobile.png'), fullPage: true });
  console.log('📸 Resting screenshot captured.');

  // Find hamburger button: button with octicon-three-bars
  const hamburger = await page.$('button:has(svg.octicon-three-bars), button[aria-label="Toggle navigation"]');
  console.log('Hamburger found?', !!hamburger);

  if (hamburger) {
    console.log('Hovering hamburger...');
    await hamburger.hover();
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(PROOFS_DIR, '02_hamburger_hover.png'), fullPage: true });

    console.log('Clicking hamburger...');
    await hamburger.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(PROOFS_DIR, '03_hamburger_clicked_open.png'), fullPage: true });

    const openState = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"], [data-component="Dialog"], [class*="Dialog"]');
      const portals = Array.from(document.querySelectorAll('[data-interactive-portal]'));
      return {
        dialog: dialog ? {
          display: window.getComputedStyle(dialog).display,
          visibility: window.getComputedStyle(dialog).visibility,
          opacity: window.getComputedStyle(dialog).opacity,
          rect: dialog.getBoundingClientRect(),
          text: dialog.textContent.slice(0, 100)
        } : null,
        portals: portals.map(p => ({
          display: window.getComputedStyle(p).display,
          visibility: window.getComputedStyle(p).visibility,
          opacity: window.getComputedStyle(p).opacity,
          state: p.getAttribute('data-state'),
          rect: p.getBoundingClientRect()
        }))
      };
    });
    console.log('Open state after hamburger click:', JSON.stringify(openState, null, 2));

    // Now test close (clicking close button inside dialog)
    const closeBtn = await page.$('button:has(svg.octicon-x), button[aria-label*="Close" i]');
    console.log('Close button found inside dialog?', !!closeBtn);
    if (closeBtn) {
      console.log('Clicking close button...');
      await closeBtn.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(PROOFS_DIR, '04_hamburger_closed.png'), fullPage: true });
    }
  }

  // Find More dropdown button
  const moreBtn = await page.$('button:has-text("More"), [data-component="overflow-menu-button"]');
  console.log('\nMore button found?', !!moreBtn);
  if (moreBtn) {
    console.log('Clicking More button...');
    await moreBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(PROOFS_DIR, '05_more_clicked_open.png'), fullPage: true });

    const moreState = await page.evaluate(() => {
      const menus = Array.from(document.querySelectorAll('[role="menu"], [class*="ActionList"], [class*="AnchoredOverlay"], [data-interactive-portal]'));
      return menus.map(m => ({
        tag: m.tagName,
        class: m.className.slice(0, 40),
        display: window.getComputedStyle(m).display,
        visibility: window.getComputedStyle(m).visibility,
        opacity: window.getComputedStyle(m).opacity,
        rect: m.getBoundingClientRect(),
        items: Array.from(m.querySelectorAll('li, a, button')).map(i => i.textContent.trim()).filter(Boolean)
      }));
    });
    console.log('More state after click:', JSON.stringify(moreState, null, 2));
  }

  server.close();
  await browser.close();
  console.log(`\nTotal page errors: ${pageErrors.length}`);
}

testLiveJobRepro().catch(err => {
  console.error('Test crashed:', err);
  process.exit(1);
});
