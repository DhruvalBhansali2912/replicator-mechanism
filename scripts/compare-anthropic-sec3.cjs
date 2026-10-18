const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const pixelmatchRaw = require('pixelmatch');
const pixelmatch = pixelmatchRaw.default || pixelmatchRaw;

(async () => {
  const browser = await chromium.launch();
  const artifactDir = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84';

  console.log('=== Desktop Evaluation (1440px) ===');
  const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  // Live
  console.log('Loading live page on desktop...');
  await desktopPage.goto('https://anthropic.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await desktopPage.waitForTimeout(3000);

  const liveSec = await desktopPage.$('section.vaquita-cta_section, .vaquita-cta_section');
  if (liveSec) {
    await liveSec.scrollIntoViewIfNeeded();
    await desktopPage.waitForTimeout(2000);

    await liveSec.screenshot({ path: path.join(artifactDir, 'anthropic_sec3_desktop_live.png') });
    const liveStyles = await liveSec.evaluate(el => {
      const h2 = el.querySelector('h2');
      const h2Style = h2 ? window.getComputedStyle(h2) : null;
      const card = el.querySelector('.big-cta_scroll-bg') || el.querySelector('[class*="card"]');
      const cardStyle = card ? window.getComputedStyle(card) : null;
      const btn = el.querySelector('.btn_main_text') || el.querySelector('a, button');
      const btnStyle = btn ? window.getComputedStyle(btn) : null;
      return {
        h2Font: h2Style ? h2Style.fontFamily : '',
        h2Size: h2Style ? h2Style.fontSize : '',
        h2Weight: h2Style ? h2Style.fontWeight : '',
        h2Color: h2Style ? h2Style.color : '',
        cardBg: cardStyle ? cardStyle.backgroundColor : '',
        btnColor: btnStyle ? btnStyle.color : '',
        btnFont: btnStyle ? btnStyle.fontFamily : ''
      };
    });
    console.log('Live Desktop Styles:', liveStyles);
  }

  // Synthesized
  console.log('Loading synthesized preview on desktop...');
  await desktopPage.goto('http://localhost:3000/api/jobs/job_anthropic_sec3/preview/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await desktopPage.waitForTimeout(3000);

  const synthSec = await desktopPage.$('section.vaquita-cta_section, .vaquita-cta_section, body > section');
  if (synthSec) {
    await synthSec.scrollIntoViewIfNeeded();
    await desktopPage.waitForTimeout(2000);

    await synthSec.screenshot({ path: path.join(artifactDir, 'anthropic_sec3_desktop_synthesized.png') });
    const synthStyles = await synthSec.evaluate(el => {
      const h2 = el.querySelector('h2');
      const h2Style = h2 ? window.getComputedStyle(h2) : null;
      const card = el.querySelector('.big-cta_scroll-bg') || el.querySelector('[class*="card"]');
      const cardStyle = card ? window.getComputedStyle(card) : null;
      const btn = el.querySelector('.btn_main_text') || el.querySelector('a, button');
      const btnStyle = btn ? window.getComputedStyle(btn) : null;
      return {
        h2Font: h2Style ? h2Style.fontFamily : '',
        h2Size: h2Style ? h2Style.fontSize : '',
        h2Weight: h2Style ? h2Style.fontWeight : '',
        h2Color: h2Style ? h2Style.color : '',
        cardBg: cardStyle ? cardStyle.backgroundColor : '',
        btnColor: btnStyle ? btnStyle.color : '',
        btnFont: btnStyle ? btnStyle.fontFamily : ''
      };
    });
    console.log('Synthesized Desktop Styles:', synthStyles);
  }

  // Mobile 390px
  console.log('\n=== Mobile Evaluation (390px) ===');
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  
  // Live
  console.log('Loading live page on mobile...');
  await mobilePage.goto('https://anthropic.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await mobilePage.waitForTimeout(3000);
  const liveMobileSec = await mobilePage.$('section.vaquita-cta_section, .vaquita-cta_section');
  if (liveMobileSec) {
    await liveMobileSec.scrollIntoViewIfNeeded();
    await mobilePage.waitForTimeout(2000);
    await liveMobileSec.screenshot({ path: path.join(artifactDir, 'anthropic_sec3_mobile_live.png') });
    const liveMobileStyles = await liveMobileSec.evaluate(el => {
      const h2 = el.querySelector('h2');
      const card = el.querySelector('.big-cta_scroll-bg') || el.querySelector('[class*="card"]');
      return {
        h2Size: h2 ? window.getComputedStyle(h2).fontSize : '',
        h2Font: h2 ? window.getComputedStyle(h2).fontFamily : '',
        cardBg: card ? window.getComputedStyle(card).backgroundColor : ''
      };
    });
    console.log('Live Mobile Styles:', liveMobileStyles);
  }

  // Synthesized
  console.log('Loading synthesized preview on mobile...');
  await mobilePage.goto('http://localhost:3000/api/jobs/job_anthropic_sec3/preview/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await mobilePage.waitForTimeout(3000);
  const synthMobileSec = await mobilePage.$('section.vaquita-cta_section, .vaquita-cta_section, body > section');
  if (synthMobileSec) {
    await synthMobileSec.scrollIntoViewIfNeeded();
    await mobilePage.waitForTimeout(2000);
    await synthMobileSec.screenshot({ path: path.join(artifactDir, 'anthropic_sec3_mobile_synthesized.png') });
    const synthMobileStyles = await synthMobileSec.evaluate(el => {
      const h2 = el.querySelector('h2');
      const card = el.querySelector('.big-cta_scroll-bg') || el.querySelector('[class*="card"]');
      return {
        h2Size: h2 ? window.getComputedStyle(h2).fontSize : '',
        h2Font: h2 ? window.getComputedStyle(h2).fontFamily : '',
        cardBg: card ? window.getComputedStyle(card).backgroundColor : ''
      };
    });
    console.log('Synthesized Mobile Styles:', synthMobileStyles);
  }

  // Pixelmatch calculation
  function compareImages(livePath, synthPath, diffPath) {
    try {
      const img1 = PNG.sync.read(fs.readFileSync(livePath));
      const img2 = PNG.sync.read(fs.readFileSync(synthPath));
      const width = Math.min(img1.width, img2.width);
      const height = Math.min(img1.height, img2.height);
      const cropped1 = new PNG({ width, height });
      const cropped2 = new PNG({ width, height });
      PNG.bitblt(img1, cropped1, 0, 0, width, height, 0, 0);
      PNG.bitblt(img2, cropped2, 0, 0, width, height, 0, 0);

      const diff = new PNG({ width, height });
      const numDiffPixels = pixelmatch(cropped1.data, cropped2.data, diff.data, width, height, { threshold: 0.15 });
      fs.writeFileSync(diffPath, PNG.sync.write(diff));
      const totalPixels = width * height;
      const matchRatio = ((totalPixels - numDiffPixels) / totalPixels) * 100;
      return matchRatio;
    } catch (e) {
      console.warn('Comparison note:', e.message);
      return null;
    }
  }

  const dRatio = compareImages(
    path.join(artifactDir, 'anthropic_sec3_desktop_live.png'),
    path.join(artifactDir, 'anthropic_sec3_desktop_synthesized.png'),
    path.join(artifactDir, 'anthropic_sec3_desktop_diff.png')
  );
  if (dRatio !== null) console.log(`Desktop Visual Match: ${dRatio.toFixed(2)}%`);

  const mRatio = compareImages(
    path.join(artifactDir, 'anthropic_sec3_mobile_live.png'),
    path.join(artifactDir, 'anthropic_sec3_mobile_synthesized.png'),
    path.join(artifactDir, 'anthropic_sec3_mobile_diff.png')
  );
  if (mRatio !== null) console.log(`Mobile Visual Match: ${mRatio.toFixed(2)}%`);

  await browser.close();
  console.log('Section 3 evaluation completed successfully!');
})();
