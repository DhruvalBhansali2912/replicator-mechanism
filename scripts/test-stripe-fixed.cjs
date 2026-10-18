const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const cheerio = require('cheerio');
const postcss = require('postcss');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');
const { PNG } = require('pngjs');

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

async function testFixedStripe() {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });

  await page.goto('https://stripe.com', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(3000);

  const origPath = path.join(ARTIFACTS_DIR, 'site_2_stripe_original.png');
  const headerEl = await page.$('header');
  if (headerEl) {
    await headerEl.screenshot({ path: origPath });
  }

  const htmlSnapshot = await page.content();
  const headerHtml = await page.evaluate(() => document.querySelector('header')?.outerHTML);

  const $ = cheerio.load(htmlSnapshot);
  const hrefs = [];
  $('link[rel="stylesheet"]').each((_, el) => {
    const h = $(el).attr('href');
    if (h) hrefs.push(new URL(h, 'https://stripe.com').href);
  });
  const cssParts = await Promise.all(hrefs.map(async (u) => (await fetch(u)).text()));
  const authenticCss = cssParts.join('\n');

  // Parse with PostCSS preserving custom property rules & theme rules:
  const root = postcss.parse(authenticCss);
  root.walkDecls((decl) => {
    if (decl.important) decl.important = false;
  });

  const $sec = cheerio.load(headerHtml);
  const sectionClasses = new Set();
  const sectionIds = new Set();
  $sec('*').each((_, el) => {
    const c = $sec(el).attr('class');
    if (c) c.split(/\s+/).forEach((cls) => { if (cls.trim()) sectionClasses.add(cls.trim()); });
    const id = $sec(el).attr('id');
    if (id) sectionIds.add(id.trim());
  });

  root.walkRules((rule) => {
    if (rule.parent && rule.parent.type === 'atrule' && rule.parent.name.includes('keyframes')) return;
    
    const hasCustomProps = rule.nodes && rule.nodes.some(n => n.type === 'decl' && n.prop.startsWith('--'));
    const selectors = rule.selectors || [rule.selector];
    const matching = [];

    for (const s of selectors) {
      if (
        s === '*' ||
        s === ':root' ||
        s === 'html' ||
        s === 'body' ||
        s.startsWith(':root') ||
        s.startsWith('@') ||
        s.includes('[data-theme') ||
        s.includes('.dark') ||
        s.includes('.light') ||
        (hasCustomProps && (s.startsWith(':') || s.startsWith('[') || s.startsWith('.')))
      ) {
        matching.push(s);
        continue;
      }

      const clean = s.replace(/::?(hover|focus|active|visited|before|after|placeholder|first-child|last-child)[^,\s>+~]*/g, '').trim();
      if (!clean) {
        matching.push(s);
        continue;
      }

      try {
        if ($sec(clean).length > 0) {
          matching.push(s);
          continue;
        }
      } catch {}

      const parts = clean.split(/\s*[\s>+~]\s*/).filter(Boolean);
      if (parts.length > 1) {
        let matchedDescendant = false;
        for (let i = 1; i < parts.length; i++) {
          const sub = parts.slice(i).join(' ');
          try {
            if ($sec(sub).length > 0) {
              matching.push(s);
              matchedDescendant = true;
              break;
            }
          } catch {}
        }
        if (matchedDescendant) continue;
      }

      let referencesSection = false;
      for (const cls of sectionClasses) {
        if (clean.includes('.' + cls)) {
          referencesSection = true;
          break;
        }
      }
      if (!referencesSection) {
        for (const id of sectionIds) {
          if (clean.includes('#' + id)) {
            referencesSection = true;
            break;
          }
        }
      }
      if (referencesSection) {
        matching.push(s);
      }
    }

    if (matching.length === 0) {
      rule.remove();
    } else {
      rule.selectors = matching;
    }
  });

  const scopedCss = root.toString();

  // Test preview
  const preview = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const previewHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
*, *::before, *::after { box-sizing: border-box; }
body {
  margin: 0;
  padding: 0;
  overflow-x: hidden;
}
${scopedCss}
</style>
</head>
<body>
${headerHtml}
</body>
</html>`;

  await preview.setContent(previewHtml, { waitUntil: 'domcontentloaded' });
  await preview.waitForTimeout(2000);

  const synthPath = path.join(ARTIFACTS_DIR, 'site_2_stripe_synthesized.png');
  const hEl = await preview.$('header');
  await hEl.screenshot({ path: synthPath });

  const diffPath = path.join(ARTIFACTS_DIR, 'site_2_stripe_diff.png');
  const comp = compareImages(fs.readFileSync(origPath), fs.readFileSync(synthPath), diffPath);

  console.log('Fixed Stripe Pixel Match Percentage:', comp.matchPercentage, '%');

  // Also check what the links look like in preview:
  const previewLinks = await preview.evaluate(() => {
    const h = document.querySelector('header');
    return Array.from(h.querySelectorAll('a, button')).map(el => ({
      text: el.innerText.trim(),
      color: window.getComputedStyle(el).color,
      bg: window.getComputedStyle(el).backgroundColor
    }));
  });
  console.log('Preview Links Sample:', JSON.stringify(previewLinks.slice(0, 7), null, 2));

  await browser.close();
}

testFixedStripe().catch(console.error);
