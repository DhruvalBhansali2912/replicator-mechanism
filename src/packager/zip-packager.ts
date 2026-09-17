import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { ExtractionResult } from '../crawler/page-extractor.js';
import { AssetLocalizer } from '../localizer/asset-localizer.js';
import { ExtractionOptions, JobState, SectionMetadata } from '../types.js';
import { CONFIG } from '../config.js';
import * as cheerio from 'cheerio';

const REPLICATOR_NAV_PATCH_CSS = `
/* Replicator Mobile Navigation Drilldown Glitch Fix */
@media (max-width: 833px) {
  #globalnav.globalnav-with-submenu-open .globalnav-submenu-trigger-group,
  #globalnav.globalnav-with-submenu-open .globalnav-submenu-trigger-link,
  #globalnav.globalnav-with-submenu-open .globalnav-item:not(.globalnav-item-flyout-open):not(.globalnav-item-flyout-change-next) .globalnav-link,
  #globalnav.globalnav-with-submenu-open .globalnav-item-menu:not(.globalnav-item-flyout-open):not(.globalnav-item-flyout-change-next) {
    display: none !important;
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }
  #globalnav.globalnav-with-submenu-open .globalnav-item-flyout-open > .globalnav-flyout,
  #globalnav.globalnav-with-submenu-open .globalnav-item-flyout-change-next > .globalnav-flyout {
    display: block !important;
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
    transform: none !important;
  }
  #globalnav.globalnav-with-submenu-open .globalnav-item-flyout-open > .globalnav-flyout .globalnav-submenu-list-item,
  #globalnav.globalnav-with-submenu-open .globalnav-item-flyout-change-next > .globalnav-flyout .globalnav-submenu-list-item,
  #globalnav.globalnav-with-submenu-open .globalnav-item-flyout-open > .globalnav-flyout .globalnav-submenu-header,
  #globalnav.globalnav-with-submenu-open .globalnav-item-flyout-change-next > .globalnav-flyout .globalnav-submenu-header {
    opacity: 1 !important;
    transform: none !important;
    visibility: visible !important;
  }
  #globalnav.globalnav-with-submenu-open .globalnav-menuback {
    display: block !important;
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
    transform: none !important;
  }
}
`;

export class ZipPackager {
  private localizer = new AssetLocalizer();

  public async packageJob(
    jobId: string,
    url: string,
    options: ExtractionOptions,
    result: ExtractionResult
  ): Promise<{ jobDir: string; zipPath: string; sectionsMeta: SectionMetadata[] }> {
    const jobDir = path.join(CONFIG.jobsDir, jobId);
    const fullPageDir = path.join(jobDir, 'full-page');
    const sectionsDir = path.join(jobDir, 'sections');
    const assetsDir = path.join(fullPageDir, 'assets');

    // Create directories
    fs.mkdirSync(fullPageDir, { recursive: true });
    fs.mkdirSync(sectionsDir, { recursive: true });
    fs.mkdirSync(assetsDir, { recursive: true });

    // Persist job metadata so url and options survive server restarts
    fs.writeFileSync(
      path.join(jobDir, 'job.json'),
      JSON.stringify({ id: jobId, url, options, completedAt: new Date().toISOString() }, null, 2),
      'utf8'
    );

    // 1. Localize assets for full-page
    let finalHtml = result.transformedHtml;
    let finalCss = result.transformedCss;
    let finalMinifiedCss = result.minifiedCss;

    if (options.localizeAssets !== false) {
      const localization = await this.localizer.localize(finalHtml, finalCss, url, assetsDir);
      finalHtml = localization.html;
      finalCss = localization.css;
      finalMinifiedCss = this.localizer.rewriteCssUrls(result.minifiedCss, url);
    }

    if (finalCss.includes('globalnav') || finalHtml.includes('globalnav')) {
      finalCss += '\n' + REPLICATOR_NAV_PATCH_CSS;
      finalMinifiedCss += '\n' + REPLICATOR_NAV_PATCH_CSS;
    }

    // Canonicalize any remaining unlocalized root-relative URLs (/assets, /fonts) to original origin
    let origin = '';
    try {
      origin = new URL(url).origin;
    } catch {}

    if (origin) {
      const $ = cheerio.load(finalHtml);
      $('[src^="/"], [href^="/"], [poster^="/"]').each((_, el) => {
        const $el = $(el);
        const src = $el.attr('src');
        if (src && src.startsWith('/') && !src.startsWith('//')) {
          $el.attr('src', `${origin}${src}`);
        }
        const href = $el.attr('href');
        if (href && href.startsWith('/') && !href.startsWith('//')) {
          $el.attr('href', `${origin}${href}`);
        }
        const poster = $el.attr('poster');
        if (poster && poster.startsWith('/') && !poster.startsWith('//')) {
          $el.attr('poster', `${origin}${poster}`);
        }
      });
      finalHtml = $.html();

      finalHtml = finalHtml.replace(/url\(\s*(['"]?)\/([^/'"][^'")]+)\1\s*\)/gi, `url("${origin}/$2")`);
      finalCss = finalCss.replace(/url\(\s*(['"]?)\/([^/'"][^'")]+)\1\s*\)/gi, `url("${origin}/$2")`);
      finalMinifiedCss = finalMinifiedCss.replace(/url\(\s*(['"]?)\/([^/'"][^'")]+)\1\s*\)/gi, `url("${origin}/$2")`);
    }

    // Embed links to style.css and script.js in full-page index.html, remove redundant external css links
    finalHtml = injectStylesAndScripts(finalHtml);

    // Save full page files
    fs.writeFileSync(path.join(fullPageDir, 'index.html'), finalHtml, 'utf8');
    fs.writeFileSync(path.join(fullPageDir, 'style.css'), finalCss, 'utf8');
    fs.writeFileSync(path.join(fullPageDir, 'style.min.css'), finalMinifiedCss, 'utf8');
    fs.writeFileSync(path.join(fullPageDir, 'script.js'), result.transformedJs, 'utf8');
    fs.writeFileSync(path.join(fullPageDir, 'full-page.png'), result.fullPageScreenshot);

    // 2. Save individual sections
    const updatedSectionsMeta: SectionMetadata[] = [];

    for (const sec of result.sections) {
      const secFolderName = `${sec.meta.id}-${sec.meta.archetype}`;
      const secDir = path.join(sectionsDir, secFolderName);
      fs.mkdirSync(secDir, { recursive: true });

      let secCss = sec.purgedCss;
      let secMinCss = sec.minifiedCss;
      if (secCss.includes('globalnav') || sec.cleanedHtml.includes('globalnav')) {
        secCss += '\n' + REPLICATOR_NAV_PATCH_CSS;
        secMinCss += '\n' + REPLICATOR_NAV_PATCH_CSS;
      }

      // Save HTML, CSS, JS
      fs.writeFileSync(path.join(secDir, 'section.html'), sec.cleanedHtml, 'utf8');
      fs.writeFileSync(path.join(secDir, 'section.css'), secCss, 'utf8');
      fs.writeFileSync(path.join(secDir, 'section.min.css'), secMinCss, 'utf8');
      fs.writeFileSync(path.join(secDir, 'section.js'), sec.scopedJs, 'utf8');

      // Standalone preview HTML for this section
      const standaloneHtml = generateStandaloneSectionHtml(sec.meta.name, sec.cleanedHtml, secCss, sec.scopedJs);
      fs.writeFileSync(path.join(secDir, 'preview.html'), standaloneHtml, 'utf8');

      // Screenshot
      if (sec.screenshotBuffer) {
        fs.writeFileSync(path.join(secDir, 'screenshot.png'), sec.screenshotBuffer);
        sec.meta.screenshotPath = `/api/jobs/${jobId}/sections/${sec.meta.id}/screenshot`;
      }

      // Metadata JSON
      fs.writeFileSync(
        path.join(secDir, 'metadata.json'),
        JSON.stringify(
          {
            ...sec.meta,
            classMapping: sec.classMapping,
            idMapping: sec.idMapping,
          },
          null,
          2
        ),
        'utf8'
      );

      updatedSectionsMeta.push(sec.meta);
    }

    // 3. Generate summary report.json
    const report = {
      jobId,
      url,
      timestamp: new Date().toISOString(),
      sectionCount: result.sections.length,
      sections: updatedSectionsMeta,
      metrics: {
        originalHtmlBytes: Buffer.byteLength(result.originalHtml, 'utf8'),
        transformedHtmlBytes: Buffer.byteLength(finalHtml, 'utf8'),
        originalCssBytes: Buffer.byteLength(result.originalCss, 'utf8'),
        transformedCssBytes: Buffer.byteLength(finalCss, 'utf8'),
        minifiedCssBytes: Buffer.byteLength(result.minifiedCss, 'utf8'),
        purgedReductionPercent: Math.round(
          (1 - Buffer.byteLength(result.minifiedCss, 'utf8') / (Buffer.byteLength(result.originalCss, 'utf8') || 1)) * 100
        ),
        assetsCount: result.assetCount,
      },
    };
    fs.writeFileSync(path.join(jobDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');

    // 4. Create ZIP archive
    const zipPath = path.join(jobDir, 'site-package.zip');
    await createZip(jobDir, zipPath);

    return {
      jobDir,
      zipPath,
      sectionsMeta: updatedSectionsMeta,
    };
  }
}

function injectStylesAndScripts(html: string): string {
  const $ = cheerio.load(html);

  // Remove existing stylesheet links since all styles are now merged into style.css
  $('link[rel="stylesheet"]').remove();
  $('script[src="./script.js"]').remove();

  // Remove rogue trackers and SPA application bundles that break offline/static previews
  $('script').each((_, el) => {
    const $s = $(el);
    const src = ($s.attr('src') || '').toLowerCase();
    const content = $s.html() || '';
    if (
      src.includes('tawk') ||
      src.includes('twk-') ||
      src.includes('munchkin') ||
      src.includes('oaiq') ||
      src.includes('apollo') ||
      src.includes('gtm') ||
      src.includes('googletagmanager') ||
      src.includes('facebook') ||
      src.includes('launch-') ||
      /index-[a-z0-9_-]+\.js/i.test(src) ||
      content.includes('gtag(') ||
      content.includes('dataLayer') ||
      content.includes('Munchkin.init') ||
      content.includes('oaiq')
    ) {
      $s.remove();
    }
  });

  // Remove modulepreloads for those same chunks
  $('link[rel="modulepreload"]').each((_, el) => {
    const href = ($(el).attr('href') || '').toLowerCase();
    if (
      href.includes('tawk') ||
      href.includes('twk-') ||
      /index-[a-z0-9_-]+\.js/i.test(href)
    ) {
      $(el).remove();
    }
  });

  // Inject require compatibility shim to prevent tracker errors from halting modules
  const requireShim = `
  <script>
  window.require = window.require || function() {
    return {
      passiveTracker: function() { return { record: function() {} }; },
      register: function() {},
      track: function() {},
      beacon: function() {}
    };
  };
  globalThis.require = window.require;
  </script>`;

  if ($('head').length > 0) {
    $('head').prepend(requireShim);
    $('head').append('\n  <link rel="stylesheet" href="./style.css">\n');
  } else {
    $.root().prepend(requireShim);
    $.root().prepend('\n<link rel="stylesheet" href="./style.css">\n');
  }

  if ($('body').length > 0) {
    $('body').append('\n  <script src="./script.js" defer></script>\n');
  } else {
    $.root().append('\n<script src="./script.js" defer></script>\n');
  }

  let finalHtmlStr = $.html();
  if (!finalHtmlStr.trim().toLowerCase().startsWith('<!doctype html>')) {
    finalHtmlStr = '<!DOCTYPE html>\n' + finalHtmlStr;
  }

  return finalHtmlStr;
}

function generateStandaloneSectionHtml(title: string, html: string, css: string, js: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Standalone Section Preview</title>
  <style>
    /* Reset & Base */
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    ${css}
  </style>
</head>
<body>
  ${html}

  <script>
    ${js}
  </script>
</body>
</html>`;
}

function createZip(sourceDir: string, outZipPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outZipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', (err) => reject(err));

    archive.pipe(output);

    // Append full-page and sections
    archive.directory(path.join(sourceDir, 'full-page'), 'full-page');
    archive.directory(path.join(sourceDir, 'sections'), 'sections');
    archive.file(path.join(sourceDir, 'report.json'), { name: 'report.json' });

    archive.finalize();
  });
}
