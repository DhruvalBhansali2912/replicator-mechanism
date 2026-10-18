const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { GroundUpSynthesisEngine } = require('../dist/synthesis/engine.js');
const { CssPurger } = require('../dist/optimizer/css-purger.js');
const { FidelityGuard } = require('../dist/validator/fidelity-guard.js');

async function resynthesizeJob(jobId) {
  console.log(`\n======================================================`);
  console.log(`Re-synthesizing job [${jobId}]...`);
  console.log(`======================================================`);

  const jobDir = path.join(__dirname, '../storage/jobs', jobId);
  const jobMetaPath = path.join(jobDir, 'job.json');
  if (!fs.existsSync(jobMetaPath)) {
    console.error(`Job metadata not found: ${jobMetaPath}`);
    return;
  }

  const job = JSON.parse(fs.readFileSync(jobMetaPath, 'utf8'));
  const sourceUrl = job.url || 'https://legacygames.com/';
  const options = job.options || {};

  // 1. Harvest stylesheets
  const rawSheets = Array.isArray(options.clientStylesheets)
    ? options.clientStylesheets
    : options.clientStylesheets
    ? [options.clientStylesheets]
    : [];

  const seenSheets = new Set();
  const uniqueSheets = [];
  for (const s of rawSheets) {
    const trimmed = (s || '').trim();
    if (!trimmed) continue;
    const normKey = trimmed.replace(/\/\*[\s\S]*?\*\//g, '').replace(/[\s"';\\]+/g, '').slice(0, 300);
    if (!seenSheets.has(normKey)) {
      seenSheets.add(normKey);
      uniqueSheets.push(trimmed);
    }
  }

  // Also harvest external stylesheets from htmlSnapshot if needed
  const optStylesheetUrls = Array.isArray(options.stylesheetUrls) ? options.stylesheetUrls : [];
  if (options.htmlSnapshot) {
    const $snap = cheerio.load(options.htmlSnapshot);
    $snap('link[rel="stylesheet"]').each((_, el) => {
      const href = $snap(el).attr('href');
      if (href && !href.startsWith('chrome-extension://')) {
        try {
          optStylesheetUrls.push(new URL(href, sourceUrl).href);
        } catch {}
      }
    });
    $snap('style').each((_, el) => {
      const content = $snap(el).html();
      if (content && content.trim()) {
        const trimmed = content.trim();
        const normKey = trimmed.replace(/\/\*[\s\S]*?\*\//g, '').replace(/[\s"';\\]+/g, '').slice(0, 300);
        if (!seenSheets.has(normKey)) {
          seenSheets.add(normKey);
          uniqueSheets.push(trimmed);
        }
      }
    });
  }

  if (optStylesheetUrls.length > 0) {
    const fetched = await Promise.all(
      optStylesheetUrls.map(async (href) => {
        try {
          const resp = await fetch(href, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Referer': sourceUrl,
            },
            signal: AbortSignal.timeout(4000),
          });
          if (resp.ok) {
            const text = await resp.text();
            return text.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, raw) => {
              const trimmed = (raw || '').trim();
              if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                return m;
              }
              try {
                return `url("${new URL(trimmed, href).href}")`;
              } catch {
                return m;
              }
            });
          }
        } catch {}
        return '';
      })
    );
    for (const s of fetched) {
      const trimmed = (s || '').trim();
      if (!trimmed) continue;
      const normKey = trimmed.replace(/\/\*[\s\S]*?\*\//g, '').replace(/[\s"';\\]+/g, '').slice(0, 300);
      if (!seenSheets.has(normKey)) {
        seenSheets.add(normKey);
        uniqueSheets.push(trimmed);
      }
    }
  }

  const rawCss = uniqueSheets.join('\n');
  console.log(`  Raw CSS gathered: ${rawCss.length} bytes`);

  // 2. Identify target HTML
  let targetHtml = options.sectionHtml || '';
  const effectiveSelector = options.sectionSelector || 'section';
  if (!targetHtml && options.htmlSnapshot) {
    try {
      const $snap = cheerio.load(options.htmlSnapshot);
      const selTarget = $snap(effectiveSelector).first();
      if (selTarget.length > 0) {
        targetHtml = $snap.html(selTarget);
      }
    } catch {}
  }
  if (!targetHtml && fs.existsSync(path.join(jobDir, 'reconstruction.html'))) {
    targetHtml = fs.readFileSync(path.join(jobDir, 'reconstruction.html'), 'utf8');
  }

  console.log(`  Target HTML gathered: ${targetHtml.length} bytes`);

  // 3. Synthesize section
  const synthesisEngine = new GroundUpSynthesisEngine();
  const secRes = synthesisEngine.synthesizeSection(
    targetHtml,
    sourceUrl,
    rawCss,
    effectiveSelector,
    options.targetArchetype,
    options.htmlSnapshot,
    options.recordedInteractions,
    options.rootCssVariables
  );

  // 4. Extract HTML and body attributes
  let htmlAttrs = 'lang="en"';
  let bodyAttrs = '';
  if (options.htmlSnapshot) {
    try {
      const $snap = cheerio.load(options.htmlSnapshot);
      const snapHtml = $snap('html');
      const snapBody = $snap('body');
      const htmlClass = snapHtml.attr('class') || '';
      const htmlStyle = snapHtml.attr('style') || '';
      const htmlLang = snapHtml.attr('lang') || 'en';
      let hAttr = `lang="${htmlLang}"`;
      if (htmlClass) hAttr += ` class="${htmlClass}"`;
      if (htmlStyle) hAttr += ` style="${htmlStyle}"`;
      htmlAttrs = hAttr;

      const bodyClass = snapBody.attr('class') || '';
      const bodyStyle = snapBody.attr('style') || '';
      let bAttr = '';
      if (bodyClass) bAttr += ` class="${bodyClass}"`;
      if (bodyStyle) bAttr += ` style="${bodyStyle}"`;
      bodyAttrs = bAttr.trim();
    } catch {}
  }

  let fullHtml = `<!DOCTYPE html>
<html ${htmlAttrs}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="no-referrer">
  <title>Synthesized Section</title>
  <link rel="stylesheet" href="style.css">
</head>
<body${bodyAttrs ? ' ' + bodyAttrs : ''}>
${secRes.html}
  <script src="script.js" defer></script>
</body>
</html>`.trim();

  let fullCss = secRes.css;
  let fullJs = secRes.js;

  // 5. FidelityGuard
  try {
    const guard = new FidelityGuard();
    const guardRes = await guard.auditAndHeal({
      html: fullHtml,
      css: fullCss,
      js: fullJs,
      rawWebsiteCss: rawCss,
      rawSnapshotHtml: options.htmlSnapshot || options.sectionHtml || '',
      sourceUrl: sourceUrl,
    });
    if (guardRes.patches.length > 0) {
      console.log(`  FidelityGuard applied ${guardRes.patches.length} patches.`);
      fullHtml = guardRes.healedHtml;
      fullCss = guardRes.healedCss;
      fullJs = guardRes.healedJs;
    }
  } catch (err) {
    console.warn(`  FidelityGuard warning:`, err.message);
  }

  // 6. Write out fresh files
  const fullPageDir = path.join(jobDir, 'full-page');
  fs.mkdirSync(fullPageDir, { recursive: true });

  fs.writeFileSync(path.join(fullPageDir, 'index.html'), fullHtml, 'utf8');
  fs.writeFileSync(path.join(fullPageDir, 'style.css'), fullCss, 'utf8');
  fs.writeFileSync(path.join(fullPageDir, 'script.js'), fullJs, 'utf8');

  fs.writeFileSync(path.join(jobDir, 'reconstruction.html'), fullHtml, 'utf8');
  fs.writeFileSync(path.join(jobDir, 'reconstruction.css'), fullCss, 'utf8');

  console.log(`  ✓ Successfully updated files in ${fullPageDir}`);
}

async function main() {
  await resynthesizeJob('job_6fee83c77a7e468e');
  await resynthesizeJob('job_e5d2e10b83114c40');
  await resynthesizeJob('job_a176cf8c70844901');
  console.log('\n=== ALL TARGET JOBS RE-SYNTHESIZED SUCCESSFULLY ===\n');
}

main().catch(err => {
  console.error('Re-synthesis script failed:', err);
  process.exit(1);
});
