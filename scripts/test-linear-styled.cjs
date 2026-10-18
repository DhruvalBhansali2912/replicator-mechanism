const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const cheerio = require('cheerio');
const postcss = require('postcss');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');
const { PNG } = require('pngjs');
const { GroundUpSynthesisEngine } = require('../dist/synthesis/engine.js');

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
  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  return {
    width,
    height,
    diffPixels,
    totalPixels,
    matchPercentage: parseFloat(matchPercentage.toFixed(2))
  };
}

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

async function testLinear() {
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

  const origPath = path.join(ARTIFACTS_DIR, 'site_3_linear_original.png');
  const headerEl = await page.$('header');
  if (headerEl) {
    await headerEl.screenshot({ path: origPath });
  }

  const htmlSnapshot = await page.content();
  const headerHtml = await page.evaluate(() => document.querySelector('header')?.outerHTML);
  const authenticCss = await fetchExternalCss(htmlSnapshot, 'https://linear.app');

  const engine = new GroundUpSynthesisEngine();
  const synth = engine.synthesizeSection(
    headerHtml,
    'https://linear.app',
    authenticCss,
    'header',
    undefined,
    htmlSnapshot
  );

  // Now let's see: if authenticCss contains [data-theme=dark] with --header-bg,
  // let's verify if synth.css contains --header-bg:
  console.log('Does synth.css contain --header-bg?', synth.css.includes('--header-bg'));

  // Test preview
  const previewPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  // Set html data-theme="dark" and body dark background
  const previewHtml = `<!DOCTYPE html>
<html data-theme="dark" class="dark">
<head>
<meta charset="utf-8">
<style>
body {
  margin: 0;
  padding: 0;
  background-color: #08090a;
  color: #fff;
  overflow-x: hidden;
}
${synth.css}
</style>
</head>
<body data-theme="dark">
${synth.html}
<script>${synth.js}</script>
</body>
</html>`;

  await previewPage.setContent(previewHtml, { waitUntil: 'domcontentloaded' });
  await previewPage.waitForTimeout(2000);

  const synthPath = path.join(ARTIFACTS_DIR, 'site_3_linear_synthesized.png');
  const synthHeader = await previewPage.$('header') || await previewPage.$('body');
  await synthHeader.screenshot({ path: synthPath });

  const diffPath = path.join(ARTIFACTS_DIR, 'site_3_linear_diff.png');
  const comp = compareImages(fs.readFileSync(origPath), fs.readFileSync(synthPath), diffPath);

  console.log('Linear Match Percentage:', comp.matchPercentage, '%');
  console.log('Zero !important:', !synth.css.includes('!important'));

  await browser.close();
}

testLinear().catch(console.error);
