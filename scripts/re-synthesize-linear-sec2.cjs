const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { GroundUpSynthesisEngine } = require('../dist/synthesis/engine.js');
const { chromium } = require('playwright');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');
const { PNG } = require('pngjs');
const archiver = require('archiver');

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
  if (diffPath) fs.writeFileSync(diffPath, PNG.sync.write(diff));

  return {
    width,
    height,
    diffPixels,
    totalPixels,
    matchPercentage: parseFloat(matchPercentage.toFixed(2))
  };
}

async function run() {
  const dump = JSON.parse(fs.readFileSync('storage/linear_hero_dump.json', 'utf8'));
  const authenticCss = dump.sheets.join('\n');

  const engine = new GroundUpSynthesisEngine();
  const synth = engine.synthesizeSection(
    dump.html,
    'https://linear.app',
    authenticCss,
    'hero',
    'section',
    dump.fullHtml,
    undefined,
    dump.rootVars
  );

  console.log('Synthesized Hero HTML length:', synth.html.length);
  console.log('Synthesized Hero CSS length:', synth.css.length);
  console.log('Synthesized Hero JS length:', synth.js.length);

  // Generate authentic hex job ID
  const jobId = 'job_' + crypto.randomBytes(8).toString('hex');
  const jobDir = path.join('storage/jobs', jobId);
  const fullPageDir = path.join(jobDir, 'full-page');
  fs.mkdirSync(fullPageDir, { recursive: true });

  const finalHtml = `<!DOCTYPE html>
<html lang="en" class="dark" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Linear Hero Replica</title>
  <link rel="stylesheet" href="style.css">
</head>
<body style="margin: 0; padding: 0; background-color: #08090a; color: #f7f8f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; overflow-x: hidden;">
${synth.html}
  <script src="script.js" defer></script>
</body>
</html>`;

  fs.writeFileSync(path.join(fullPageDir, 'index.html'), finalHtml);
  fs.writeFileSync(path.join(fullPageDir, 'style.css'), synth.css);
  fs.writeFileSync(path.join(fullPageDir, 'script.js'), synth.js);

  fs.writeFileSync(path.join(jobDir, 'reconstruction.html'), finalHtml);
  fs.writeFileSync(path.join(jobDir, 'reconstruction.css'), synth.css);
  fs.writeFileSync(path.join(jobDir, 'reconstruction.js'), synth.js);

  // Write job.json
  const jobMeta = {
    id: jobId,
    url: 'https://linear.app',
    sectionSelector: 'section',
    archetype: 'hero',
    status: 'completed',
    createdAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(jobDir, 'job.json'), JSON.stringify(jobMeta, null, 2));

  // Package zip
  const zipPath = path.join(jobDir, 'site-package.zip');
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(output);
  archive.file(path.join(fullPageDir, 'index.html'), { name: 'index.html' });
  archive.file(path.join(fullPageDir, 'style.css'), { name: 'style.css' });
  archive.file(path.join(fullPageDir, 'script.js'), { name: 'script.js' });
  await archive.finalize();

  console.log(`Created job ${jobId} at ${jobDir}`);
  console.log(`Preview URL: http://localhost:3000/api/jobs/${jobId}/preview/`);

  // Launch Playwright
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-web-security'],
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(`http://localhost:3000/api/jobs/${jobId}/preview/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Verify exact font colors
  const fontColors = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    const p = document.querySelector('.QI8oKG_container p');
    const tab = document.querySelector('.Mmx1Wq_navItem');
    const issueTitle = document.querySelector('.KFZpfa_titleText');
    return {
      h1Color: h1 ? window.getComputedStyle(h1).color : null,
      pColor: p ? window.getComputedStyle(p).color : null,
      tabColor: tab ? window.getComputedStyle(tab).color : null,
      issueTitleColor: issueTitle ? window.getComputedStyle(issueTitle).color : null
    };
  });
  console.log('Replica Verified Font Colors:', fontColors);

  // 2. Replica resting state screenshot
  const replicaRestingPath = path.join(ARTIFACTS_DIR, 'linear_sec2_replica_resting.png');
  await page.screenshot({ path: replicaRestingPath });

  // 3. Test interactive dashboard tab switching across all 10 tabs!
  console.log('Testing interactive dashboard tab switching...');
  const testTabs = [
    'Agent tasks',
    'Agent Insights',
    'UI Refresh',
    'Reviews',
    'Pulse',
    'Inbox',
    'My issues',
    'Initiatives',
    'Projects',
    'Faster app launch'
  ];

  for (const tabName of testTabs) {
    const tabBtn = page.locator(`.Mmx1Wq_navItem:has-text("${tabName}")`).first();
    const count = await tabBtn.count();
    if (count > 0) {
      await tabBtn.click();
      await page.waitForTimeout(400);

      const tabState = await page.evaluate((name) => {
        const views = Array.from(document.querySelectorAll('.WS84WW_view'));
        const activeView = views.find(v => window.getComputedStyle(v).display !== 'none');
        const box = activeView ? activeView.getBoundingClientRect() : null;
        return {
          name,
          activeViewTabName: activeView ? activeView.getAttribute('data-tab-name') : null,
          box,
          activeViewText: activeView ? activeView.textContent.trim().replace(/\s+/g, ' ').slice(0, 50) : null
        };
      }, tabName);

      console.log(`Tab Clicked: "${tabName}" => Active View:`, tabState);

      // Save screenshot of key views
      if (tabName === 'Agent tasks') {
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'linear_sec2_tab_agent_tasks.png') });
      } else if (tabName === 'Agent Insights') {
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'linear_sec2_tab_agent_insights.png') });
      } else if (tabName === 'Reviews') {
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'linear_sec2_tab_reviews.png') });
      } else if (tabName === 'Projects') {
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'linear_sec2_tab_projects.png') });
      } else if (tabName === 'Pulse') {
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'linear_sec2_tab_pulse.png') });
      }
    }
  }

  // 4. Test CTA button hover
  const ctaBtn = page.locator('a:has-text("Start building"), button:has-text("Start building"), a:has-text("Get started"), button:has-text("Get started")').first();
  if (await ctaBtn.count() > 0) {
    await ctaBtn.hover();
    await page.waitForTimeout(200);
  }
  const replicaHoverCtaPath = path.join(ARTIFACTS_DIR, 'linear_sec2_replica_hover_cta.png');
  await page.screenshot({ path: replicaHoverCtaPath });

  // 5. Capture Live site matching screenshots
  console.log('Capturing live Linear site...');
  const livePage = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await livePage.goto('https://linear.app', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await livePage.waitForTimeout(3000);

  // Hide header on live page
  await livePage.evaluate(() => {
    const h = document.querySelector('header');
    if (h) h.style.display = 'none';
  });
  await livePage.waitForTimeout(500);

  const origRestingPath = path.join(ARTIFACTS_DIR, 'linear_sec2_original_resting.png');
  await livePage.screenshot({ path: origRestingPath });

  // Click Agent tasks on live
  const liveAgentTab = livePage.locator('.Mmx1Wq_navItem:has-text("Agent tasks")').first();
  if (await liveAgentTab.count() > 0) {
    await liveAgentTab.click();
    await livePage.waitForTimeout(300);
    await livePage.screenshot({ path: path.join(ARTIFACTS_DIR, 'linear_sec2_live_tab_agent_tasks.png') });
  }

  // Click Agent Insights on live
  const liveInsightsTab = livePage.locator('.Mmx1Wq_navItem:has-text("Agent Insights")').first();
  if (await liveInsightsTab.count() > 0) {
    await liveInsightsTab.click();
    await livePage.waitForTimeout(300);
    await livePage.screenshot({ path: path.join(ARTIFACTS_DIR, 'linear_sec2_live_tab_agent_insights.png') });
  }

  // Compute pixel match between live resting and replica resting
  const compViewport = compareImages(
    fs.readFileSync(origRestingPath),
    fs.readFileSync(replicaRestingPath),
    path.join(ARTIFACTS_DIR, 'linear_sec2_viewport_diff.png')
  );
  console.log(`Viewport pixel match score: ${compViewport.matchPercentage}% (${compViewport.diffPixels} diff pixels out of ${compViewport.totalPixels})`);

  await browser.close();
  console.log(`FINAL_HERO_JOB_ID=${jobId}`);
}

run().catch(console.error);
