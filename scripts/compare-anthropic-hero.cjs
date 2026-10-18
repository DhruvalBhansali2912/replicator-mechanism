const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const artifactDir = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84';

  // 1. Desktop 1440px
  console.log('--- Desktop Evaluation (1440px) ---');
  const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  // Live
  await desktopPage.goto('https://anthropic.com', { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);
  const liveHero = await desktopPage.$('header.hero_wrap, .hero_wrap');
  if (liveHero) {
    await liveHero.screenshot({ path: path.join(artifactDir, 'anthropic_sec2_hero_desktop_live.png') });
    const liveStyles = await liveHero.evaluate(el => {
      const h1 = el.querySelector('h1');
      const p = el.querySelector('p');
      const h1Style = window.getComputedStyle(h1);
      const pStyle = window.getComputedStyle(p);
      return {
        h1Font: h1Style.fontFamily,
        h1Size: h1Style.fontSize,
        h1Weight: h1Style.fontWeight,
        h1Color: h1Style.color,
        pFont: pStyle.fontFamily,
        pSize: pStyle.fontSize,
        pColor: pStyle.color,
        gridDisplay: window.getComputedStyle(el.querySelector('.home_hero_grid')).display
      };
    });
    console.log('Live Desktop Styles:', liveStyles);
  } else {
    console.error('Could not find live hero');
  }

  // Synthesized
  await desktopPage.goto('http://localhost:3000/api/jobs/job_anthropic_hero/preview/', { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);
  const synthHero = await desktopPage.$('header.hero_wrap, .hero_wrap');
  if (synthHero) {
    await synthHero.screenshot({ path: path.join(artifactDir, 'anthropic_sec2_hero_desktop_synthesized.png') });
    const synthStyles = await synthHero.evaluate(el => {
      const h1 = el.querySelector('h1');
      const p = el.querySelector('p');
      const h1Style = window.getComputedStyle(h1);
      const pStyle = window.getComputedStyle(p);
      return {
        h1Font: h1Style.fontFamily,
        h1Size: h1Style.fontSize,
        h1Weight: h1Style.fontWeight,
        h1Color: h1Style.color,
        pFont: pStyle.fontFamily,
        pSize: pStyle.fontSize,
        pColor: pStyle.color,
        gridDisplay: window.getComputedStyle(el.querySelector('.home_hero_grid')).display
      };
    });
    console.log('Synthesized Desktop Styles:', synthStyles);
  } else {
    console.error('Could not find synth hero');
  }

  // 2. Mobile 390px
  console.log('\n--- Mobile Evaluation (390px) ---');
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  
  // Live
  await mobilePage.goto('https://anthropic.com', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  const liveMobileHero = await mobilePage.$('header.hero_wrap, .hero_wrap');
  if (liveMobileHero) {
    await liveMobileHero.screenshot({ path: path.join(artifactDir, 'anthropic_sec2_hero_mobile_live.png') });
    const liveMobileStyles = await liveMobileHero.evaluate(el => {
      const h1 = el.querySelector('h1');
      const p = el.querySelector('p');
      return {
        h1Size: window.getComputedStyle(h1).fontSize,
        pSize: window.getComputedStyle(p).fontSize,
        gridDirection: window.getComputedStyle(el.querySelector('.home_hero_grid')).flexDirection
      };
    });
    console.log('Live Mobile Styles:', liveMobileStyles);
  }

  // Synthesized
  await mobilePage.goto('http://localhost:3000/api/jobs/job_anthropic_hero/preview/', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  const synthMobileHero = await mobilePage.$('header.hero_wrap, .hero_wrap');
  if (synthMobileHero) {
    await synthMobileHero.screenshot({ path: path.join(artifactDir, 'anthropic_sec2_hero_mobile_synthesized.png') });
    const synthMobileStyles = await synthMobileHero.evaluate(el => {
      const h1 = el.querySelector('h1');
      const p = el.querySelector('p');
      return {
        h1Size: window.getComputedStyle(h1).fontSize,
        pSize: window.getComputedStyle(p).fontSize,
        gridDirection: window.getComputedStyle(el.querySelector('.home_hero_grid')).flexDirection
      };
    });
    console.log('Synthesized Mobile Styles:', synthMobileStyles);
  }

  await browser.close();
  console.log('\nEvaluation screenshots saved to artifacts directory successfully!');
})();
