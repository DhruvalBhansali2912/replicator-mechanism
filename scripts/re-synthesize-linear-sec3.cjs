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
  const dump = JSON.parse(fs.readFileSync('storage/linear_footer_dump.json', 'utf8'));
  const authenticCss = dump.sheets.join('\n');

  const engine = new GroundUpSynthesisEngine();
  const synth = engine.synthesizeSection(
    dump.html,
    'https://linear.app',
    authenticCss,
    'footer',
    'footer',
    dump.fullHtml,
    undefined,
    dump.rootVars
  );

  console.log('Synthesized Footer HTML length:', synth.html.length);
  console.log('Synthesized Footer CSS length:', synth.css.length);
  console.log('Synthesized Footer JS length:', synth.js.length);

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
  <title>Linear Footer Replica</title>
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
    sectionSelector: 'footer',
    archetype: 'footer',
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

  const page = await browser.newPage({ viewport: { width: 1440, height: 600 } });
  await page.goto(`http://localhost:3000/api/jobs/${jobId}/preview/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Verify exact font colors and layout properties
  const metrics = await page.evaluate(() => {
    const footer = document.querySelector('footer');
    const headerTitle = document.querySelector('footer h3, footer h4, [class*="section"] > [class*="title"], [class*="section"] span, [class*="section"] strong');
    const link = document.querySelector('footer a:not([class*="logo"]):not([aria-label*="home" i])');
    const csFooter = footer ? window.getComputedStyle(footer) : null;
    const csLink = link ? window.getComputedStyle(link) : null;
    const csHeader = headerTitle ? window.getComputedStyle(headerTitle) : null;

    return {
      footerWidth: footer ? footer.getBoundingClientRect().width : null,
      footerHeight: footer ? footer.getBoundingClientRect().height : null,
      footerBg: csFooter ? csFooter.backgroundColor : null,
      headerTitleColor: csHeader ? csHeader.color : null,
      headerTitleFont: csHeader ? csHeader.fontFamily : null,
      linkColor: csLink ? csLink.color : null,
      linkFontSize: csLink ? csLink.fontSize : null,
      linkText: link ? link.textContent.trim() : null
    };
  });
  console.log('Replica Verified Metrics:', metrics);

  // 2. Replica resting screenshot
  const replicaRestingPath = path.join(ARTIFACTS_DIR, 'linear_sec3_replica_resting.png');
  await page.screenshot({ path: replicaRestingPath });

  // 3. Test link hover interaction
  const testLink = page.locator('footer a:has-text("Pricing"), footer a:has-text("Intake"), footer a:has-text("Security")').first();
  if (await testLink.count() > 0) {
    await testLink.hover();
    await page.waitForTimeout(300);
  }
  const replicaHoverLinkPath = path.join(ARTIFACTS_DIR, 'linear_sec3_replica_hover_link.png');
  await page.screenshot({ path: replicaHoverLinkPath });

  // 4. Capture live Linear footer
  console.log('Capturing live Linear footer...');
  const livePage = await browser.newPage({ viewport: { width: 1440, height: 600 } });
  await livePage.goto('https://linear.app', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await livePage.waitForTimeout(3000);

  // Scroll to footer
  await livePage.evaluate(() => {
    const f = document.querySelector('footer');
    if (f) f.scrollIntoView();
  });
  await livePage.waitForTimeout(1000);

  const origFooterEl = livePage.locator('footer.Jmh1Wq_footer, footer').first();
  const origRestingPath = path.join(ARTIFACTS_DIR, 'linear_sec3_original_resting.png');
  await origFooterEl.screenshot({ path: origRestingPath });

  // Live hover link
  const liveLink = origFooterEl.locator('a:has-text("Pricing"), a:has-text("Intake"), a:has-text("Security")').first();
  if (await liveLink.count() > 0) {
    await liveLink.hover();
    await livePage.waitForTimeout(300);
  }
  const origHoverLinkPath = path.join(ARTIFACTS_DIR, 'linear_sec3_original_hover_link.png');
  await origFooterEl.screenshot({ path: origHoverLinkPath });

  // Capture replica element screenshot for 1:1 comparison
  const repFooterEl = page.locator('footer').first();
  const repElemRestingPath = path.join(ARTIFACTS_DIR, 'linear_sec3_replica_element.png');
  await repFooterEl.screenshot({ path: repElemRestingPath });

  // Compute pixel match between live footer and replica footer element
  const comp = compareImages(
    fs.readFileSync(origRestingPath),
    fs.readFileSync(repElemRestingPath),
    path.join(ARTIFACTS_DIR, 'linear_sec3_element_diff.png')
  );
  console.log(`Footer element pixel match score: ${comp.matchPercentage}% (${comp.diffPixels} diff pixels out of ${comp.totalPixels})`);

  await browser.close();
  console.log(`FINAL_FOOTER_JOB_ID=${jobId}`);
}

run().catch(console.error);
