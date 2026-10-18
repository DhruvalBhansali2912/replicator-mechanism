import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { synthesisEngine } from '../dist/synthesis/engine.js';
import { FidelityGuard } from '../dist/validator/fidelity-guard.js';

(async () => {
  const html = fs.readFileSync('storage/anthropic_full_page.html', 'utf8');
  const rawCss = fs.readFileSync('storage/anthropic_full_css.css', 'utf8');
  const sec3Selector = 'section.vaquita-cta_section, .vaquita-cta_section';

  console.log('Synthesizing Section 3 with fresh engine...');
  const res = synthesisEngine.synthesizeSection(
    '',
    'https://anthropic.com',
    rawCss,
    sec3Selector,
    'cta',
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
    sourceUrl: 'https://anthropic.com'
  });

  const finalHtml = guardResult.patches.length > 0 ? guardResult.healedHtml : res.html;
  const finalCss = guardResult.patches.length > 0 ? guardResult.healedCss : res.css;
  const finalJs = guardResult.patches.length > 0 ? guardResult.healedJs : res.js;

  // Save to storage/jobs/job_anthropic_sec3
  const jobId = 'job_anthropic_sec3';
  const jobDir = path.resolve('storage/jobs', jobId);
  const fullPageDir = path.join(jobDir, 'full-page');
  fs.mkdirSync(fullPageDir, { recursive: true });

  const previewHtml = `<!DOCTYPE html>
<html lang="en" class="w-mod-js w-mod-touch">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="no-referrer">
  <title>Anthropic Section 3 — Synthesized</title>
  <link rel="stylesheet" href="style.css">
</head>
<body style="background-color: #faf9f5; margin: 0; padding: 0;">
${finalHtml}
  <script src="script.js" defer></script>
</body>
</html>`;

  fs.writeFileSync(path.join(fullPageDir, 'index.html'), previewHtml, 'utf8');
  fs.writeFileSync(path.join(fullPageDir, 'style.css'), finalCss, 'utf8');
  fs.writeFileSync(path.join(fullPageDir, 'script.js'), finalJs, 'utf8');
  fs.writeFileSync(path.join(jobDir, 'job.json'), JSON.stringify({
    id: jobId,
    url: 'https://anthropic.com',
    targetArchetype: 'cta',
    status: 'completed'
  }, null, 2), 'utf8');

  console.log('Saved synthesized Section 3 job to:', fullPageDir);
})();
