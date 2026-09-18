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

      $('[srcset]').each((_, el) => {
        const $el = $(el);
        const srcset = $el.attr('srcset');
        if (srcset && srcset.includes('/')) {
          const updated = srcset.split(',').map(part => {
            const trimmed = part.trim();
            if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
              return `${origin}${trimmed}`;
            }
            return trimmed;
          }).join(', ');
          $el.attr('srcset', updated);
        }
      });
      finalHtml = $.html();

      // Rewrite Apple navigation wwwDomain to relative so flyouts route through server proxy
      finalHtml = finalHtml.replace(/"wwwDomain"\s*:\s*"www\.apple\.com"/g, `"wwwDomain":""`);

      finalHtml = finalHtml.replace(/url\(\s*(['"]?)\/([^/'"][^'")]+)\1\s*\)/gi, `url("${origin}/$2")`);
      finalCss = finalCss.replace(/url\(\s*(['"]?)\/([^/'"][^'")]+)\1\s*\)/gi, `url("${origin}/$2")`);
      finalMinifiedCss = finalMinifiedCss.replace(/url\(\s*(['"]?)\/([^/'"][^'")]+)\1\s*\)/gi, `url("${origin}/$2")`);
    }

    // Sanitize CDN transform commas in URLs
    finalHtml = finalHtml.replace(/upload\/([^/"'>]+)\//gi, (m, seg) => {
      return 'upload/' + seg.replace(/,\s*/g, '%2C').replace(/,/g, '%2C').replace(/\s+/g, '') + '/';
    });
    finalCss = finalCss.replace(/upload\/([^/"'>]+)\//gi, (m, seg) => {
      return 'upload/' + seg.replace(/,\s*/g, '%2C').replace(/,/g, '%2C').replace(/\s+/g, '') + '/';
    });
    finalMinifiedCss = finalMinifiedCss.replace(/upload\/([^/"'>]+)\//gi, (m, seg) => {
      return 'upload/' + seg.replace(/,\s*/g, '%2C').replace(/,/g, '%2C').replace(/\s+/g, '') + '/';
    });

    // Clean up empty dummy picture sources that block offline image rendering
    const $cleanup = cheerio.load(finalHtml);
    $cleanup('picture source').each((_, el) => {
      const $el = $cleanup(el);
      const srcset = ($el.attr('srcset') || '').trim();
      const dataEmpty = $el.attr('data-empty');
      if (
        dataEmpty !== undefined ||
        srcset.startsWith('data:image/gif;base64') ||
        srcset.includes('R0lGODlhAQAB') ||
        srcset === ''
      ) {
        $el.remove();
      }
    });

    // Ensure every <picture> has an <img> fallback child for offline/static rendering
    $cleanup('picture').each((_, el) => {
      const $p = $cleanup(el);
      if ($p.find('img').length === 0) {
        const firstSource = $p.find('source').first();
        const srcset = (firstSource.attr('srcset') || firstSource.attr('src') || '').trim();
        if (srcset) {
          const firstUrl = srcset.split(/\s+/)[0];
          $p.append(`<img src="${firstUrl}" class="tcl-react-media__asset" alt="">`);
        }
      }
    });

    // Wire up hero animated inline videos with large.mp4 fallback and autoplay
    if (origin) {
      $cleanup('video[data-inline-media-basepath]').each((_, el) => {
        const $el = $cleanup(el);
        const basepath = $el.attr('data-inline-media-basepath');
        if (basepath && !$el.attr('src') && $el.find('source').length === 0) {
          const fullVideoUrl = `${origin}${basepath}large.mp4`;
          $el.append(`\n  <source src="${fullVideoUrl}" type="video/mp4">\n`);
          $el.attr('autoplay', '');
          $el.attr('loop', '');
          $el.attr('muted', '');
          $el.attr('playsinline', '');
        }
      });
    }

    $cleanup('[data-component-list*="InlineMedia"] .inline-media-wrapper').addClass('loaded playing');
    finalHtml = $cleanup.html();

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
      src.includes('sentry') ||
      src.includes('errlog') ||
      src.includes('location-script') ||
      src.includes('datadog') ||
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

  // Inject compatibility shim to prevent tracker errors from halting modules and route CORS APIs
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

  // Intercept CORS-restricted global nav and flyouts APIs to route through local proxy
  (function() {
    const _origFetch = window.fetch;
    if (_origFetch) {
      window.fetch = function(url, options) {
        if (typeof url === 'string') {
          if (url.includes('apple.com/api-www/')) {
            url = url.replace(/^https?:\\/\\/[^\\/]+/, '');
          }
        }
        return _origFetch.call(this, url, options);
      };
    }
  })();
  </script>`;

  if ($('head').length > 0) {
    $('head').prepend(requireShim);
    $('head').append('\n  <link rel="stylesheet" href="./style.css">\n');
  } else {
    $.root().prepend(requireShim);
    $.root().prepend('\n<link rel="stylesheet" href="./style.css">\n');
  }

  // Universal Mobile Navigation & Hamburger Toggle Shim
  const mobileNavShim = `
  <script>
  (function() {
    function initMobileNav() {
      const getElements = function(sel) { return Array.from(document.querySelectorAll(sel)); };

      document.addEventListener('click', function(e) {
        var target = e.target;
        if (!target || !(target instanceof Element)) return;

        // 1. Close Button or Overlay Click
        var closeBtn = target.closest('.mobile-menu-close, [aria-label*="close" i], [class*="close-menu"]');
        var overlay = target.closest('.mobile-overlay, [class*="menu-overlay"], [class*="backdrop"]');
        if (closeBtn || (overlay && target === overlay)) {
          getElements('.mobile-menu, [class*="mobile-nav"], [class*="nav-drawer"], [class*="mobile-sidebar"]').forEach(function(el) {
            el.classList.remove('mobile-menu-open', 'open', 'active', 'show');
          });
          getElements('.mobile-overlay, [class*="menu-overlay"], [class*="backdrop"]').forEach(function(el) {
            el.classList.remove('show', 'open', 'active');
          });
          document.body.classList.remove('menu-open', 'mobile-menu-open', 'overflow-hidden');
          return;
        }

        // 2. Hamburger / Menu Toggle Click
        var toggleBtn = target.closest(
          '.mobile-menu-btn, button[class*="hamburger"], button[aria-label*="menu" i], button[aria-label*="navigation" i], [class*="menu-trigger"], [class*="nav-toggle"]'
        );
        if (toggleBtn) {
          e.preventDefault();
          e.stopPropagation();
          var menus = getElements('.mobile-menu, [class*="mobile-nav"], [class*="nav-drawer"], [class*="mobile-sidebar"]');
          var overlays = getElements('.mobile-overlay, [class*="menu-overlay"], [class*="backdrop"]');
          var willOpen = !menus.some(function(m) {
            return m.classList.contains('mobile-menu-open') || m.classList.contains('open');
          });

          menus.forEach(function(m) {
            m.classList.toggle('mobile-menu-open', willOpen);
            m.classList.toggle('open', willOpen);
            m.classList.toggle('active', willOpen);
          });
          overlays.forEach(function(o) {
            o.classList.toggle('show', willOpen);
            o.classList.toggle('open', willOpen);
            o.classList.toggle('active', willOpen);
          });
          document.body.classList.toggle('menu-open', willOpen);
          toggleBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
          return;
        }

        // 3. Mobile Navigation Accordion Sub-links
        var subNavBtn = target.closest('.mobile-nav-item > button, .mobile-nav-link');
        if (subNavBtn && subNavBtn.tagName === 'BUTTON') {
          var next = subNavBtn.nextElementSibling;
          if (next) {
            e.preventDefault();
            next.classList.toggle('hidden');
            next.classList.toggle('open');
          }
        }

        // 4. Cookie Banner & Consent Dismiss Click
        var cookieBtn = target.closest(
          '.tds-btn--cookie, [class*="cookie"] button, button[class*="cookie"], [id*="cookie"] button, [data-cookie-action], .cookie-settings-url'
        );
        if (cookieBtn) {
          var banner = cookieBtn.closest('.cookie-banner, [class*="cookie-banner"], [class*="cookie-consent"], [id*="cookie-banner"]');
          if (banner) {
            banner.style.display = 'none';
          }
          return;
        }
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initMobileNav);
    } else {
      initMobileNav();
    }
  })();
  </script>`;

  // Universal Media Gallery & Carousel Controller (Offline & file:/// support)
  const carouselShim = `
  <script>
  (function() {
    function initMediaGalleries() {
      const galleries = document.querySelectorAll('.media-gallery, [class*="gallery-container"]');
      galleries.forEach(function(gallery) {
        const items = Array.from(gallery.querySelectorAll('.media-gallery-item, [role="tabpanel"]'));
        if (items.length <= 1) return;

        const triggers = Array.from(gallery.querySelectorAll('.media-gallery-dotnav-link, .dotnav-link, [role="tab"]'));
        let currentIndex = 0;
        let autoPlayTimer = null;

        function updateGallery(index) {
          currentIndex = (index + items.length) % items.length;
          items.forEach(function(item, idx) {
            const offset = idx - currentIndex;
            item.style.position = 'absolute';
            item.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.6s ease';
            item.style.transform = 'translate3d(' + (offset * 105) + '%, 0, 0)';
            item.style.opacity = Math.abs(offset) > 2 ? '0' : '1';
            item.style.pointerEvents = offset === 0 ? 'auto' : 'none';
            if (offset === 0) {
              item.classList.add('current-item');
              item.setAttribute('aria-hidden', 'false');
            } else {
              item.classList.remove('current-item');
              item.setAttribute('aria-hidden', 'true');
            }
          });

          triggers.forEach(function(trigger, idx) {
            const parent = trigger.parentElement;
            if (idx === currentIndex) {
              trigger.classList.add('current');
              trigger.setAttribute('aria-selected', 'true');
              if (parent) parent.classList.add('current');
            } else {
              trigger.classList.remove('current');
              trigger.setAttribute('aria-selected', 'false');
              if (parent) parent.classList.remove('current');
            }
          });
        }

        updateGallery(0);

        triggers.forEach(function(trigger, idx) {
          trigger.addEventListener('click', function(e) {
            e.preventDefault();
            updateGallery(idx);
            resetAutoPlay();
          });
        });

        function startAutoPlay() {
          autoPlayTimer = setInterval(function() {
            updateGallery(currentIndex + 1);
          }, 4500);
        }
        function resetAutoPlay() {
          if (autoPlayTimer) clearInterval(autoPlayTimer);
          startAutoPlay();
        }

        gallery.addEventListener('mouseenter', function() {
          if (autoPlayTimer) clearInterval(autoPlayTimer);
        });
        gallery.addEventListener('mouseleave', function() {
          resetAutoPlay();
        });

        startAutoPlay();
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initMediaGalleries);
    } else {
      initMediaGalleries();
    }
  })();
  </script>`;

  if ($('body').length > 0) {
    $('body').append('\n  <script src="./script.js" defer></script>\n' + mobileNavShim + '\n' + carouselShim + '\n');
  } else {
    $.root().append('\n<script src="./script.js" defer></script>\n' + mobileNavShim + '\n' + carouselShim + '\n');
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
