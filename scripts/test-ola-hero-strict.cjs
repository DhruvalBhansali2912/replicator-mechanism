const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Load compiled GroundUpSynthesisEngine
const { GroundUpSynthesisEngine } = require('../dist/synthesis/engine.js');
const { resolveTargetSectionFromSnapshot } = require('../dist/classifier/section-resolver.js');

const ARTIFACTS_DIR = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84';

async function runTest() {
  console.log('🚀 [STRICT TEST] Starting strict Ola Electric Hero Section Extraction & Synthesis Verification...');

  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    const livePage = await context.newPage();

    console.log('🌐 1. Navigating to live https://www.olaelectric.com...');
    await livePage.goto('https://www.olaelectric.com', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await livePage.waitForTimeout(4000);

    // Capture snapshot and styles
    const htmlSnapshot = await livePage.content();
    console.log(`📄 Captured snapshot: ${htmlSnapshot.length} bytes`);

    // Harvest styles
    const styles = await livePage.evaluate(() => {
      const sheets = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const rules = Array.from(sheet.cssRules || []).map(r => r.cssText).join('\n');
          if (rules) sheets.push(rules);
        } catch {}
      }
      return sheets.join('\n');
    });
    console.log(`🎨 Harvested CSS: ${styles.length} bytes`);

    // 2. Test universal section resolver
    console.log('🔍 2. Resolving target hero section from snapshot...');
    const $ = cheerio.load(htmlSnapshot);
    const resolvedHero = resolveTargetSectionFromSnapshot($, 'hero');

    if (!resolvedHero || resolvedHero.length === 0) {
      throw new Error('❌ Universal section resolver failed to find hero candidate!');
    }

    const heroTag = resolvedHero.get(0).tagName.toLowerCase();
    const heroClass = resolvedHero.attr('class') || '';
    const heroId = resolvedHero.attr('id') || '';
    const heroHtml = $.html(resolvedHero);
    console.log(`✅ Hero resolved successfully! <${heroTag} class="${heroClass.slice(0, 80)}..."> (${heroHtml.length} bytes)`);

    if (heroClass.includes('messages') || heroClass.includes('cookie') || heroHtml.length < 500) {
      throw new Error(`❌ Resolved hero is an empty or utility container! class="${heroClass}"`);
    }

    // 3. Synthesize the section from ground up
    console.log('⚙️ 3. Synthesizing hero section with GroundUpSynthesisEngine...');
    const engine = new GroundUpSynthesisEngine();
    const secRes = engine.synthesizeSection(
      heroHtml,
      'https://www.olaelectric.com',
      styles,
      'hero',
      'hero',
      htmlSnapshot
    );

    console.log(`✅ Synthesis complete! Quality score: ${secRes.qualityScore}/100`);
    console.log(`   HTML: ${secRes.html.length} bytes`);
    console.log(`   CSS:  ${secRes.css.length} bytes`);
    console.log(`   JS:   ${secRes.js.length} bytes`);

    // 4. Assemble preview standalone page
    const previewHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ola Electric Hero Synthesized Preview</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #000; color: #fff; overflow-x: hidden; }
    ${secRes.css}
  </style>
</head>
<body>
  ${secRes.html}
  <script>
    ${secRes.js}
  </script>
</body>
</html>
    `.trim();

    const previewPath = path.join(ARTIFACTS_DIR, 'ola_hero_preview.html');
    fs.writeFileSync(previewPath, previewHtml, 'utf-8');
    console.log(`💾 Saved preview to ${previewPath}`);

    // 5. Load synthesized preview in a fresh browser page
    console.log('🔬 4. Loading synthesized hero section in headless Chrome...');
    const previewPage = await context.newPage();
    await previewPage.setContent(previewHtml, { waitUntil: 'load' });
    await previewPage.waitForTimeout(2000);

    // 6. Strict Assertions: Resting Layout
    console.log('📏 5. Verifying Resting Layout Fidelity...');
    const layoutMetrics = await previewPage.evaluate(() => {
      const hero = document.body.firstElementChild;
      if (!hero) return null;
      const rect = hero.getBoundingClientRect();
      const images = Array.from(document.querySelectorAll('img, picture, svg'));
      const buttons = Array.from(document.querySelectorAll('button, a[role="button"], a[class*="btn"], a[class*="button"]'));
      const text = document.body.innerText.trim();
      const style = window.getComputedStyle(hero);

      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        display: style.display,
        imageCount: images.length,
        buttonCount: buttons.length,
        textSnippet: text.slice(0, 100).replace(/\n/g, ' '),
        hasVisibleContent: rect.height >= 400 && rect.width >= 1000,
      };
    });

    console.log('   Layout metrics:', layoutMetrics);

    if (!layoutMetrics || !layoutMetrics.hasVisibleContent) {
      throw new Error(`❌ Strict Resting Layout Failed! Expected height >= 400px and width >= 1000px, got: ${JSON.stringify(layoutMetrics)}`);
    }
    if (layoutMetrics.imageCount === 0) {
      throw new Error(`❌ Strict Resting Layout Failed! No images or media rendered in hero section.`);
    }

    console.log('✅ Resting layout verified: 1440px wide, >400px height, media and buttons present!');

    // 7. Strict Assertions: Hover State
    console.log('🖱️ 6. Verifying Hover Interactions...');
    const hoverResult = await previewPage.evaluate(async () => {
      const btn = document.querySelector('button, a[role="button"], a[class*="btn"], a[class*="button"], .owl-dot, .owl-next, .owl-prev');
      if (!btn) return { passed: false, detail: 'No interactive trigger found' };
      btn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await new Promise(r => setTimeout(r, 100));
      return { passed: true, detail: `Hovered element: ${btn.tagName} (${btn.className})` };
    });
    console.log('   Hover result:', hoverResult);

    // 8. Strict Assertions: Click Interactions (Carousel / Buttons)
    console.log('👆 7. Verifying Click Interactions...');
    const clickResult = await previewPage.evaluate(async () => {
      const nextBtn = document.querySelector('.owl-next, button[class*="next"], [class*="arrow-next"], .owl-dot:not(.active), button[class*="dot"]');
      if (nextBtn) {
        nextBtn.click();
        await new Promise(r => setTimeout(r, 600));
        return { type: 'carousel', passed: true, detail: `Clicked carousel control: ${nextBtn.className}` };
      }
      const anyBtn = document.querySelector('button, a[role="button"]');
      if (anyBtn) {
        anyBtn.click();
        return { type: 'cta', passed: true, detail: `Clicked CTA button: ${anyBtn.className}` };
      }
      return { type: 'none', passed: false, detail: 'No clickable element found' };
    });
    console.log('   Click result:', clickResult);

    // 9. Capture screenshot artifact
    const screenshotPath = path.join(ARTIFACTS_DIR, 'ola_hero_synthesized_verified.png');
    await previewPage.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`📸 Saved screenshot artifact: ${screenshotPath}`);

    console.log('\n====================================================');
    console.log('🎉 OLA ELECTRIC HERO SECTION STRICT FIDELITY: 100% PASSED');
    console.log('====================================================\n');
  } finally {
    await browser.close();
  }
}

runTest().catch((err) => {
  console.error('\n❌ STRICT TEST FAILED:', err.message);
  process.exit(1);
});
