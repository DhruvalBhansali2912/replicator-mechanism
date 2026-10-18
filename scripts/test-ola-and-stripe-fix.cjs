const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');
const { PNG } = require('pngjs');
const cheerio = require('cheerio');
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
    origWidth: png1.width,
    origHeight: png1.height,
    synthWidth: png2.width,
    synthHeight: png2.height,
    diffPixels,
    totalPixels,
    matchPercentage: parseFloat(matchPercentage.toFixed(2))
  };
}

async function run() {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const engine = new GroundUpSynthesisEngine();
  const summary = [];

  // ==========================================
  // SITE 1: OLA ELECTRIC (Authentic Header + Hero)
  // ==========================================
  console.log('\n--- Testing 1: Ola Electric ---');
  try {
    const jobDir = path.resolve('storage/jobs/job_392c8592171a4a9b');
    const jobMeta = JSON.parse(fs.readFileSync(path.join(jobDir, 'job.json'), 'utf8'));
    const $snap = cheerio.load(jobMeta.options.htmlSnapshot);
    const snapHeader = $snap('header.page-header, header, [role="banner"]').first();
    const snapHero = $snap('[class*="home_banner_slider"], [class*="slider"], div.s6uaags-s').first();
    const combinedHtml = ($snap.html(snapHeader) || '') + '\n' + ($snap.html(snapHero) || '');
    const rawCss = fs.readFileSync(path.join(jobDir, 'reconstruction.css'), 'utf8');

    const synth = engine.synthesizeSection(
      combinedHtml,
      'https://www.olaelectric.com/',
      rawCss,
      'header, [class*="home_banner_slider"]',
      undefined,
      jobMeta.options.htmlSnapshot
    );

    const hasImportant = synth.css.includes('!important');

    const previewContext = await browser.newContext({ viewport: { width: 1440, height: 750 } });
    const previewPage = await previewContext.newPage();
    const previewHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*, *::before, *::after { box-sizing: border-box; } body { margin: 0; padding: 0; background: #000; color: #fff; overflow-x: hidden; } ${synth.css}</style></head><body>${synth.html}<script>${synth.js}</script></body></html>`;
    await previewPage.setContent(previewHtml, { timeout: 10000 }).catch(() => {});
    await previewPage.waitForTimeout(1500);

    const synthPath = path.join(ARTIFACTS_DIR, 'site_1_ola_synthesized.png');
    await previewPage.screenshot({ path: synthPath, clip: { x: 0, y: 0, width: 1440, height: 750 } });

    // Baseline render of original snapshot without stalling external scripts
    const origPage = await previewContext.newPage();
    const cleanSnapshot = jobMeta.options.htmlSnapshot.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    await origPage.setContent(cleanSnapshot, { timeout: 10000 }).catch(() => {});
    await origPage.waitForTimeout(1500);
    const origPath = path.join(ARTIFACTS_DIR, 'site_1_ola_original.png');
    await origPage.screenshot({ path: origPath, clip: { x: 0, y: 0, width: 1440, height: 750 } });

    const diffPath = path.join(ARTIFACTS_DIR, 'site_1_ola_diff.png');
    const comp = compareImages(fs.readFileSync(origPath), fs.readFileSync(synthPath), diffPath);

    console.log(`Ola Electric: Pixel Match = ${comp.matchPercentage}%, Zero !important: ${!hasImportant}`);
    summary.push({ site: 'Ola Electric', match: `${comp.matchPercentage}%`, zeroImportant: !hasImportant ? 'YES' : 'NO' });

    await previewPage.close();
    await origPage.close();
    await previewContext.close();
  } catch (err) {
    console.error('Ola Error:', err.message);
  }

  // ==========================================
  // SITE 2: GITHUB (Top Hero & Navigation Viewport)
  // ==========================================
  console.log('\n--- Testing 2: GitHub ---');
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('https://github.com', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const origPath = path.join(ARTIFACTS_DIR, 'site_4_github_original.png');
    await page.screenshot({ path: origPath, clip: { x: 0, y: 0, width: 1440, height: 900 } });

    const bodyHtml = await page.evaluate(() => document.body.innerHTML);
    const pageCss = await page.evaluate(() => {
      const rules = [];
      for (const s of Array.from(document.styleSheets)) {
        try {
          for (const r of Array.from(s.cssRules || [])) rules.push(r.cssText);
        } catch {}
      }
      return rules.join('\n');
    });

    const synth = engine.synthesizeSection(
      bodyHtml,
      'https://github.com',
      pageCss,
      'body',
      undefined,
      await page.content()
    );

    const hasImportant = synth.css.includes('!important');

    const previewPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const previewHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*, *::before, *::after { box-sizing: border-box; } body { margin: 0; padding: 0; overflow-x: hidden; } ${synth.css}</style></head><body>${synth.html}<script>${synth.js}</script></body></html>`;
    await previewPage.setContent(previewHtml, { timeout: 10000 }).catch(() => {});
    await previewPage.waitForTimeout(1500);

    const synthPath = path.join(ARTIFACTS_DIR, 'site_4_github_synthesized.png');
    await previewPage.screenshot({ path: synthPath, clip: { x: 0, y: 0, width: 1440, height: 900 } });

    const diffPath = path.join(ARTIFACTS_DIR, 'site_4_github_diff.png');
    const comp = compareImages(fs.readFileSync(origPath), fs.readFileSync(synthPath), diffPath);

    console.log(`GitHub: Pixel Match = ${comp.matchPercentage}%, Zero !important: ${!hasImportant}`);
    summary.push({ site: 'GitHub', match: `${comp.matchPercentage}%`, zeroImportant: !hasImportant ? 'YES' : 'NO' });

    await page.close();
    await previewPage.close();
  } catch (err) {
    console.error('GitHub Error:', err.message);
  }

  // ==========================================
  // SITE 3: RESEND (Modern Developer Platform Header)
  // ==========================================
  console.log('\n--- Testing 3: Resend ---');
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('https://resend.com', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const origPath = path.join(ARTIFACTS_DIR, 'site_5_resend_original.png');
    const headerEl = await page.$('header');
    if (headerEl) {
      await headerEl.screenshot({ path: origPath });
    } else {
      await page.screenshot({ path: origPath, clip: { x: 0, y: 0, width: 1440, height: 60 } });
    }

    const headerHtml = await page.evaluate(() => document.querySelector('header').outerHTML);
    const pageCss = await page.evaluate(() => {
      const rules = [];
      for (const s of Array.from(document.styleSheets)) {
        try {
          for (const r of Array.from(s.cssRules || [])) rules.push(r.cssText);
        } catch {}
      }
      return rules.join('\n');
    });

    const synth = engine.synthesizeSection(
      headerHtml,
      'https://resend.com',
      pageCss,
      'header',
      undefined,
      await page.content()
    );

    const hasImportant = synth.css.includes('!important');

    const previewPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const previewHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*, *::before, *::after { box-sizing: border-box; } body { margin: 0; padding: 0; background: #000; color: #fff; overflow-x: hidden; } ${synth.css}</style></head><body>${synth.html}<script>${synth.js}</script></body></html>`;
    await previewPage.setContent(previewHtml, { timeout: 10000 }).catch(() => {});
    await previewPage.waitForTimeout(1500);

    const synthPath = path.join(ARTIFACTS_DIR, 'site_5_resend_synthesized.png');
    const synthEl = await previewPage.$('header') || await previewPage.$('body');
    await synthEl.screenshot({ path: synthPath });

    const diffPath = path.join(ARTIFACTS_DIR, 'site_5_resend_diff.png');
    const comp = compareImages(fs.readFileSync(origPath), fs.readFileSync(synthPath), diffPath);

    console.log(`Resend: Pixel Match = ${comp.matchPercentage}%, Zero !important: ${!hasImportant}`);
    summary.push({ site: 'Resend', match: `${comp.matchPercentage}%`, zeroImportant: !hasImportant ? 'YES' : 'NO' });

    await page.close();
    await previewPage.close();
  } catch (err) {
    console.error('Resend Error:', err.message);
  }

  // ==========================================
  // SITE 4: LINEAR (Modern Dark Mode Header)
  // ==========================================
  console.log('\n--- Testing 4: Linear ---');
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('https://linear.app', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const externalCss = await page.evaluate(async () => {
      const hrefs = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href);
      const texts = await Promise.all(hrefs.map(async h => {
        try {
          const r = await fetch(h);
          if (r.ok) return await r.text();
        } catch {}
        return '';
      }));
      const rules = [];
      for (const s of Array.from(document.styleSheets)) {
        try {
          for (const r of Array.from(s.cssRules || [])) rules.push(r.cssText);
        } catch {}
      }
      return texts.join('\n') + '\n' + rules.join('\n');
    });

    const origPath = path.join(ARTIFACTS_DIR, 'site_3_linear_original.png');
    const headerEl = await page.$('header');
    if (headerEl) {
      await headerEl.screenshot({ path: origPath });
    } else {
      await page.screenshot({ path: origPath, clip: { x: 0, y: 0, width: 1440, height: 75 } });
    }

    const headerHtml = await page.evaluate(() => document.querySelector('header').outerHTML);

    const synth = engine.synthesizeSection(
      headerHtml,
      'https://linear.app',
      externalCss,
      'header',
      undefined,
      await page.content()
    );

    const hasImportant = synth.css.includes('!important');

    const previewPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const previewHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*, *::before, *::after { box-sizing: border-box; } body { margin: 0; padding: 0; background: #08090a; color: #fff; overflow-x: hidden; } ${synth.css}</style></head><body>${synth.html}<script>${synth.js}</script></body></html>`;
    await previewPage.setContent(previewHtml, { timeout: 10000 }).catch(() => {});
    await previewPage.waitForTimeout(1500);

    const synthPath = path.join(ARTIFACTS_DIR, 'site_3_linear_synthesized.png');
    const synthEl = await previewPage.$('header') || await previewPage.$('body');
    await synthEl.screenshot({ path: synthPath });

    const diffPath = path.join(ARTIFACTS_DIR, 'site_3_linear_diff.png');
    const comp = compareImages(fs.readFileSync(origPath), fs.readFileSync(synthPath), diffPath);

    console.log(`Linear: Pixel Match = ${comp.matchPercentage}%, Zero !important: ${!hasImportant}`);
    summary.push({ site: 'Linear', match: `${comp.matchPercentage}%`, zeroImportant: !hasImportant ? 'YES' : 'NO' });

    await page.close();
    await previewPage.close();
  } catch (err) {
    console.error('Linear Error:', err.message);
  }

  // ==========================================
  // SITE 5: SUPABASE (Modern Developer Tool Hero)
  // ==========================================
  console.log('\n--- Testing 5: Supabase ---');
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('https://supabase.com', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const origPath = path.join(ARTIFACTS_DIR, 'site_5_supabase_original.png');
    const navEl = await page.$('nav, header');
    if (navEl) {
      await navEl.screenshot({ path: origPath });
    } else {
      await page.screenshot({ path: origPath, clip: { x: 0, y: 0, width: 1440, height: 70 } });
    }

    const navHtml = await page.evaluate(() => {
      const el = document.querySelector('nav, header');
      return el ? el.outerHTML : '';
    });

    const pageCss = await page.evaluate(async () => {
      const hrefs = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href);
      const texts = await Promise.all(hrefs.map(async h => {
        try {
          const r = await fetch(h);
          if (r.ok) return await r.text();
        } catch {}
        return '';
      }));
      const rules = [];
      for (const s of Array.from(document.styleSheets)) {
        try {
          for (const r of Array.from(s.cssRules || [])) rules.push(r.cssText);
        } catch {}
      }
      return texts.join('\n') + '\n' + rules.join('\n');
    });

    const synth = engine.synthesizeSection(
      navHtml,
      'https://supabase.com',
      pageCss,
      'nav',
      undefined,
      await page.content()
    );

    const hasImportant = synth.css.includes('!important');

    const previewPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const previewHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*, *::before, *::after { box-sizing: border-box; } body { margin: 0; padding: 0; background: #1c1c1c; color: #ededed; overflow-x: hidden; } ${synth.css}</style></head><body>${synth.html}<script>${synth.js}</script></body></html>`;
    await previewPage.setContent(previewHtml, { timeout: 10000 }).catch(() => {});
    await previewPage.waitForTimeout(1500);

    const synthPath = path.join(ARTIFACTS_DIR, 'site_5_supabase_synthesized.png');
    const synthEl = await previewPage.$('nav, header') || await previewPage.$('body');
    await synthEl.screenshot({ path: synthPath });

    const diffPath = path.join(ARTIFACTS_DIR, 'site_5_supabase_diff.png');
    const comp = compareImages(fs.readFileSync(origPath), fs.readFileSync(synthPath), diffPath);

    console.log(`Supabase: Pixel Match = ${comp.matchPercentage}%, Zero !important: ${!hasImportant}`);
    summary.push({ site: 'Supabase', match: `${comp.matchPercentage}%`, zeroImportant: !hasImportant ? 'YES' : 'NO' });

    await page.close();
    await previewPage.close();
  } catch (err) {
    console.error('Supabase Error:', err.message);
  }

  await browser.close();

  console.log('\n====================================================');
  console.log('📊 FINAL 5-SITE ACCURACY BENCHMARK SUMMARY');
  console.log('====================================================');
  console.table(summary);

  const resultsPath = path.join(ARTIFACTS_DIR, 'benchmark_final_5_sites.json');
  fs.writeFileSync(resultsPath, JSON.stringify(summary, null, 2));
}

run().catch(console.error);
