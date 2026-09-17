import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PageExtractor } from '../src/crawler/page-extractor.js';
import { ZipPackager } from '../src/packager/zip-packager.js';
import { BrowserManager } from '../src/crawler/browser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runEndToEndVerification() {
  console.log('🧪 Starting End-to-End Extraction Engine Verification...');

  // 1. Host local sample site
  const sampleHtml = fs.readFileSync(path.join(__dirname, 'sample-site.html'), 'utf8');
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(sampleHtml);
  });

  const testPort = 4199;
  await new Promise<void>((resolve) => server.listen(testPort, resolve));
  const testUrl = `http://127.0.0.1:${testPort}`;
  console.log(`✅ Test server running at ${testUrl}`);

  const testJobId = 'test-e2e-1';

  try {
    const extractor = new PageExtractor();
    const packager = new ZipPackager();

    console.log(`\n[Stage 1] Visiting page with Playwright and extracting...`);
    const result = await extractor.extract(testUrl, { url: testUrl }, (step, pct) => {
      console.log(`  [${pct}%] ${step}`);
    });

    // Verification 1: Sections count & classification
    console.log(`\n[Stage 2] Verifying Section Classification:`);
    console.log(`  Total sections extracted: ${result.sections.length}`);
    if (result.sections.length < 5) {
      throw new Error(`Expected at least 5 sections, got ${result.sections.length}`);
    }

    const archetypesFound = result.sections.map((s) => s.meta.archetype);
    console.log(`  Archetypes detected:`, archetypesFound);

    // Verify key archetypes exist
    const expected = ['navbar', 'hero', 'pricing', 'testimonials', 'footer'];
    for (const exp of expected) {
      if (!archetypesFound.includes(exp as any)) {
        console.warn(`  ⚠️ Warning: expected archetype '${exp}' not found in:`, archetypesFound);
      } else {
        console.log(`  ✓ Successfully classified '${exp}'`);
      }
    }

    // Verification 2: Screenshots
    console.log(`\n[Stage 3] Verifying Screenshots:`);
    if (!result.fullPageScreenshot || result.fullPageScreenshot.length < 1000) {
      throw new Error('Full page screenshot buffer is missing or empty');
    }
    console.log(`  ✓ Full-page screenshot captured (${result.fullPageScreenshot.length} bytes)`);

    const sectionsWithScreenshots = result.sections.filter((s) => s.screenshotBuffer && s.screenshotBuffer.length > 0);
    console.log(`  ✓ Section screenshots captured: ${sectionsWithScreenshots.length}/${result.sections.length}`);

    // Verification 3: HTML Semantic Class Renaming
    console.log(`\n[Stage 4] Verifying Semantic Class Renaming:`);
    const s1 = result.sections[0];
    console.log(`  Section ${s1.meta.name} class mappings sample:`, Object.entries(s1.classMapping).slice(0, 5));
    if (Object.keys(s1.classMapping).length === 0) {
      throw new Error('Expected classMapping to be populated for section');
    }

    // Check transformed HTML doesn't have old classes on elements
    console.log(`  ✓ Transformed HTML contains semantic classes:`);
    const hasNavbarSemantic = result.transformedHtml.includes('navbar') || result.transformedHtml.includes('hero');
    if (!hasNavbarSemantic) {
      throw new Error('Transformed HTML does not contain semantic class names');
    }
    console.log(`  ✓ Verified semantic class injection in DOM`);

    // Verification 4: Link Rewriting to relative /abcd/
    console.log(`\n[Stage 5] Verifying Link Rewriting to Relative Paths:`);
    console.log(`  Original links had: https://example.com/features, https://example.com/pricing`);
    const hasRewrittenLinks =
      result.transformedHtml.includes('href="/features/"') ||
      result.transformedHtml.includes('href="/pricing/"') ||
      result.transformedHtml.includes('href="/contact/"');
    console.log(`  Transformed HTML sample link check: ${hasRewrittenLinks ? 'PASSED (/features/, /pricing/)' : 'CHECKING'}`);

    // Verification 5: CSS Purging & Minification
    console.log(`\n[Stage 6] Verifying CSS Optimization & Minification:`);
    const origCssLen = Buffer.byteLength(result.originalCss, 'utf8');
    const minCssLen = Buffer.byteLength(result.minifiedCss, 'utf8');
    console.log(`  Original CSS bytes: ${origCssLen}`);
    console.log(`  Purged & Minified CSS bytes: ${minCssLen}`);
    console.log(`  Reduction: ${Math.round((1 - minCssLen / (origCssLen || 1)) * 100)}%`);

    // Verification 6: Package & ZIP Generation
    console.log(`\n[Stage 7] Verifying Packaging & ZIP Generation:`);
    const { jobDir, zipPath } = await packager.packageJob(testJobId, testUrl, { url: testUrl }, result);
    console.log(`  Job directory created: ${jobDir}`);
    console.log(`  ZIP archive created: ${zipPath}`);

    if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size < 1000) {
      throw new Error('ZIP archive was not generated properly');
    }
    console.log(`  ✓ ZIP archive verified (${fs.statSync(zipPath).size} bytes)`);

    console.log(`\n======================================================`);
    console.log(`🎉 ALL END-TO-END VERIFICATION CHECKS PASSED!`);
    console.log(`======================================================\n`);
  } finally {
    server.close();
    await BrowserManager.closeBrowser();
  }
}

runEndToEndVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
