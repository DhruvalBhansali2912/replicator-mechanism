const fs = require('fs');
const { chromium } = require('playwright');
const cheerio = require('cheerio');
const { GroundUpSynthesisEngine } = require('../dist/synthesis/engine.js');

async function fetchExternalCss(html, baseUrl) {
  const $ = cheerio.load(html);
  const hrefs = [];
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !href.startsWith('chrome-extension://')) {
      try {
        hrefs.push(new URL(href, baseUrl).href);
      } catch {}
    }
  });

  const inlineStyles = [];
  $('style').each((_, el) => {
    const t = $(el).html();
    if (t && t.trim()) inlineStyles.push(t.trim());
  });

  const fetched = await Promise.all(
    hrefs.map(async (u) => {
      try {
        const res = await fetch(u, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Referer': baseUrl
          }
        });
        if (res.ok) return await res.text();
      } catch {}
      return '';
    })
  );

  return [...inlineStyles, ...fetched].filter(Boolean).join('\n');
}

async function debugLinear() {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });

  await page.goto('https://linear.app', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(3000);

  const htmlSnapshot = await page.content();
  const headerHtml = await page.evaluate(() => document.querySelector('header')?.outerHTML);
  const headerBbox = await page.evaluate(() => {
    const el = document.querySelector('header');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return {
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      display: style.display,
      position: style.position,
      background: style.backgroundColor,
      color: style.color
    };
  });

  console.log('Original Header Info:', JSON.stringify(headerBbox, null, 2));

  const authenticCss = await fetchExternalCss(htmlSnapshot, 'https://linear.app');
  console.log('Authentic CSS size:', authenticCss.length);

  const engine = new GroundUpSynthesisEngine();
  const synth = engine.synthesizeSection(
    headerHtml,
    'https://linear.app',
    authenticCss,
    'header',
    undefined,
    htmlSnapshot
  );

  fs.writeFileSync('scratch/linear_synth_output.html', `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${synth.css}
</style>
</head>
<body>
${synth.html}
<script>${synth.js}</script>
</body>
</html>`);

  fs.writeFileSync('scratch/linear_synth.css', synth.css);
  console.log('Synthesized CSS length:', synth.css.length);
  console.log('Synthesized HTML length:', synth.html.length);

  // Now open the preview and check why it's white/empty
  const preview = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await preview.goto('file://' + path.resolve('scratch/linear_synth_output.html'), { waitUntil: 'domcontentloaded' });
  await preview.waitForTimeout(1000);

  const synthBbox = await preview.evaluate(() => {
    const h = document.querySelector('header');
    if (!h) return { found: false };
    const r = h.getBoundingClientRect();
    const s = window.getComputedStyle(h);
    const bodyStyle = window.getComputedStyle(document.body);
    const htmlStyle = window.getComputedStyle(document.documentElement);
    return {
      found: true,
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      headerDisplay: s.display,
      headerBg: s.backgroundColor,
      headerColor: s.color,
      headerOpacity: s.opacity,
      headerVisibility: s.visibility,
      bodyBg: bodyStyle.backgroundColor,
      htmlBg: htmlStyle.backgroundColor,
      innerHTMLSample: h.innerHTML.slice(0, 300)
    };
  });

  console.log('Preview Header Info:', JSON.stringify(synthBbox, null, 2));

  await preview.screenshot({ path: 'scratch/linear_full_preview.png' });
  const hEl = await preview.$('header');
  if (hEl) {
    await hEl.screenshot({ path: 'scratch/linear_header_preview.png' });
  }

  await browser.close();
}

const path = require('path');
debugLinear().catch(console.error);
