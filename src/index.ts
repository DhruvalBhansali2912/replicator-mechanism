import { createServer } from './server.js';
import { CONFIG } from './config.js';
import { PageExtractor } from './crawler/page-extractor.js';
import { ZipPackager } from './packager/zip-packager.js';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  const args = process.argv.slice(2);
  const urlArgIndex = args.indexOf('--url');

  if (urlArgIndex !== -1 && args[urlArgIndex + 1]) {
    // CLI Mode
    const targetUrl = args[urlArgIndex + 1];
    console.log(`=== Web Section Extractor CLI ===`);
    console.log(`Target URL: ${targetUrl}`);

    const jobId = uuidv4().slice(0, 8);
    const extractor = new PageExtractor();
    const packager = new ZipPackager();

    console.log(`[1/3] Extracting website assets and sections...`);
    const result = await extractor.extract(targetUrl, { url: targetUrl }, (step, progress) => {
      console.log(`  [${progress}%] ${step}`);
    });

    console.log(`[2/3] Found ${result.sections.length} sections:`);
    result.sections.forEach((sec) => {
      console.log(`  - ${sec.meta.name} (confidence: ${sec.meta.confidence * 100}%)`);
    });

    console.log(`[3/3] Packaging output to storage/jobs/${jobId}...`);
    const { zipPath } = await packager.packageJob(jobId, targetUrl, { url: targetUrl }, result);

    console.log(`\n🎉 Extraction Complete!`);
    console.log(`  Job ID: ${jobId}`);
    console.log(`  ZIP Archive: ${zipPath}`);
    process.exit(0);
  }

  // Server Mode
  const app = createServer();
  const port = CONFIG.port;
  const host = CONFIG.host;

  app.listen(port, host, () => {
    console.log(`====================================================`);
    console.log(`🚀 Web Section Extractor Engine running!`);
    console.log(`🌐 REST API:       http://localhost:${port}/api`);
    console.log(`💻 Web Dashboard:  http://localhost:${port}/`);
    console.log(`📦 Storage Path:   ${CONFIG.jobsDir}`);
    console.log(`====================================================`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
