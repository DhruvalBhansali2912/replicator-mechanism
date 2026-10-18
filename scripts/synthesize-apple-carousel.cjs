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
  const dump = JSON.parse(fs.readFileSync('storage/apple_carousel_dump.json', 'utf8'));
  const authenticCss = dump.sheets.join('\n');

  const engine = new GroundUpSynthesisEngine();
  const synth = engine.synthesizeSection(
    dump.html,
    'https://www.apple.com',
    authenticCss,
    'section.section-endless-entertainment-gallery',
    'carousel',
    dump.fullHtml,
    undefined,
    dump.rootVars
  );

  console.log('Synthesized Carousel HTML length:', synth.html.length);
  console.log('Synthesized Carousel CSS length:', synth.css.length);
  console.log('Synthesized Carousel JS length:', synth.js.length);

  // Generate authentic hex job ID
  const jobId = 'job_' + crypto.randomBytes(8).toString('hex');
  const jobDir = path.join('storage/jobs', jobId);
  const fullPageDir = path.join(jobDir, 'full-page');
  fs.mkdirSync(fullPageDir, { recursive: true });

  const finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Apple TV+ Carousel Replica</title>
  <link rel="stylesheet" href="style.css">
</head>
<body style="margin: 0; padding: 0; background-color: #000000; color: #f5f5f7; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif; overflow-x: hidden;">
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
    url: 'https://www.apple.com',
    sectionSelector: 'section.section-endless-entertainment-gallery',
    archetype: 'carousel',
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

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-web-security', '--no-sandbox'],
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    });

    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    await page.goto(`http://localhost:3000/api/jobs/${jobId}/preview/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 1. Verify metrics and structure
    const metrics = await page.evaluate(() => {
      const sec = document.querySelector('section');
      const track = document.querySelector('.media-gallery-item-container, [class*="gallery-item-container"]');
      const slides = Array.from(document.querySelectorAll('.media-gallery-item'));
      const dots = Array.from(document.querySelectorAll('.dotnav-item, .dotnav-link'));
      const streamButtons = Array.from(document.querySelectorAll('a, button')).filter(b => b.textContent.includes('Stream now'));

      return {
        sectionWidth: sec ? sec.getBoundingClientRect().width : null,
        sectionHeight: sec ? sec.getBoundingClientRect().height : null,
        trackFound: !!track,
        trackTransform: track ? window.getComputedStyle(track).transform : null,
        slidesCount: slides.length,
        firstSlideWidth: slides[0] ? slides[0].getBoundingClientRect().width : null,
        dotsCount: dots.length,
        streamButtonsCount: streamButtons.length
      };
    });
    console.log('Replica Carousel Metrics (Desktop):', metrics);

    // 2. Replica resting screenshot (Desktop)
    const replicaRestingPath = path.join(ARTIFACTS_DIR, 'apple_carousel_replica_resting.png');
    await page.screenshot({ path: replicaRestingPath });
    const repSec = page.locator('section').first();
    const repSecPath = path.join(ARTIFACTS_DIR, 'apple_carousel_replica_element.png');
    await repSec.screenshot({ path: repSecPath });

    // 3. Verify automated dual-track motion (Wait for 5.5s autoplay tick)
    console.log('Verifying automated dual-track carousel motion over 6 seconds...');
    await page.waitForTimeout(5500);

    const autoMotion = await page.evaluate(() => {
      const tvTrack = document.querySelector('.tv-media-gallery .media-gallery-item-container');
      const famTrack = document.querySelector('.fam-media-gallery .media-gallery-item-container');
      const activeDot = document.querySelector('.dotnav-item.current');
      return {
        tvTrackTransform: tvTrack ? tvTrack.style.transform : null,
        famTrackTransform: famTrack ? famTrack.style.transform : null,
        activeDotIndex: activeDot ? Array.from(activeDot.parentElement.children).indexOf(activeDot) : -1
      };
    });
    console.log('Automated Motion Result (t=5.5s):', autoMotion);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'apple_carousel_automated_slide2.png') });

    // 4. Test interactive dot click (slide 3)
    console.log('Testing interactive dot click on Dot 3 (Slide 3)...');
    const dot3 = page.locator('.dotnav-link, .dotnav-item a, .dotnav a').nth(2);
    if (await dot3.count() > 0) {
      await dot3.click();
      await page.waitForTimeout(700);

      const afterDot3 = await page.evaluate(() => {
        const tvTrack = document.querySelector('.tv-media-gallery .media-gallery-item-container');
        const famTrack = document.querySelector('.fam-media-gallery .media-gallery-item-container');
        const activeDot = document.querySelector('.dotnav-item.current');
        return {
          tvTrackTransform: tvTrack ? tvTrack.style.transform : null,
          famTrackTransform: famTrack ? famTrack.style.transform : null,
          activeDotIndex: activeDot ? Array.from(activeDot.parentElement.children).indexOf(activeDot) : -1
        };
      });
      console.log('After clicking Dot 3 (Slide 3):', afterDot3);
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'apple_carousel_replica_slide3.png') });
    }
    // 5. Test button hover on active slide CTA
    const cta = page.locator('.tv-media-gallery .current a.media-gallery-wrapper-link, .tv-media-gallery .current a, .tv-media-gallery [class*="button"]').first();
    try {
      if (await cta.count() > 0 && await cta.isVisible()) {
        await cta.hover({ timeout: 2000 });
        await page.waitForTimeout(200);
      }
    } catch (e) {
      console.warn('CTA hover skipped:', e.message);
    }
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'apple_carousel_replica_hover_cta.png') });

    // 6. Mobile viewport test (390x844)
    console.log('Testing Mobile viewport (390x844)...');
    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobilePage.goto(`http://localhost:3000/api/jobs/${jobId}/preview/`, { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(1000);

    const mobileMetrics = await mobilePage.evaluate(() => {
      const sec = document.querySelector('section');
      const track = document.querySelector('.media-gallery-item-container, [class*="gallery-item-container"]');
      const slides = Array.from(document.querySelectorAll('.media-gallery-item'));
      return {
        sectionWidth: sec ? sec.getBoundingClientRect().width : null,
        sectionHeight: sec ? sec.getBoundingClientRect().height : null,
        trackFound: !!track,
        slidesCount: slides.length,
        firstSlideWidth: slides[0] ? slides[0].getBoundingClientRect().width : null
      };
    });
    console.log('Replica Carousel Metrics (Mobile):', mobileMetrics);

    const mobileRestingPath = path.join(ARTIFACTS_DIR, 'apple_carousel_replica_mobile.png');
    await mobilePage.screenshot({ path: mobileRestingPath, fullPage: true });

    // Mobile dot click
    const mobileDot2 = mobilePage.locator('.dotnav-link, .dotnav-item a, .dotnav a').nth(1);
    if (await mobileDot2.count() > 0) {
      await mobileDot2.click();
      await mobilePage.waitForTimeout(600);
      await mobilePage.screenshot({ path: path.join(ARTIFACTS_DIR, 'apple_carousel_replica_mobile_slide2.png') });
    }
    await mobilePage.close();

    console.log(`FINAL_APPLE_CAROUSEL_JOB_ID=${jobId}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

run().catch(console.error);
