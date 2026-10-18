const { PageExtractor } = require('../dist/crawler/page-extractor.js');
const { ZipPackager } = require('../dist/packager/zip-packager.js');
const { ComparisonEngine } = require('../dist/validator/comparison-engine.js');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84';

async function runAppleBenchmark() {
  const jobId = 'bench_apple_' + Date.now();
  const url = 'https://www.apple.com/';
  console.log(`\n======================================================`);
  console.log(`Extracting Apple Full Page: ${url}`);
  console.log(`Job ID: ${jobId}`);
  console.log(`======================================================`);

  const extractor = new PageExtractor();
  const packager = new ZipPackager();
  const comparison = new ComparisonEngine();

  const result = await extractor.extract(url, {
    url,
    renameClasses: false,
    purgeCss: false,
    deminify: false,
    localizeAssets: true,
  }, (step, pct) => {
    console.log(`[Extractor] ${pct}% - ${step}`);
  });

  console.log(`\nPackaging Apple clone into storage/jobs/${jobId}/full-page...`);
  await packager.packageJob(jobId, url, { url }, result);

  console.log(`\nRunning Server-Side Multi-Screen & Interaction Comparison...`);
  const report = await comparison.runFullComparison(jobId, {
    liveUrl: url,
    onProgress: (msg) => console.log(`[Comparison] ${msg}`),
  });

  console.log(`\nApple Report Results:`);
  console.log(`Overall Visual Fidelity: ${report.fidelityScore}%`);
  console.log(JSON.stringify(report.proofs, null, 2));

  // Copy screenshots to artifact dir
  const qaDir = path.join(__dirname, '../storage/jobs', jobId, 'full-page/qa');
  if (fs.existsSync(qaDir)) {
    for (const f of fs.readdirSync(qaDir)) {
      if (f.endsWith('.png')) {
        const dest = path.join(ARTIFACT_DIR, `apple_bench_${f}`);
        fs.copyFileSync(path.join(qaDir, f), dest);
        console.log(`Copied artifact: apple_bench_${f}`);
      }
    }
  }
}

runAppleBenchmark().catch((err) => {
  console.error('Apple benchmark error:', err);
  process.exit(1);
});
