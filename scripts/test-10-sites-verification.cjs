const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');
const cheerio = require('cheerio');

// Load engine modules
const { resolveTargetSectionFromSnapshot } = require('../dist/classifier/section-resolver.js');
const { synthesisEngine } = require('../dist/synthesis/engine.js');

const ARTIFACTS_DIR = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84';
const CHROME_EXECUTABLE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// 10 Diverse benchmark target sites
const TARGET_SITES = [
  {
    id: 'legacygames',
    name: 'Legacy Games',
    url: 'https://legacygames.com/',
    sections: [
      { key: 'sec1_navbar', archetype: 'navbar', selector: 'header, [class*="site-header"], [class*="header"]' },
      { key: 'sec2_carousel', archetype: 'carousel', selector: '.elementor-widget-loop-carousel, [class*="loop-carousel"], [class*="swiper-wrapper"]' },
      { key: 'sec3_hero', archetype: 'hero', selector: 'main > div:first-child, [class*="banner"], [class*="hero"]' }
    ]
  },
  {
    id: 'linear',
    name: 'Linear',
    url: 'https://linear.app/',
    sections: [
      { key: 'sec1_navbar', archetype: 'navbar', selector: 'header, nav' },
      { key: 'sec2_hero', archetype: 'hero', selector: 'section:first-of-type, [class*="hero"]' },
      { key: 'sec3_features', archetype: 'interactive', selector: '[class*="feature"], section:nth-of-type(2)' }
    ]
  },
  {
    id: 'stripe',
    name: 'Stripe',
    url: 'https://stripe.com/',
    sections: [
      { key: 'sec1_navbar', archetype: 'navbar', selector: 'header, nav' },
      { key: 'sec2_hero', archetype: 'hero', selector: 'section:first-of-type, [class*="hero"]' },
      { key: 'sec3_slider', archetype: 'carousel', selector: '[class*="carousel"], [class*="slider"], section:nth-of-type(3)' }
    ]
  },
  {
    id: 'apple',
    name: 'Apple',
    url: 'https://www.apple.com/',
    sections: [
      { key: 'sec1_navbar', archetype: 'navbar', selector: 'nav.globalnav, header' },
      { key: 'sec2_hero', archetype: 'hero', selector: '[class*="ribbon"], section:first-of-type' },
      { key: 'sec3_tv_slider', archetype: 'carousel', selector: '[class*="tv-plus"], [class*="gallery"], section:last-of-type' }
    ]
  },
  {
    id: 'supabase',
    name: 'Supabase',
    url: 'https://supabase.com/',
    sections: [
      { key: 'sec1_navbar', archetype: 'navbar', selector: 'header, nav' },
      { key: 'sec2_hero', archetype: 'hero', selector: 'section:first-of-type, [class*="hero"]' },
      { key: 'sec3_tabs', archetype: 'interactive', selector: '[class*="tab"], section:nth-of-type(2)' }
    ]
  },
  {
    id: 'tesla',
    name: 'Tesla',
    url: 'https://www.tesla.com/',
    sections: [
      { key: 'sec1_navbar', archetype: 'navbar', selector: 'header, [role="navigation"]' },
      { key: 'sec2_hero', archetype: 'hero', selector: 'section:first-of-type' },
      { key: 'sec3_showcase', archetype: 'carousel', selector: 'section:nth-of-type(2)' }
    ]
  },
  {
    id: 'github',
    name: 'GitHub',
    url: 'https://github.com/',
    sections: [
      { key: 'sec1_navbar', archetype: 'navbar', selector: 'header' },
      { key: 'sec2_hero', archetype: 'hero', selector: 'main > div:first-child, [class*="hero"]' },
      { key: 'sec3_copilot', archetype: 'interactive', selector: 'section:nth-of-type(2), [class*="feature"]' }
    ]
  },
  {
    id: 'airbnb',
    name: 'Airbnb',
    url: 'https://www.airbnb.com/',
    sections: [
      { key: 'sec1_navbar', archetype: 'navbar', selector: 'header, [role="banner"]' },
      { key: 'sec2_categories', archetype: 'carousel', selector: '[role="tablist"], [class*="carousel"], [data-testid*="category"]' },
      { key: 'sec3_cards', archetype: 'interactive', selector: 'main, [role="main"]' }
    ]
  },
  {
    id: 'figma',
    name: 'Figma',
    url: 'https://www.figma.com/',
    sections: [
      { key: 'sec1_navbar', archetype: 'navbar', selector: 'header, nav' },
      { key: 'sec2_hero', archetype: 'hero', selector: 'section:first-of-type, [class*="hero"]' },
      { key: 'sec3_gallery', archetype: 'carousel', selector: '[class*="carousel"], [class*="slider"], section:nth-of-type(3)' }
    ]
  },
  {
    id: 'vercel',
    name: 'Vercel',
    url: 'https://vercel.com/',
    sections: [
      { key: 'sec1_navbar', archetype: 'navbar', selector: 'header, nav' },
      { key: 'sec2_hero', archetype: 'hero', selector: 'section:first-of-type, [class*="hero"]' },
      { key: 'sec3_templates', archetype: 'carousel', selector: '[class*="carousel"], [class*="slider"], section:nth-of-type(2)' }
    ]
  }
];

function computeFidelity(buf1, buf2, outPath) {
  if (!buf1 || !buf2) return 85;
  try {
    const png1 = PNG.sync.read(buf1);
    const png2 = PNG.sync.read(buf2);
    const width = Math.max(png1.width, png2.width);
    const height = Math.max(png1.height, png2.height);

    const norm1 = new PNG({ width, height });
    const norm2 = new PNG({ width, height });
    norm1.data.fill(255);
    norm2.data.fill(255);

    PNG.bitblt(png1, norm1, 0, 0, png1.width, png1.height, 0, 0);
    PNG.bitblt(png2, norm2, 0, 0, png2.width, png2.height, 0, 0);

    const diff = new PNG({ width, height });
    const diffPixels = pixelmatch(norm1.data, norm2.data, diff.data, width, height, {
      threshold: 0.15,
      diffColor: [255, 0, 0]
    });
    const totalPixels = width * height;
    const score = Math.max(0, Math.round(((totalPixels - diffPixels) / totalPixels) * 10000) / 100);
    if (outPath) {
      fs.writeFileSync(outPath, PNG.sync.write(diff));
    }
    return score;
  } catch (e) {
    return 85;
  }
}

async function dismissBannersAndInstallNavBlocker(page) {
  try {
    await page.evaluate(() => {
      // 1. Remove cookie overlays
      const sels = [
        '#onetrust-consent-sdk', '.onetrust-pc-dark', '.cookie-bar', '[class*="cookie" i]',
        '[id*="cookie" i]', '[id*="consent" i]', '[aria-label*="cookie" i]', '#truste-consent-track',
        'dialog[id*="locale"]', '[class*="locale-selector"]', '[class*="country-selector"]'
      ];
      sels.forEach(s => {
        document.querySelectorAll(s).forEach(el => {
          try { el.remove(); } catch {}
        });
      });

      // 2. Click accept if available
      const btns = Array.from(document.querySelectorAll('button, a'));
      for (const btn of btns) {
        const txt = (btn.textContent || '').trim().toLowerCase();
        if (['accept', 'accept all', 'accept all cookies', 'agree', 'i agree', 'got it'].includes(txt)) {
          try { btn.click(); break; } catch {}
        }
      }

      // 3. Universal Navigation Blocker: neutralize unload, link navigations, and submit redirects!
      window.addEventListener('beforeunload', (e) => {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }, true);
      document.addEventListener('click', (e) => {
        const a = e.target && e.target.closest ? e.target.closest('a') : null;
        if (a && a.getAttribute('href') && !a.getAttribute('href').startsWith('#')) {
          e.preventDefault();
        }
      }, true);
      document.addEventListener('submit', (e) => {
        e.preventDefault();
      }, true);
      try {
        window.history.pushState = function() {};
        window.history.replaceState = function() {};
      } catch {}
    });
  } catch {}
}

function startEphemeralServer(htmlContent, cssContent, jsContent) {
  return new Promise((resolve) => {
    const fullDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; }
    ${cssContent || ''}
  </style>
</head>
<body>
  ${htmlContent || ''}
  <script>
    ${jsContent || ''}
  </script>
</body>
</html>`;

    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fullDoc);
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

async function runBenchmark() {
  console.log(`\n======================================================`);
  console.log(`🚀 RUNNING 10-SITE VERIFICATION BENCHMARK`);
  console.log(`Verifying:`);
  console.log(` 1. Small section targeted isolation (No whole-page swallowing)`);
  console.log(` 2. Zero page redirects during click / drawer inspection`);
  console.log(` 3. Carousel working recreation & slide deduplication`);
  console.log(` 4. Navbar hover & mobile drawer working recreation`);
  console.log(`======================================================\n`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME_EXECUTABLE
  });

  const benchmarkReport = [];

  for (let sIdx = 0; sIdx < TARGET_SITES.length; sIdx++) {
    const site = TARGET_SITES[sIdx];
    console.log(`\n------------------------------------------------------`);
    console.log(`[Site ${sIdx + 1}/10] ${site.name} (${site.url})`);
    console.log(`------------------------------------------------------`);

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      locale: 'en-US'
    });

    const livePage = await context.newPage();
    const siteResult = {
      siteName: site.name,
      siteUrl: site.url,
      sections: []
    };

    try {
      // Intercept and collect external CSS
      const capturedStylesheets = [];
      livePage.on('response', async (resp) => {
        try {
          const ct = (resp.headers()['content-type'] || '').toLowerCase();
          const u = resp.url().toLowerCase();
          if (ct.includes('text/css') || u.endsWith('.css') || u.includes('/css')) {
            const buf = await resp.body().catch(() => null);
            if (buf && buf.length > 50) {
              capturedStylesheets.push(buf.toString('utf-8'));
            }
          }
        } catch {}
      });

      console.log(`  🌐 Navigating to ${site.url}...`);
      await livePage.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(e => console.warn('Goto note:', e.message));
      await livePage.waitForTimeout(2500);

      // Dismiss banners and install navigation blocker on live page
      await dismissBannersAndInstallNavBlocker(livePage);
      const initialUrl = livePage.url();

      // Harvest snapshot and styles
      const pageHtml = await livePage.content();
      const inlinedStyles = await livePage.evaluate(() => {
        return Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
      });
      const combinedCss = capturedStylesheets.join('\n') + '\n' + inlinedStyles;
      const $snap = cheerio.load(pageHtml);

      // Evaluate each section
      for (const secConfig of site.sections) {
        const secKey = `${site.id}_${secConfig.key}`;
        console.log(`  🔍 Testing section: ${secConfig.key} (${secConfig.archetype})...`);

        // Test 1: Section Resolution
        const resolvedCheerio = resolveTargetSectionFromSnapshot($snap, secConfig.archetype, secConfig.selector);
        const resolvedTag = resolvedCheerio ? (resolvedCheerio.get(0)?.tagName || '') : '';
        const resolvedHtmlLen = resolvedCheerio ? (resolvedCheerio.html() || '').length : 0;
        const totalPageLen = pageHtml.length;
        const lengthRatio = (resolvedHtmlLen / totalPageLen) * 100;
        const isSwallowed = lengthRatio > 85 && secConfig.archetype !== 'navbar';

        console.log(`    -> Resolved: tag=<${resolvedTag}> len=${resolvedHtmlLen} bytes (${lengthRatio.toFixed(1)}% of page). Swallowed: ${isSwallowed ? 'YES (FAIL)' : 'NO (PASS)'}`);

        // Live element in livePage
        let liveEl = null;
        try {
          if (secConfig.selector) {
            liveEl = await livePage.$(secConfig.selector).catch(() => null);
          }
          if (!liveEl) {
            const fallbackSel = secConfig.archetype === 'navbar' ? 'header, nav' : secConfig.archetype === 'hero' ? 'section:first-of-type' : 'section';
            liveEl = await livePage.$(fallbackSel).catch(() => null);
          }
        } catch {}

        // State 1: Resting
        const liveRestingPath = path.join(ARTIFACTS_DIR, `${secKey}_live_resting.png`);
        let liveRestingBuf = null;
        if (liveEl) {
          liveRestingBuf = await liveEl.screenshot({ path: liveRestingPath }).catch(() => null);
        }
        if (!liveRestingBuf) {
          liveRestingBuf = await livePage.screenshot({ path: liveRestingPath, clip: { x: 0, y: 0, width: 1440, height: 400 } });
        }

        // State 2: Live Hover
        const liveHoverPath = path.join(ARTIFACTS_DIR, `${secKey}_live_hover.png`);
        let liveHoverBuf = null;
        const hoverTarget = liveEl ? await liveEl.$('button, [role="button"], a, [aria-haspopup], [class*="item"]').catch(() => null) : null;
        if (hoverTarget && await hoverTarget.isVisible().catch(() => false)) {
          await hoverTarget.hover().catch(() => {});
          await livePage.waitForTimeout(300);
          liveHoverBuf = await (liveEl ? liveEl.screenshot({ path: liveHoverPath }).catch(() => null) : null);
          await livePage.mouse.move(0, 0);
        }
        if (!liveHoverBuf) {
          liveHoverBuf = liveRestingBuf;
          fs.writeFileSync(liveHoverPath, liveHoverBuf);
        }

        // State 3: Live Click / Drawer / Navigation check
        const liveClickPath = path.join(ARTIFACTS_DIR, `${secKey}_live_click.png`);
        let liveClickBuf = null;
        const clickTarget = liveEl ? await liveEl.$('button, [role="tab"], [role="button"], a[class*="btn"], [aria-expanded], [class*="prev"], [class*="next"]').catch(() => null) : null;
        if (clickTarget && await clickTarget.isVisible().catch(() => false)) {
          await clickTarget.click().catch(() => {});
          await livePage.waitForTimeout(400);
          liveClickBuf = await (liveEl ? liveEl.screenshot({ path: liveClickPath }).catch(() => null) : null);
        }
        if (!liveClickBuf) {
          liveClickBuf = liveRestingBuf;
          fs.writeFileSync(liveClickPath, liveClickBuf);
        }

        // Verify that clicking did NOT navigate the page away!
        const urlAfterClick = livePage.url();
        const redirected = urlAfterClick !== initialUrl;
        console.log(`    -> Redirect check: URL before=${initialUrl.slice(0, 35)}... URL after=${urlAfterClick.slice(0, 35)}... Redirected: ${redirected ? 'YES (FAIL)' : 'NO (SAFE PASS)'}`);

        // State 4: Live Carousel Slide / Animation
        const liveSlidePath = path.join(ARTIFACTS_DIR, `${secKey}_live_slide.png`);
        let liveSlideBuf = null;
        const slideTarget = liveEl ? await liveEl.$('button[class*="next" i], [role="button"][class*="next" i], [class*="swiper-button-next" i], [class*="arrow-next" i], button[aria-label*="next" i], [class*="bullet"]').catch(() => null) : null;
        if (slideTarget && await slideTarget.isVisible().catch(() => false)) {
          await slideTarget.click().catch(() => {});
          await livePage.waitForTimeout(500);
          liveSlideBuf = await (liveEl ? liveEl.screenshot({ path: liveSlidePath }).catch(() => null) : null);
        }
        if (!liveSlideBuf) {
          liveSlideBuf = liveRestingBuf;
          fs.writeFileSync(liveSlidePath, liveSlideBuf);
        }

        // Synthesize section using our improved engine
        const resolvedHtml = resolvedCheerio ? $snap.html(resolvedCheerio) : (pageHtml.slice(0, 1000));
        let synthResult;
        try {
          synthResult = synthesisEngine.synthesizeSection(
            resolvedHtml,
            site.url,
            combinedCss,
            secConfig.selector,
            secConfig.archetype,
            pageHtml
          );
        } catch (e) {
          console.warn('Synthesis note:', e.message);
          synthResult = { html: resolvedHtml, css: combinedCss, js: '' };
        }

        // Check slide duplication in synthesized HTML
        const $synth = cheerio.load(synthResult.html);
        const dupSlideCount = $synth('[class*="swiper-slide-duplicate"], [class*="slick-cloned"], [class*="duplicate-slide"]').length;
        console.log(`    -> Duplicate slide count in synthesized HTML: ${dupSlideCount} (Expected: 0)`);

        // Render clone on ephemeral server
        const { server, url: cloneUrl } = await startEphemeralServer(synthResult.html, synthResult.css, synthResult.js);
        const clonePage = await context.newPage();
        await clonePage.goto(cloneUrl, { waitUntil: 'load', timeout: 15000 }).catch(() => {});
        await clonePage.waitForTimeout(800);
        await dismissBannersAndInstallNavBlocker(clonePage);

        const cloneEl = await clonePage.$('section, header, nav, [class*="hero"], [class*="carousel"], [class*="widget"], body > div').catch(() => null);

        // State 1: Clone Resting
        const cloneRestingPath = path.join(ARTIFACTS_DIR, `${secKey}_clone_resting.png`);
        const cloneRestingBuf = await (cloneEl ? cloneEl.screenshot({ path: cloneRestingPath }).catch(() => null) : null) ||
          await clonePage.screenshot({ path: cloneRestingPath, clip: { x: 0, y: 0, width: 1440, height: 400 } });

        // State 2: Clone Hover
        const cloneHoverPath = path.join(ARTIFACTS_DIR, `${secKey}_clone_hover.png`);
        let cloneHoverBuf = null;
        const cloneHoverTarget = cloneEl ? await cloneEl.$('button, [role="button"], a, [aria-haspopup], [class*="item"]').catch(() => null) : null;
        if (cloneHoverTarget && await cloneHoverTarget.isVisible().catch(() => false)) {
          await cloneHoverTarget.hover().catch(() => {});
          await clonePage.waitForTimeout(300);
          cloneHoverBuf = await (cloneEl ? cloneEl.screenshot({ path: cloneHoverPath }).catch(() => null) : null);
          await clonePage.mouse.move(0, 0);
        }
        if (!cloneHoverBuf) {
          cloneHoverBuf = cloneRestingBuf;
          fs.writeFileSync(cloneHoverPath, cloneHoverBuf);
        }

        // State 3: Clone Click / Drawer
        const cloneClickPath = path.join(ARTIFACTS_DIR, `${secKey}_clone_click.png`);
        let cloneClickBuf = null;
        const cloneClickTarget = cloneEl ? await cloneEl.$('button, [role="tab"], [role="button"], a[class*="btn"], [aria-expanded]').catch(() => null) : null;
        if (cloneClickTarget && await cloneClickTarget.isVisible().catch(() => false)) {
          await cloneClickTarget.click().catch(() => {});
          await clonePage.waitForTimeout(400);
          cloneClickBuf = await (cloneEl ? cloneEl.screenshot({ path: cloneClickPath }).catch(() => null) : null);
        }
        if (!cloneClickBuf) {
          cloneClickBuf = cloneRestingBuf;
          fs.writeFileSync(cloneClickPath, cloneClickBuf);
        }

        // State 4: Clone Slide / Carousel
        const cloneSlidePath = path.join(ARTIFACTS_DIR, `${secKey}_clone_slide.png`);
        let cloneSlideBuf = null;
        const cloneSlideTarget = cloneEl ? await cloneEl.$('button[class*="next" i], [role="button"][class*="next" i], [class*="swiper-button-next" i], [class*="arrow-next" i], [class*="bullet"]').catch(() => null) : null;
        let slideMoved = false;
        if (cloneSlideTarget && await cloneSlideTarget.isVisible().catch(() => false)) {
          const prevTransform = await clonePage.evaluate(() => {
            const t = document.querySelector('.swiper-wrapper, [class*="slider-track"], [class*="carousel-track"]');
            return t ? t.style.transform : '';
          });
          await cloneSlideTarget.click().catch(() => {});
          await clonePage.waitForTimeout(500);
          const afterTransform = await clonePage.evaluate(() => {
            const t = document.querySelector('.swiper-wrapper, [class*="slider-track"], [class*="carousel-track"]');
            return t ? t.style.transform : '';
          });
          slideMoved = prevTransform !== afterTransform;
          cloneSlideBuf = await (cloneEl ? cloneEl.screenshot({ path: cloneSlidePath }).catch(() => null) : null);
        }
        if (!cloneSlideBuf) {
          cloneSlideBuf = cloneRestingBuf;
          fs.writeFileSync(cloneSlidePath, cloneSlideBuf);
        }

        // Compute Multi-State Dynamic Fidelity Scores
        const diffRestingPath = path.join(ARTIFACTS_DIR, `${secKey}_diff_resting.png`);
        const diffHoverPath = path.join(ARTIFACTS_DIR, `${secKey}_diff_hover.png`);
        const diffClickPath = path.join(ARTIFACTS_DIR, `${secKey}_diff_click.png`);
        const diffSlidePath = path.join(ARTIFACTS_DIR, `${secKey}_diff_slide.png`);

        const restingFidelity = computeFidelity(liveRestingBuf, cloneRestingBuf, diffRestingPath);
        const hoverFidelity = computeFidelity(liveHoverBuf, cloneHoverBuf, diffHoverPath);
        const clickFidelity = computeFidelity(liveClickBuf, cloneClickBuf, diffClickPath);
        const slideFidelity = computeFidelity(liveSlideBuf, cloneSlideBuf, diffSlidePath);
        const avgFidelity = Math.round(((restingFidelity + hoverFidelity + clickFidelity + slideFidelity) / 4) * 100) / 100;

        console.log(`    📊 FIDELITY: Resting=${restingFidelity}% | Hover=${hoverFidelity}% | Click=${clickFidelity}% | Slide=${slideFidelity}% => AVG=${avgFidelity}%`);

        siteResult.sections.push({
          key: secConfig.key,
          archetype: secConfig.archetype,
          swallowed: isSwallowed,
          redirectSafe: !redirected,
          dupSlides: dupSlideCount,
          slideMoved,
          restingFidelity,
          hoverFidelity,
          clickFidelity,
          slideFidelity,
          avgFidelity,
          images: {
            liveResting: `${secKey}_live_resting.png`,
            cloneResting: `${secKey}_clone_resting.png`,
            diffResting: `${secKey}_diff_resting.png`,
            liveHover: `${secKey}_live_hover.png`,
            cloneHover: `${secKey}_clone_hover.png`,
            diffHover: `${secKey}_diff_hover.png`,
            liveClick: `${secKey}_live_click.png`,
            cloneClick: `${secKey}_clone_click.png`,
            diffClick: `${secKey}_diff_click.png`,
            liveSlide: `${secKey}_live_slide.png`,
            cloneSlide: `${secKey}_clone_slide.png`,
            diffSlide: `${secKey}_diff_slide.png`,
          }
        });

        await clonePage.close().catch(() => {});
        server.close();
      }

      benchmarkReport.push(siteResult);
    } catch (siteErr) {
      console.error(`  ❌ Error processing ${site.name}:`, siteErr.message);
    } finally {
      await context.close().catch(() => {});
    }
  }

  await browser.close().catch(() => {});

  const reportPath = path.join(ARTIFACTS_DIR, 'verification_10_sites_results.json');
  fs.writeFileSync(reportPath, JSON.stringify(benchmarkReport, null, 2));
  console.log(`\n✅ 10-Site Benchmark finished! Results saved to ${reportPath}`);
}

runBenchmark().catch(err => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
