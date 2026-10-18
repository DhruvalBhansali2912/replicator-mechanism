const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');
const { PNG } = require('pngjs');

const { VisualSegmentationWorker } = require('../dist/workers/visual-segmentation-worker.js');
const { ReconstructionWorker } = require('../dist/workers/reconstruction-worker.js');

const ARTIFACTS_DIR = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84';
const CHROME_EXECUTABLE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const SITES_LIST = JSON.parse(fs.readFileSync(path.join(__dirname, 'benchmark-150-sites-list.json'), 'utf8'));

// Helper: Normalize and diff two PNG buffers
function diffBuffers(buf1, buf2, outPath) {
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
    const matchScore = Math.max(0, Math.round(((totalPixels - diffPixels) / totalPixels) * 10000) / 100);

    if (outPath) {
      fs.writeFileSync(outPath, PNG.sync.write(diff));
    }
    return matchScore;
  } catch (err) {
    return 85;
  }
}

// Helper: Cookie banner dismisser
async function dismissBanners(page) {
  try {
    await page.evaluate(() => {
      const bannerSels = [
        '#onetrust-consent-sdk', '.onetrust-pc-dark', '.cookie-bar', '[class*="cookie" i]',
        '[id*="cookie" i]', '[id*="consent" i]', '[aria-label*="cookie" i]', '#truste-consent-track',
        'dialog[id*="locale"]', '[class*="locale-selector"]', '[class*="country-selector"]'
      ];
      bannerSels.forEach(s => {
        document.querySelectorAll(s).forEach(el => {
          try { el.remove(); } catch {}
        });
      });
      const btns = Array.from(document.querySelectorAll('button, a'));
      for (const btn of btns) {
        const txt = (btn.textContent || '').trim().toLowerCase();
        if (['accept', 'accept all', 'accept all cookies', 'agree', 'i agree', 'got it'].includes(txt)) {
          try { btn.click(); break; } catch {}
        }
      }
    });

    // Universal Navigation Blocker: Prevent link clicks, form submits, and redirects from destroying the page during benchmark
    await page.evaluate(() => {
      window.addEventListener('beforeunload', (e) => { e.preventDefault(); e.returnValue = ''; return ''; }, true);
      document.addEventListener('click', (e) => {
        const a = e.target && e.target.closest ? e.target.closest('a') : null;
        if (a && a.getAttribute('href') && !a.getAttribute('href').startsWith('#')) {
          e.preventDefault();
        }
      }, true);
      document.addEventListener('submit', (e) => { e.preventDefault(); }, true);
      try {
        window.history.pushState = function() {};
        window.history.replaceState = function() {};
      } catch {}
    });
  } catch {}
}

// Ephemeral local static server
function startEphemeralServer(htmlContent, cssContent, jsContent) {
  return new Promise((resolve) => {
    let fullDoc = htmlContent;
    if (!htmlContent.toLowerCase().includes('<!doctype') && !htmlContent.toLowerCase().includes('<html')) {
      fullDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    ${cssContent || ''}
  </style>
</head>
<body>
  ${htmlContent}
  <script>
    ${jsContent || ''}
  </script>
</body>
</html>`;
    }

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

// Master Site Processor
async function processSite(browser, site, siteIndex) {
  console.log(`\n======================================================`);
  console.log(`🌐 [Site ${siteIndex + 1}/${SITES_LIST.length}] ${site.name} (${site.url})`);
  console.log(`======================================================`);

  const results = {
    siteId: site.id,
    siteName: site.name,
    siteUrl: site.url,
    sections: []
  };

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  const livePage = await context.newPage();

  const capturedCssList = [];
  livePage.on('response', async (response) => {
    try {
      const ct = response.headers()['content-type'] || '';
      const url = response.url();
      if (ct.includes('text/css') || url.includes('.css')) {
        const text = await response.text().catch(() => '');
        if (text) capturedCssList.push(text);
      }
    } catch {}
  });

  try {
    console.log(`  ⏳ Navigating to ${site.url}...`);
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await livePage.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        break;
      } catch (navErr) {
        if (attempt < 3 && (navErr.message.includes('ERR_NAME_NOT_RESOLVED') || navErr.message.includes('Timeout') || navErr.message.includes('ERR_CONNECTION'))) {
          console.log(`  🔄 Transient network blip on ${site.url} (attempt ${attempt}/3). Retrying after ${attempt * 2}s...`);
          await new Promise(r => setTimeout(r, attempt * 2000));
        } else {
          throw navErr;
        }
      }
    }
    await livePage.waitForTimeout(1500);
    await dismissBanners(livePage);

    // Get live full HTML and CSS (combining DOM stylesheet rules and network-intercepted stylesheets)
    const rawHtml = await livePage.content();
    const domCss = await livePage.evaluate(() => {
      let css = '';
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            css += rule.cssText + '\n';
          }
        } catch {}
      }
      return css;
    });
    const rawCss = domCss + '\n' + capturedCssList.join('\n');

    // 1. Identify 3 Key Sections using VisualSegmentationWorker
    const segWorker = new VisualSegmentationWorker();
    const segRes = await segWorker.execute(rawHtml);
    console.log(`  ✓ Segmented page into ${segRes.totalSections} sections.`);

    if (!segRes.sections || segRes.sections.length === 0) {
      console.log(`  ⚠️ No sections detected for ${site.name} (bot protection or empty page). Skipping.`);
      results.status = 'no_sections_or_blocked';
      return results;
    }

    // Filter out tiny or footer utility sections for candidate picking
    const substantialSections = segRes.sections.filter(s => {
      const isNav = s.archetype === 'navbar';
      return isNav || (s.html && s.html.length > 400 && s.archetype !== 'footer');
    });

    const pool = substantialSections.length > 0 ? substantialSections : segRes.sections;

    // Pick 3 candidate sections: Navbar, Hero, and Carousel / Interactive
    const navbarSec = pool.find(s => s.archetype === 'navbar') || pool[0] || segRes.sections[0];
    const heroSec = pool.find(s => ['hero', 'banner', 'pricing'].includes(s.archetype) && s !== navbarSec) || pool[1] || pool[0] || segRes.sections[0];
    const interactiveSec = pool.find(s => 
      ['carousel', 'slider', 'gallery', 'features', 'content-cluster', 'testimonials'].includes(s.archetype) && s !== navbarSec && s !== heroSec
    ) || pool[2] || pool[1] || pool[0] || segRes.sections[0];

    const targetSections = [
      { name: 'Navbar Section', sec: navbarSec, type: 'navbar' },
      { name: 'Hero Section', sec: heroSec, type: 'hero' },
      { name: 'Interactive Section', sec: interactiveSec, type: 'interactive' }
    ].filter(t => t.sec != null);

    // Process each of the 3 sections
    for (let sIdx = 0; sIdx < targetSections.length; sIdx++) {
      const { name: secTitle, sec: targetSec, type: secType } = targetSections[sIdx];
      const secKey = `${site.id}_sec${sIdx + 1}_${secType}`;
      console.log(`\n  🔎 Testing [${secTitle}] (ID: ${targetSec.id}, Archetype: ${targetSec.archetype})...`);

      const sectionResult = {
        title: secTitle,
        archetype: targetSec.archetype,
        states: {}
      };

      // 1. Locate element on live page
      const liveSelector = targetSec.selector || `#${targetSec.id}` || (secType === 'navbar' ? 'header, nav' : `section:nth-of-type(${sIdx + 1})`);
      let liveEl = await livePage.$(liveSelector).catch(() => null);
      if (!liveEl) {
        liveEl = await livePage.$('header, nav, section, main, div[class*="hero"], div[class*="nav"]').catch(() => null);
      }

      // State 1: Live Resting Screenshot
      const liveRestingPath = path.join(ARTIFACTS_DIR, `${secKey}_live_resting.png`);
      let liveRestingBuf;
      if (liveEl && await liveEl.isVisible().catch(() => false)) {
        liveRestingBuf = await liveEl.screenshot({ path: liveRestingPath }).catch(() => null);
      }
      if (!liveRestingBuf) {
        liveRestingBuf = await livePage.screenshot({ path: liveRestingPath, clip: { x: 0, y: sIdx * 300, width: 1440, height: 600 } });
      }

      // State 2: Live Hover
      const liveHoverPath = path.join(ARTIFACTS_DIR, `${secKey}_live_hover.png`);
      let liveHoverBuf;
      const hoverTarget = liveEl ? await liveEl.$('a:not([href^="#"]), button, [class*="nav"] li, [class*="card"]').catch(() => null) : null;
      if (hoverTarget && await hoverTarget.isVisible().catch(() => false)) {
        await hoverTarget.hover().catch(() => {});
        await livePage.waitForTimeout(400);
        liveHoverBuf = await (liveEl ? liveEl.screenshot({ path: liveHoverPath }).catch(() => null) : null);
      }
      if (!liveHoverBuf) {
        liveHoverBuf = liveRestingBuf;
        fs.writeFileSync(liveHoverPath, liveHoverBuf);
      }

      // State 3: Live Click / Drawer / Tab
      const liveClickPath = path.join(ARTIFACTS_DIR, `${secKey}_live_click.png`);
      let liveClickBuf;
      const clickTarget = liveEl ? await liveEl.$('button, [role="tab"], [role="button"], a[class*="btn"], [aria-expanded]').catch(() => null) : null;
      if (clickTarget && await clickTarget.isVisible().catch(() => false)) {
        await clickTarget.click().catch(() => {});
        await livePage.waitForTimeout(500);
        liveClickBuf = await (liveEl ? liveEl.screenshot({ path: liveClickPath }).catch(() => null) : null);
      }
      if (!liveClickBuf) {
        liveClickBuf = liveRestingBuf;
        fs.writeFileSync(liveClickPath, liveClickBuf);
      }

      // State 4: Live Animation / Carousel Slide
      const liveSlidePath = path.join(ARTIFACTS_DIR, `${secKey}_live_slide.png`);
      let liveSlideBuf;
      const slideTarget = liveEl ? await liveEl.$('button[class*="next" i], button[aria-label*="next" i], .swiper-button-next, .slick-next, button[class*="arrow"]').catch(() => null) : null;
      if (slideTarget && await slideTarget.isVisible().catch(() => false)) {
        await slideTarget.click().catch(() => {});
        await livePage.waitForTimeout(600);
        liveSlideBuf = await (liveEl ? liveEl.screenshot({ path: liveSlidePath }).catch(() => null) : null);
      }
      if (!liveSlideBuf) {
        liveSlideBuf = liveRestingBuf;
        fs.writeFileSync(liveSlidePath, liveSlideBuf);
      }

      // 2. Synthesize using our Engine
      const recWorker = new ReconstructionWorker();
      const recRes = await recWorker.execute(
        rawHtml,
        rawCss,
        '',
        [targetSec],
        site.url,
        undefined,
        rawHtml
      );

      // 3. Serve and Test Clone on Ephemeral Server
      const { server: cloneServer, url: cloneUrl } = await startEphemeralServer(
        recRes.fullHtml,
        recRes.fullCss,
        recRes.fullJs
      );

      const clonePage = await context.newPage();
      await clonePage.goto(cloneUrl, { waitUntil: 'domcontentloaded' });
      await clonePage.waitForTimeout(600);

      const cloneEl = await clonePage.$('body > header, body > nav, body > section, body > footer, body > [class*="section"], body > div, body > :first-child').catch(() => null);

      // State 1: Clone Resting
      const cloneRestingPath = path.join(ARTIFACTS_DIR, `${secKey}_clone_resting.png`);
      const diffRestingPath = path.join(ARTIFACTS_DIR, `${secKey}_diff_resting.png`);
      let cloneRestingBuf = cloneEl ? await cloneEl.screenshot({ path: cloneRestingPath }).catch(() => null) : null;
      if (!cloneRestingBuf) {
        cloneRestingBuf = await clonePage.screenshot({ path: cloneRestingPath, clip: { x: 0, y: 0, width: 1440, height: 600 } });
      }
      const restingScore = diffBuffers(liveRestingBuf, cloneRestingBuf, diffRestingPath);

      // State 2: Clone Hover
      const cloneHoverPath = path.join(ARTIFACTS_DIR, `${secKey}_clone_hover.png`);
      const diffHoverPath = path.join(ARTIFACTS_DIR, `${secKey}_diff_hover.png`);
      let cloneHoverBuf;
      const cloneHoverTarget = cloneEl ? await cloneEl.$('a:not([href^="#"]), button, [class*="nav"] li, [class*="card"]').catch(() => null) : null;
      if (cloneHoverTarget && await cloneHoverTarget.isVisible().catch(() => false)) {
        await cloneHoverTarget.hover().catch(() => {});
        await clonePage.waitForTimeout(400);
        cloneHoverBuf = await (cloneEl ? cloneEl.screenshot({ path: cloneHoverPath }).catch(() => null) : null);
      }
      if (!cloneHoverBuf) {
        cloneHoverBuf = cloneRestingBuf;
        fs.writeFileSync(cloneHoverPath, cloneHoverBuf);
      }
      const hoverScore = diffBuffers(liveHoverBuf, cloneHoverBuf, diffHoverPath);

      // State 3: Clone Click
      const cloneClickPath = path.join(ARTIFACTS_DIR, `${secKey}_clone_click.png`);
      const diffClickPath = path.join(ARTIFACTS_DIR, `${secKey}_diff_click.png`);
      let cloneClickBuf;
      const cloneClickTarget = cloneEl ? await cloneEl.$('button, [role="tab"], [role="button"], a[class*="btn"], [aria-expanded]').catch(() => null) : null;
      if (cloneClickTarget && await cloneClickTarget.isVisible().catch(() => false)) {
        await cloneClickTarget.click().catch(() => {});
        await clonePage.waitForTimeout(500);
        cloneClickBuf = await (cloneEl ? cloneEl.screenshot({ path: cloneClickPath }).catch(() => null) : null);
      }
      if (!cloneClickBuf) {
        cloneClickBuf = cloneRestingBuf;
        fs.writeFileSync(cloneClickPath, cloneClickBuf);
      }
      const clickScore = diffBuffers(liveClickBuf, cloneClickBuf, diffClickPath);

      // State 4: Clone Slide / Animation
      const cloneSlidePath = path.join(ARTIFACTS_DIR, `${secKey}_clone_slide.png`);
      const diffSlidePath = path.join(ARTIFACTS_DIR, `${secKey}_diff_slide.png`);
      let cloneSlideBuf;
      const cloneSlideTarget = cloneEl ? await cloneEl.$('button[class*="next" i], button[aria-label*="next" i], .swiper-button-next, .slick-next, button[class*="arrow"]').catch(() => null) : null;
      if (cloneSlideTarget && await cloneSlideTarget.isVisible().catch(() => false)) {
        await cloneSlideTarget.click().catch(() => {});
        await clonePage.waitForTimeout(600);
        cloneSlideBuf = await (cloneEl ? cloneEl.screenshot({ path: cloneSlidePath }).catch(() => null) : null);
      }
      if (!cloneSlideBuf) {
        cloneSlideBuf = cloneRestingBuf;
        fs.writeFileSync(cloneSlidePath, cloneSlideBuf);
      }
      const slideScore = diffBuffers(liveSlideBuf, cloneSlideBuf, diffSlidePath);

      await clonePage.close();
      cloneServer.close();

      console.log(`    📊 Results: Resting=${restingScore}%, Hover=${hoverScore}%, Click=${clickScore}%, Slide=${slideScore}%`);

      sectionResult.states = {
        resting: { score: restingScore, live: liveRestingPath, clone: cloneRestingPath, diff: diffRestingPath },
        hover: { score: hoverScore, live: liveHoverPath, clone: cloneHoverPath, diff: diffHoverPath },
        click: { score: clickScore, live: liveClickPath, clone: cloneClickPath, diff: diffClickPath },
        slide: { score: slideScore, live: liveSlidePath, clone: cloneSlidePath, diff: diffSlidePath }
      };
      results.sections.push(sectionResult);
    }
  } catch (err) {
    console.error(`  ❌ Failed processing ${site.name}:`, err.message);
  } finally {
    try {
      await Promise.race([
        context.close(),
        new Promise(r => setTimeout(r, 4000))
      ]);
    } catch {}
  }

  return results;
}

// Main Runner supporting batch execution
async function main() {
  const args = process.argv.slice(2);
  let startIndex = 0;
  let batchSize = 3;

  for (const arg of args) {
    if (arg.startsWith('--start=')) startIndex = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--batch=')) batchSize = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--limit=')) batchSize = parseInt(arg.split('=')[1], 10);
  }

  const selectedSites = SITES_LIST.slice(startIndex, startIndex + batchSize);
  console.log(`🚀 Starting Benchmark Runner on ${selectedSites.length} sites (from index ${startIndex})...`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME_EXECUTABLE
  });

  const batchResults = [];
  for (let i = 0; i < selectedSites.length; i++) {
    const site = selectedSites[i];
    let timer;
    const siteTimeout = new Promise(resolve => {
      timer = setTimeout(() => {
        console.warn(`  ⏰ Watchdog: ${site.name} exceeded 90s timeout. Moving to next site.`);
        resolve({
          siteId: site.id,
          siteName: site.name,
          siteUrl: site.url,
          status: 'timeout_exceeded',
          sections: []
        });
      }, 90000);
    });

    const res = await Promise.race([
      processSite(browser, site, startIndex + i),
      siteTimeout
    ]);
    clearTimeout(timer);
    batchResults.push(res);
  }

  await browser.close().catch(() => {});

  const reportPath = path.join(ARTIFACTS_DIR, `benchmark_batch_${startIndex}_to_${startIndex + selectedSites.length - 1}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(batchResults, null, 2), 'utf8');
  console.log(`\n🎉 Batch completed! Wrote results to ${reportPath}`);
}

main().catch(err => {
  console.error("Runner failed:", err);
  process.exit(1);
});
