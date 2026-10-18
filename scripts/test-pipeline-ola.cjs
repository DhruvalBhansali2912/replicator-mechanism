const { PageExtractor } = require('../dist/crawler/page-extractor.js');
const { GroundUpSynthesisEngine } = require('../dist/synthesis/engine.js');
const { chromium } = require('playwright');
const fs = require('fs');

async function testFullPipeline() {
  console.log('🚀 Running end-to-end extraction with PageExtractor on olaelectric.com...');
  const extractor = new PageExtractor();
  const extractRes = await extractor.extract('https://www.olaelectric.com/', {
    targetArchetype: 'hero',
    timeout: 35000
  });

  console.log('✅ Extraction complete! Sections count:', extractRes.sections.length);
  const heroSec = extractRes.sections[0];
  console.log('Hero section:', {
    archetype: heroSec.archetype,
    selector: heroSec.selector,
    htmlLen: heroSec.html.length,
    hasHeader: heroSec.html.includes('<header') || heroSec.html.includes('header-menu'),
    hasOwl: heroSec.html.includes('owl-carousel'),
    cssLen: heroSec.css.length
  });

  const previewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ola Hero Full Pipeline Test</title>
  <style>
    ${heroSec.css}
  </style>
</head>
<body style="margin: 0; padding: 0; background: #000; overflow-x: hidden;">
  ${heroSec.html}
  <script>
    ${heroSec.js}
  </script>
</body>
</html>`;

  const previewPath = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84/full_pipeline_ola_preview.html';
  fs.writeFileSync(previewPath, previewHtml, 'utf8');
  console.log('Saved preview to', previewPath);

  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('file://' + previewPath, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const screenshotPath = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84/full_pipeline_ola_verified.png';
  await page.screenshot({ path: screenshotPath });
  console.log('Saved screenshot to', screenshotPath);
  await browser.close();
}

testFullPipeline().catch(console.error);
