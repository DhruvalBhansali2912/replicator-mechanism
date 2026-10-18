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
  const dump = JSON.parse(fs.readFileSync('storage/linear_header_dump.json', 'utf8'));
  const authenticCss = dump.sheets.join('\n');

  const engine = new GroundUpSynthesisEngine();
  const synth = engine.synthesizeSection(
    dump.html,
    'https://linear.app',
    authenticCss,
    'navbar',
    'header',
    dump.fullHtml
  );

  console.log('Synthesized HTML length:', synth.html.length);
  console.log('Synthesized CSS length:', synth.css.length);
  console.log('Synthesized JS length:', synth.js.length);

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
  <title>Linear Header Replica</title>
  <link rel="stylesheet" href="style.css">
</head>
<body style="margin: 0; padding: 0; background-color: #08090a; color: #f7f8f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
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
    sectionSelector: 'header',
    archetype: 'navbar',
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
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://localhost:3000/api/jobs/${jobId}/preview/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Check resting state
  const restingInfo = await page.evaluate(() => {
    const header = document.querySelector('header');
    const popups = Array.from(document.querySelectorAll('.TZTsQG_popup'));
    const r = header ? header.getBoundingClientRect() : null;
    return {
      headerRect: r ? { width: r.width, height: r.height } : null,
      popupCount: popups.length,
      popupsVisible: popups.some(p => {
        const ps = window.getComputedStyle(p);
        const pr = p.getBoundingClientRect();
        return ps.display !== 'none' && pr.height > 0;
      })
    };
  });
  console.log('Replica Resting Info:', JSON.stringify(restingInfo, null, 2));

  // Screenshot replica resting
  const replicaRestingPath = path.join(ARTIFACTS_DIR, 'linear_sec1_replica_clean.png');
  await page.screenshot({ path: replicaRestingPath });

  // 2. Test Product hover & capture popup
  console.log('Testing Product hover...');
  const prod = page.locator('header button:has-text("Product")').first();
  await prod.hover();
  await page.waitForTimeout(400);

  const prodHoverState = await page.evaluate(() => {
    const prodPop = document.querySelector('#base-ui-_r_2_');
    const resPop = document.querySelector('#base-ui-_r_g_');
    const isProdVis = prodPop ? window.getComputedStyle(prodPop).display !== 'none' : false;
    const isResVis = resPop ? window.getComputedStyle(resPop).display !== 'none' : false;
    return {
      prodVisible: isProdVis,
      resVisible: isResVis,
      prodText: prodPop ? prodPop.textContent.slice(0, 40) : null
    };
  });
  console.log('Product hover state:', prodHoverState);

  const replicaHoverProductPath = path.join(ARTIFACTS_DIR, 'linear_sec1_hover_product_clean.png');
  await page.screenshot({ path: replicaHoverProductPath });

  // Move mouse away to reset
  await page.mouse.move(10, 10);
  await page.waitForTimeout(400);

  // 3. Test Resources hover & capture popup
  console.log('Testing Resources hover...');
  const res = page.locator('header button:has-text("Resources")').first();
  await res.hover();
  await page.waitForTimeout(400);

  const resHoverState = await page.evaluate(() => {
    const prodPop = document.querySelector('#base-ui-_r_2_');
    const resPop = document.querySelector('#base-ui-_r_g_');
    const isProdVis = prodPop ? window.getComputedStyle(prodPop).display !== 'none' : false;
    const isResVis = resPop ? window.getComputedStyle(resPop).display !== 'none' : false;
    return {
      prodVisible: isProdVis,
      resVisible: isResVis,
      resText: resPop ? resPop.textContent.slice(0, 40) : null
    };
  });
  console.log('Resources hover state:', resHoverState);

  const replicaHoverResourcesPath = path.join(ARTIFACTS_DIR, 'linear_sec1_hover_resources_clean.png');
  await page.screenshot({ path: replicaHoverResourcesPath });

  // Move mouse away to reset
  await page.mouse.move(10, 10);
  await page.waitForTimeout(400);

  // 4. Test Customers hover (MUST NOT show any popup)
  console.log('Testing Customers hover...');
  const cust = page.locator('header a:has-text("Customers")').first();
  await cust.hover();
  await page.waitForTimeout(200);

  const custHoverState = await page.evaluate(() => {
    const popups = Array.from(document.querySelectorAll('.TZTsQG_popup'));
    return {
      anyPopupVisible: popups.some(p => window.getComputedStyle(p).display !== 'none')
    };
  });
  console.log('Customers hover state (should be false):', custHoverState);

  const replicaHoverCustomersPath = path.join(ARTIFACTS_DIR, 'linear_sec1_hover_customers_clean.png');
  await page.screenshot({ path: replicaHoverCustomersPath });

  // 5. Test Sign up hover (MUST NOT show any popup)
  console.log('Testing Sign up hover...');
  const signup = page.locator('header a:has-text("Sign up")').first();
  await signup.hover();
  await page.waitForTimeout(200);

  const replicaHoverSignupPath = path.join(ARTIFACTS_DIR, 'linear_sec1_hover_signup_clean.png');
  await page.screenshot({ path: replicaHoverSignupPath });

  // Move away
  await page.mouse.move(10, 10);
  await page.waitForTimeout(300);

  // Check live Linear site for matching original screenshots
  console.log('Checking live Linear.app...');
  const livePage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await livePage.goto('https://linear.app', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await livePage.waitForTimeout(3000);

  const origRestingPath = path.join(ARTIFACTS_DIR, 'linear_sec1_original_clean.png');
  await livePage.screenshot({ path: origRestingPath });

  // Hover Product on live
  const liveProd = livePage.locator('header button:has-text("Product")').first();
  await liveProd.hover();
  await livePage.waitForTimeout(500);
  const origHoverProductPath = path.join(ARTIFACTS_DIR, 'linear_sec1_original_hover_product_clean.png');
  await livePage.screenshot({ path: origHoverProductPath });

  // Reset mouse
  await livePage.mouse.move(10, 10);
  await livePage.waitForTimeout(400);

  // Hover Resources on live
  const liveRes = livePage.locator('header button:has-text("Resources")').first();
  await liveRes.hover();
  await livePage.waitForTimeout(500);
  const origHoverResourcesPath = path.join(ARTIFACTS_DIR, 'linear_sec1_original_hover_resources_clean.png');
  await livePage.screenshot({ path: origHoverResourcesPath });

  // Compute pixel match between live resting and replica resting
  const comp = compareImages(
    fs.readFileSync(origRestingPath),
    fs.readFileSync(replicaRestingPath),
    path.join(ARTIFACTS_DIR, 'linear_sec1_diff_clean.png')
  );
  console.log(`Pixel match score: ${comp.matchPercentage}% (${comp.diffPixels} diff pixels out of ${comp.totalPixels})`);

  await browser.close();
  console.log(`FINAL_JOB_ID=${jobId}`);
}

run().catch(console.error);
