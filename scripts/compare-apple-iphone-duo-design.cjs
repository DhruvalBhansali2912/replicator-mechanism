const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatchRaw = require('pixelmatch');
const pixelmatch = pixelmatchRaw.default || pixelmatchRaw;

const artifactDir = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84';

function compare(p1, p2, diffP) {
  try {
    const img1 = PNG.sync.read(fs.readFileSync(p1));
    const img2 = PNG.sync.read(fs.readFileSync(p2));
    const width = Math.min(img1.width, img2.width);
    const height = Math.min(img1.height, img2.height);
    const c1 = new PNG({ width, height });
    const c2 = new PNG({ width, height });
    PNG.bitblt(img1, c1, 0, 0, width, height, 0, 0);
    PNG.bitblt(img2, c2, 0, 0, width, height, 0, 0);
    const diff = new PNG({ width, height });
    const diffCount = pixelmatch(c1.data, c2.data, diff.data, width, height, { threshold: 0.15 });
    fs.writeFileSync(diffP, PNG.sync.write(diff));
    return ((width * height - diffCount) / (width * height)) * 100;
  } catch (e) {
    console.warn('Comparison error:', e.message);
    return null;
  }
}

(async () => {
  console.log('=== Desktop Evaluation (1440px) ===');
  
  // 1. Live Desktop (Night Sky & Star White)
  {
    console.log('Loading live Apple iPhone Duo on desktop...');
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('https://www.apple.com/iphone-duo/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      document.querySelectorAll('[id*="onetrust"], [class*="cookie-banner"], [id*="consent"], #ac-localnav, nav.localnav, [class*="localnav"], #ac-globalnav, header.ac-gn, [class*="globalnav"]').forEach(el => el.remove());
    });
    const liveSec = await page.$('section#design, section.section-design');
    if (liveSec) {
      const liveMedia = await page.$('section#design .media-block');
      if (liveMedia) await liveMedia.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' }));
      await page.waitForTimeout(3500);
      
      // Pause video at endframe for Night Sky screenshot
      await page.evaluate(() => {
        document.querySelectorAll('video').forEach(v => {
          v.pause();
          if (v.duration) v.currentTime = v.duration;
        });
      });
      await liveSec.screenshot({ path: path.join(artifactDir, 'apple_duo_design_desktop_live.png'), animations: 'allow' });
      console.log('Captured live desktop Night Sky screenshot.');

      // Click Star White swatch
      console.log('Clicking live Star White swatch...');
      await page.evaluate(() => {
        const sw = document.querySelector('#design-fade-gallery-1-colornav-1, input[value="star-white"]');
        if (sw) sw.click();
        else {
          const labels = document.querySelectorAll('.colornav-link');
          if (labels[1]) labels[1].click();
        }
      });
      await page.waitForTimeout(2000);
      await liveSec.screenshot({ path: path.join(artifactDir, 'apple_duo_design_desktop_starwhite_live.png'), animations: 'allow' });
      console.log('Captured live desktop Star White screenshot.');
    }
    await browser.close();
  }

  // 2. Synthesized Desktop (Night Sky & Star White)
  {
    console.log('Loading synthesized Apple iPhone Duo on desktop...');
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('http://localhost:3000/api/jobs/job_apple_iphone_duo_design/preview/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.evaluate(() => {
      document.querySelectorAll('video').forEach(v => {
        v.pause();
        if (v.duration) v.currentTime = v.duration;
      });
      window.scrollTo(0, 0);
    });
    const synthSec = await page.$('section#design, section.section-design, body > section');
    if (synthSec) {
      await synthSec.screenshot({ path: path.join(artifactDir, 'apple_duo_design_desktop_synthesized.png'), animations: 'allow' });
      console.log('Captured synthesized desktop Night Sky screenshot.');

      // Click Star White swatch on synthesized
      console.log('Clicking synthesized Star White swatch...');
      await page.click('label[for="design-fade-gallery-1-colornav-1"]');
      await page.waitForTimeout(2000);
      await synthSec.screenshot({ path: path.join(artifactDir, 'apple_duo_design_desktop_starwhite_synthesized.png'), animations: 'allow' });
      console.log('Captured synthesized desktop Star White screenshot.');
    }
    await browser.close();
  }

  console.log('\n=== Mobile Evaluation (390px) ===');
  // 3. Live Mobile (Night Sky & Star White)
  {
    console.log('Loading live Apple iPhone Duo on mobile...');
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto('https://www.apple.com/iphone-duo/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => {
      document.querySelectorAll('[id*="onetrust"], [class*="cookie-banner"], [id*="consent"], #ac-localnav, nav.localnav, [class*="localnav"], #ac-globalnav, header.ac-gn, [class*="globalnav"]').forEach(el => el.remove());
    });
    const liveMobileSec = await page.$('section#design, section.section-design');
    if (liveMobileSec) {
      const liveMMedia = await page.$('section#design .media-block');
      if (liveMMedia) await liveMMedia.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' }));
      await page.waitForTimeout(3500);
      await page.evaluate(() => {
        document.querySelectorAll('video').forEach(v => {
          v.pause();
          if (v.duration) v.currentTime = v.duration;
        });
      });
      await liveMobileSec.screenshot({ path: path.join(artifactDir, 'apple_duo_design_mobile_live.png'), animations: 'allow' });
      console.log('Captured live mobile Night Sky screenshot.');

      // Click Star White on mobile
      console.log('Clicking live mobile Star White swatch...');
      await page.evaluate(() => {
        const sw = document.querySelector('#design-fade-gallery-1-colornav-1, input[value="star-white"]');
        if (sw) sw.click();
        else {
          const labels = document.querySelectorAll('.colornav-link');
          if (labels[1]) labels[1].click();
        }
      });
      await page.waitForTimeout(2000);
      await liveMobileSec.screenshot({ path: path.join(artifactDir, 'apple_duo_design_mobile_starwhite_live.png'), animations: 'allow' });
      console.log('Captured live mobile Star White screenshot.');
    }
    await browser.close();
  }

  // 4. Synthesized Mobile (Night Sky & Star White)
  {
    console.log('Loading synthesized Apple iPhone Duo on mobile...');
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto('http://localhost:3000/api/jobs/job_apple_iphone_duo_design/preview/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.evaluate(() => {
      document.querySelectorAll('video').forEach(v => {
        v.pause();
        if (v.duration) v.currentTime = v.duration;
      });
      window.scrollTo(0, 0);
    });
    const synthMobileSec = await page.$('section#design, section.section-design, body > section');
    if (synthMobileSec) {
      await synthMobileSec.screenshot({ path: path.join(artifactDir, 'apple_duo_design_mobile_synthesized.png'), animations: 'allow' });
      console.log('Captured synthesized mobile Night Sky screenshot.');

      // Click Star White swatch on synthesized mobile
      console.log('Clicking synthesized mobile Star White swatch...');
      await page.click('label[for="design-fade-gallery-1-colornav-1"]');
      await page.waitForTimeout(2000);
      await synthMobileSec.screenshot({ path: path.join(artifactDir, 'apple_duo_design_mobile_starwhite_synthesized.png'), animations: 'allow' });
      console.log('Captured synthesized mobile Star White screenshot.');
    }
    await browser.close();
  }

  console.log('\n=== Visual Match Calculations ===');
  // Desktop Night Sky
  const dMatch = compare(
    path.join(artifactDir, 'apple_duo_design_desktop_live.png'),
    path.join(artifactDir, 'apple_duo_design_desktop_synthesized.png'),
    path.join(artifactDir, 'apple_duo_design_desktop_diff.png')
  );
  if (dMatch !== null) console.log(`Desktop Night Sky Match: ${dMatch.toFixed(2)}%`);

  // Desktop Star White
  const dStarMatch = compare(
    path.join(artifactDir, 'apple_duo_design_desktop_starwhite_live.png'),
    path.join(artifactDir, 'apple_duo_design_desktop_starwhite_synthesized.png'),
    path.join(artifactDir, 'apple_duo_design_desktop_starwhite_diff.png')
  );
  if (dStarMatch !== null) console.log(`Desktop Star White Match: ${dStarMatch.toFixed(2)}%`);

  // Mobile Night Sky
  const mMatch = compare(
    path.join(artifactDir, 'apple_duo_design_mobile_live.png'),
    path.join(artifactDir, 'apple_duo_design_mobile_synthesized.png'),
    path.join(artifactDir, 'apple_duo_design_mobile_diff.png')
  );
  if (mMatch !== null) console.log(`Mobile Night Sky Match: ${mMatch.toFixed(2)}%`);

  // Mobile Star White
  const mStarMatch = compare(
    path.join(artifactDir, 'apple_duo_design_mobile_starwhite_live.png'),
    path.join(artifactDir, 'apple_duo_design_mobile_starwhite_synthesized.png'),
    path.join(artifactDir, 'apple_duo_design_mobile_starwhite_diff.png')
  );
  if (mStarMatch !== null) console.log(`Mobile Star White Match: ${mStarMatch.toFixed(2)}%`);

  console.log('\nApple iPhone Duo design evaluation completed successfully!');
})();
