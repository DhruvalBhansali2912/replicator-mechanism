const { ComparisonEngine } = require('../dist/validator/comparison-engine.js');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = '/Users/dhanashreedhruval/.gemini/antigravity/brain/284fc371-c66f-4744-889e-c21d1db8cc84';

async function run() {
  const jobId = 'bench_samsung_1791718691066';
  const url = 'https://www.samsung.com/in/';
  const comparison = new ComparisonEngine();

  console.log(`Running updated comparison for Samsung job ${jobId}...`);
  const report = await comparison.runFullComparison(jobId, {
    liveUrl: url,
    onProgress: (m) => console.log(m)
  });

  console.log('Fidelity Score:', report.fidelityScore + '%');
  console.log(JSON.stringify(report.proofs, null, 2));

  const qaDir = path.join(__dirname, '../storage/jobs', jobId, 'full-page/qa');
  for (const f of fs.readdirSync(qaDir)) {
    if (f.endsWith('.png')) {
      fs.copyFileSync(path.join(qaDir, f), path.join(ARTIFACT_DIR, `samsung_v2_${f}`));
      console.log(`Copied: samsung_v2_${f}`);
    }
  }
}
run().catch(console.error);
