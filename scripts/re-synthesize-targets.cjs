const fs = require('fs');
const path = require('path');
const { ReconstructionWorker } = require('../dist/workers/reconstruction-worker.js');
const { VisualSegmentationWorker } = require('../dist/workers/visual-segmentation-worker.js');

async function resynthesizeTarget(jobId, name, url) {
  console.log(`\n>>> Re-synthesizing [${name}] (${jobId})...`);
  const jobDir = path.join(__dirname, `../storage/jobs/${jobId}`);
  const snapHtmlPath = fs.existsSync(path.join(jobDir, 'snapshot.html'))
    ? path.join(jobDir, 'snapshot.html')
    : fs.existsSync(path.join(jobDir, 'reconstruction.html'))
    ? path.join(jobDir, 'reconstruction.html')
    : path.join(jobDir, 'full-page/index.html');

  const rawCssPath = fs.existsSync(path.join(jobDir, 'reconstruction.css'))
    ? path.join(jobDir, 'reconstruction.css')
    : path.join(jobDir, 'full-page/style.css');

  if (!fs.existsSync(snapHtmlPath)) {
    console.warn(`Snapshot not found for ${jobId} at ${snapHtmlPath}`);
    return;
  }

  const rawHtml = fs.readFileSync(snapHtmlPath, 'utf8');
  const rawCss = fs.existsSync(rawCssPath) ? fs.readFileSync(rawCssPath, 'utf8') : '';

  const segWorker = new VisualSegmentationWorker();
  const segRes = await segWorker.execute(rawHtml);
  console.log(`  Identified ${segRes.totalSections} sections in ${name}.`);

  const recWorker = new ReconstructionWorker();
  const recRes = await recWorker.execute(
    rawHtml,
    rawCss,
    '',
    segRes.sections,
    url,
    undefined,
    rawHtml
  );

  const fullPageDir = path.join(jobDir, 'full-page');
  fs.mkdirSync(fullPageDir, { recursive: true });

  fs.writeFileSync(path.join(fullPageDir, 'index.html'), recRes.fullHtml, 'utf8');
  fs.writeFileSync(path.join(fullPageDir, 'style.css'), recRes.fullCss, 'utf8');
  fs.writeFileSync(path.join(fullPageDir, 'script.js'), recRes.fullJs, 'utf8');
  console.log(`  ✓ Successfully synthesized and saved fresh files to ${fullPageDir}`);
}

async function main() {
  await resynthesizeTarget('job_a17b5ffdc22a429c', 'Samsung', 'https://www.samsung.com/in/');
  await resynthesizeTarget('job_2c8182636e644eb8', 'Apple', 'https://www.apple.com/');
  await resynthesizeTarget('job_stripe_verified_master', 'Stripe', 'https://stripe.com');
  console.log('\n=== ALL TARGETS RE-SYNTHESIZED WITH UNIVERSAL RULES ===\n');
}

main().catch(err => {
  console.error('Re-synthesis failed:', err);
  process.exit(1);
});
