import fs from 'fs';
import path from 'path';
import { synthesisEngine } from '../dist/synthesis/engine.js';
import { FidelityGuard } from '../dist/validator/fidelity-guard.js';

(async () => {
  const html = fs.readFileSync('storage/apple_iphone_duo_full_page.html', 'utf8');
  const rawCss = fs.readFileSync('storage/apple_iphone_duo_full_css.css', 'utf8');
  const secSelector = 'section#design, section.section-design';

  console.log('Synthesizing Apple iPhone Duo Section #design...');
  const res = synthesisEngine.synthesizeSection(
    '',
    'https://www.apple.com/iphone-duo/',
    rawCss,
    secSelector,
    'features',
    html,
    []
  );

  console.log('Archetype:', res.archetype);
  console.log('Score:', res.scoring.totalScore);
  console.log('HTML length:', res.html.length);
  console.log('CSS length:', res.css.length);
  console.log('JS length:', res.js.length);

  // Run FidelityGuard
  const guard = new FidelityGuard();
  const guardResult = await guard.auditAndHeal({
    html: res.html,
    css: res.css,
    js: res.js,
    rawWebsiteCss: rawCss,
    rawSnapshotHtml: html,
    sourceUrl: 'https://www.apple.com/iphone-duo/'
  });

  const finalHtml = guardResult.patches.length > 0 ? guardResult.healedHtml : res.html;
  const finalCss = guardResult.patches.length > 0 ? guardResult.healedCss : res.css;
  const finalJs = guardResult.patches.length > 0 ? guardResult.healedJs : res.js;

  // Save to storage/jobs/job_apple_iphone_duo_design
  const jobId = 'job_apple_iphone_duo_design';
  const jobDir = path.resolve('storage/jobs', jobId);
  const fullPageDir = path.join(jobDir, 'full-page');
  fs.mkdirSync(fullPageDir, { recursive: true });

  const previewHtml = `<!DOCTYPE html>
<html lang="en" class="js no-touch desktop enhanced inline-media">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="origin-when-cross-origin">
  <title>Apple iPhone Duo Design — Synthesized</title>
  <link rel="stylesheet" href="style.css">
</head>
<body class="page-overview" style="background-color: #ffffff; color: #1d1d1f; margin: 0; padding: 0;">
${finalHtml}
  <script src="script.js" defer></script>
</body>
</html>`;

  fs.writeFileSync(path.join(fullPageDir, 'index.html'), previewHtml, 'utf8');
  fs.writeFileSync(path.join(fullPageDir, 'style.css'), finalCss, 'utf8');
  fs.writeFileSync(path.join(fullPageDir, 'script.js'), finalJs, 'utf8');
  fs.writeFileSync(path.join(jobDir, 'job.json'), JSON.stringify({
    id: jobId,
    url: 'https://www.apple.com/iphone-duo/',
    targetArchetype: 'features',
    status: 'completed'
  }, null, 2), 'utf8');

  console.log('Saved synthesized Apple job to:', fullPageDir);
})();
