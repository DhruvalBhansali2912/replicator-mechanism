const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');
const { PNG } = require('pngjs');
const cheerio = require('cheerio');
const { GroundUpSynthesisEngine } = require('../dist/synthesis/engine.js');

const ARTIFACTS_DIR = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84';

const TEST_SITES = [
  {
    id: 'site_1_ola',
    name: 'Ola Electric',
    url: 'https://www.olaelectric.com',
    targetSelector: 'header.page-header, header, [role="banner"], [class*="header"]',
    fallbackJobDir: 'storage/jobs/job_392c8592171a4a9b'
  },
  {
    id: 'site_2_stripe',
    name: 'Stripe',
    url: 'https://stripe.com',
    targetSelector: 'header, section:first-of-type, [class*="Hero"], [class*="hero"]'
  },
  {
    id: 'site_3_linear',
    name: 'Linear',
    url: 'https://linear.app',
    targetSelector: 'header, [class*="hero"], main > div:first-child, section:first-of-type'
  },
  {
    id: 'site_4_github',
    name: 'GitHub',
    url: 'https://github.com',
    targetSelector: 'header, [class*="header"], [class*="Header"]'
  },
  {
    id: 'site_5_resend',
    name: 'Resend',
    url: 'https://resend.com',
    targetSelector: 'header, [class*="hero"], main section:first-of-type'
  }
];

function compareImages(img1Buf, img2Buf, diffPath) {
  try {
    const png1 = PNG.sync.read(img1Buf);
    const png2 = PNG.sync.read(img2Buf);

    const width = Math.max(png1.width, png2.width);
    const height = Math.max(png1.height, png2.height);

    const norm1 = new PNG({ width, height });
    const norm2 = new PNG({ width, height });

    // Fill white
    norm1.data.fill(255);
    norm2.data.fill(255);

    // Blit png1
    PNG.bitblt(png1, norm1, 0, 0, png1.width, png1.height, 0, 0);
    // Blit png2
    PNG.bitblt(png2, norm2, 0, 0, png2.width, png2.height, 0, 0);

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
  } catch (err) {
    return {
      error: err.message,
      matchPercentage: 0
    };
  }
}

async function runTest() {
  console.log('====================================================');
  console.log('🚀 Starting Universal 5-Site Extraction & Fidelity Benchmark');
  console.log('====================================================');

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

  const results = [];

  for (let i = 0; i < TEST_SITES.length; i++) {
    const site = TEST_SITES[i];
    console.log(`\n----------------------------------------------------`);
    console.log(`📍 [Site ${i + 1}/5] Testing ${site.name} (${site.url})...`);
    console.log(`----------------------------------------------------`);

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    try {
      let sectionHtml = '';
      let authenticCss = '';
      let htmlSnapshot = '';
      let sectionRect = { width: 1440, height: 70 };
      let sectionTag = 'header';

      // 1. Try Live Navigation
      let liveSuccess = false;
      try {
        console.log(`⏳ Navigating live to ${site.url}...`);
        await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.waitForTimeout(3000);

        const found = await page.evaluate((targetSel) => {
          const candidates = Array.from(document.querySelectorAll(targetSel));
          const valid = candidates.find(el => {
            const r = el.getBoundingClientRect();
            const s = window.getComputedStyle(el);
            return r.width >= 300 && r.height >= 30 && s.display !== 'none' && s.visibility !== 'hidden';
          });
          if (!valid) return null;

          valid.setAttribute('data-test-target', 'true');
          const rect = valid.getBoundingClientRect();
          return {
            tagName: valid.tagName.toLowerCase(),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            outerHTML: valid.outerHTML,
            clipRect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
          };
        }, site.targetSelector);

        if (found) {
          sectionTag = found.tagName;
          sectionHtml = found.outerHTML;
          sectionRect = found.clipRect;
          htmlSnapshot = await page.content();
          authenticCss = await page.evaluate(() => {
            const rules = [];
            for (const sheet of Array.from(document.styleSheets)) {
              try {
                if (sheet.media && sheet.media.mediaText.toLowerCase().includes('print')) continue;
                for (const r of Array.from(sheet.cssRules || [])) {
                  rules.push(r.cssText);
                }
              } catch {}
            }
            return rules.join('\n');
          });

          // Capture original screenshot
          const originalPath = path.join(ARTIFACTS_DIR, `${site.id}_original.png`);
          const targetEl = await page.$('[data-test-target="true"]');
          if (targetEl) {
            await targetEl.screenshot({ path: originalPath });
          } else {
            await page.screenshot({ path: originalPath, clip: { x: 0, y: 0, width: 1440, height: Math.min(sectionRect.height, 900) } });
          }
          console.log(`📸 Original screenshot saved to: ${originalPath}`);
          liveSuccess = true;
        }
      } catch (liveErr) {
        console.warn(`⚠️ Live navigation failed/timed out: ${liveErr.message}`);
      }

      // If live navigation failed but we have a fallback job (e.g. for Ola Electric)
      if (!liveSuccess && site.fallbackJobDir && fs.existsSync(site.fallbackJobDir)) {
        console.log(`🔄 Using authentic stored snapshot from ${site.fallbackJobDir}...`);
        const jobMeta = JSON.parse(fs.readFileSync(path.join(site.fallbackJobDir, 'job.json'), 'utf8'));
        htmlSnapshot = jobMeta.options.htmlSnapshot;
        authenticCss = fs.readFileSync(path.join(site.fallbackJobDir, 'reconstruction.css'), 'utf8');

        const $snap = cheerio.load(htmlSnapshot);
        const headerEl = $snap(site.targetSelector).first();
        if (headerEl.length > 0) {
          sectionHtml = $snap.html(headerEl);
          sectionTag = headerEl.prop('tagName').toLowerCase();
        }

        // Render baseline to take original screenshot
        await page.setContent(htmlSnapshot, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        const originalPath = path.join(ARTIFACTS_DIR, `${site.id}_original.png`);
        const targetHandle = await page.$(site.targetSelector);
        if (targetHandle) {
          await targetHandle.screenshot({ path: originalPath }).catch(async () => {
            await page.screenshot({ path: originalPath, clip: { x: 0, y: 0, width: 1440, height: 100 } });
          });
        } else {
          await page.screenshot({ path: originalPath, clip: { x: 0, y: 0, width: 1440, height: 100 } });
        }
        console.log(`📸 Original screenshot saved to: ${originalPath}`);
        liveSuccess = true;
      }

      if (!liveSuccess || !sectionHtml) {
        console.warn(`❌ Could not acquire section for ${site.name}`);
        results.push({
          site: site.name,
          url: site.url,
          status: 'SKIPPED',
          reason: 'Section not acquired'
        });
        await page.close();
        await context.close();
        continue;
      }

      console.log(`📦 Extracted CSS: ${authenticCss.length} bytes for <${sectionTag}>`);

      // 2. Synthesize Section via GroundUpSynthesisEngine (Clean, Zero !important, Zero hardcoding)
      const engine = new GroundUpSynthesisEngine();
      const synthesized = engine.synthesizeSection(
        sectionHtml,
        site.url,
        authenticCss,
        site.targetSelector,
        undefined,
        htmlSnapshot
      );

      console.log(`⚙️ Synthesized Section: HTML: ${synthesized.html.length}b, CSS: ${synthesized.css.length}b, JS: ${synthesized.js.length}b`);

      // Verify zero !important in output CSS
      const hasImportant = synthesized.css.includes('!important');
      if (hasImportant) {
        console.error(`🚨 ALERT: Synthesized CSS contains !important!`);
      } else {
        console.log(`✨ Zero !important verified in synthesized stylesheet.`);
      }

      // 3. Render Synthesized Section in Isolated Environment
      const previewHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${site.name} Preview</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow-x: hidden; }
    ${synthesized.css}
  </style>
</head>
<body>
  ${synthesized.html}
  <script>
    ${synthesized.js}
  </script>
</body>
</html>
      `.trim();

      const previewContext = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1
      });
      const previewPage = await previewContext.newPage();
      await previewPage.setContent(previewHtml, { waitUntil: 'domcontentloaded' });
      await previewPage.waitForTimeout(2000);

      // 4. Capture SYNTHESIZED screenshot using robust bounding box or clip
      const synthPath = path.join(ARTIFACTS_DIR, `${site.id}_synthesized.png`);
      const synthBox = await previewPage.evaluate(() => {
        const root = document.querySelector('header, nav, section, [class*="section"], [class*="authentic-section"]') || document.body.firstElementChild || document.body;
        const r = root.getBoundingClientRect();
        return {
          width: Math.max(300, Math.round(r.width || window.innerWidth)),
          height: Math.max(30, Math.round(r.height || 70))
        };
      });

      const clipH = Math.min(synthBox.height, 1200);
      await previewPage.screenshot({
        path: synthPath,
        clip: { x: 0, y: 0, width: 1440, height: clipH }
      });
      console.log(`📸 Synthesized screenshot saved to: ${synthPath}`);

      // 5. Compare Visual & Structural Metrics
      const originalPath = path.join(ARTIFACTS_DIR, `${site.id}_original.png`);
      const origBuf = fs.readFileSync(originalPath);
      const synthBuf = fs.readFileSync(synthPath);
      const diffPath = path.join(ARTIFACTS_DIR, `${site.id}_diff.png`);

      const comparison = compareImages(origBuf, synthBuf, diffPath);

      const synthMetrics = await previewPage.evaluate(() => {
        return {
          text: document.body.innerText ? document.body.innerText.trim().slice(0, 300) : '',
          elementCount: document.querySelectorAll('*').length,
          imageCount: document.querySelectorAll('img, picture, svg').length,
          linkCount: document.querySelectorAll('a').length
        };
      });

      console.log(`📊 Fidelity Comparison:`);
      console.log(`   - Pixel Match: ${comparison.matchPercentage}%`);
      console.log(`   - Dimensions: Original (${comparison.origWidth}x${comparison.origHeight}px) vs Synth (${comparison.synthWidth}x${comparison.synthHeight}px)`);
      console.log(`   - Zero !important: ${!hasImportant ? 'YES' : 'NO'}`);
      console.log(`   - Diff image: ${diffPath}`);

      results.push({
        site: site.name,
        url: site.url,
        tagName: sectionTag,
        originalDimensions: `${comparison.origWidth}x${comparison.origHeight}`,
        synthDimensions: `${comparison.synthWidth}x${comparison.synthHeight}`,
        pixelMatch: comparison.matchPercentage,
        elements: synthMetrics.elementCount,
        images: synthMetrics.imageCount,
        links: synthMetrics.linkCount,
        zeroImportant: !hasImportant,
        originalScreenshot: originalPath,
        synthesizedScreenshot: synthPath,
        diffScreenshot: diffPath
      });

      await previewPage.close();
      await previewContext.close();

    } catch (err) {
      console.error(`❌ Error testing ${site.name}:`, err.message);
      results.push({
        site: site.name,
        url: site.url,
        status: 'FAILED',
        error: err.message
      });
    } finally {
      await page.close();
      await context.close();
    }
  }

  await browser.close();

  console.log('\n====================================================');
  console.log('📋 FINAL BENCHMARK SUMMARY FOR 5 WEBSITES');
  console.log('====================================================');
  console.table(results.map(r => ({
    Site: r.site,
    Section: r.tagName || 'N/A',
    'Orig Dims': r.originalDimensions || 'N/A',
    'Synth Dims': r.synthDimensions || 'N/A',
    'Pixel Match %': r.pixelMatch !== undefined ? `${r.pixelMatch}%` : 'N/A',
    'Zero !important': r.zeroImportant ? 'YES' : 'NO'
  })));

  const summaryFile = path.join(ARTIFACTS_DIR, 'benchmark_5_sites_results.json');
  fs.writeFileSync(summaryFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 Detailed results saved to: ${summaryFile}`);
}

runTest().catch(console.error);
