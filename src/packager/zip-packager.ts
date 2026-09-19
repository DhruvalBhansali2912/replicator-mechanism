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

const REPLICATOR_GLOBAL_PATCH_CSS = `
/* Universal cleanup of obstructive cookie consent banners, geo/locale modals, and promotional overlays */
.cookie-banner, [class*="cookie-banner"], [class*="cookie-consent"], [id*="cookie-consent"], #onetrust-banner-sdk, #truste-consent-track,
.dx-mini-locale-selector__container, [class*="mini-locale-selector"], [class*="locale-selector__container"],
[class*="country-selector__container"], [class*="region-selector__container"], [class*="geo-selector"],
[id*="locale-selector"], [id*="country-selector"], [class*="country-picker-modal"], [class*="location-prompt"],
.tds-locale-selector-country, .tds-locale-selector-region, .tds-locale-selector-superregion {
  display: none !important;
}
`;

export class ZipPackager {
  private localizer = new AssetLocalizer();

  public async packageJob(
    jobId: string,
    url: string,
    options: ExtractionOptions,
    result: ExtractionResult,
    apiKey?: string
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
    const completedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + CONFIG.jobRetentionHours * 60 * 60 * 1000).toISOString();
    fs.writeFileSync(
      path.join(jobDir, 'job.json'),
      JSON.stringify(
        {
          id: jobId,
          url,
          apiKey: apiKey || (options as any).apiKey,
          options,
          sectionCount: result.sections.length,
          completedAt,
          expiresAt,
        },
        null,
        2
      ),
      'utf8'
    );

    // Strip <base> tags so all relative paths (./assets, ./style.css, ./script.js) resolve locally
    let finalHtml = result.transformedHtml.replace(/<base[^>]*>/gi, '');
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

    finalCss += '\n' + REPLICATOR_GLOBAL_PATCH_CSS;
    finalMinifiedCss += '\n' + REPLICATOR_GLOBAL_PATCH_CSS;

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
    $cleanup(`
      .cookie-banner, [class*="cookie-banner"], [class*="cookie-consent"], [id*="cookie-consent"], #onetrust-banner-sdk, #truste-consent-track,
      .dx-mini-locale-selector__container, [class*="mini-locale-selector"], [class*="locale-selector__container"],
      [class*="country-selector__container"], [class*="region-selector__container"], [class*="geo-selector"],
      [id*="locale-selector"], [id*="country-selector"], [class*="country-picker-modal"], [class*="location-prompt"]
    `).remove();
    finalHtml = $cleanup.html();

    // Embed links to style.css and script.js in full-page index.html, remove redundant external css links
    finalHtml = injectStylesAndScripts(finalHtml);

    // Ensure combined script is safely isolated in its own functional scope
    let transformedJs = result.transformedJs || '';
    if (transformedJs && !transformedJs.startsWith('(function()')) {
      transformedJs = `(function() {\n  try {\n${transformedJs}\n  } catch (err) {\n    console.warn('Script initialization caught:', err);\n  }\n})();`;
    }

    // Save full page files
    fs.writeFileSync(path.join(fullPageDir, 'index.html'), finalHtml, 'utf8');
    fs.writeFileSync(path.join(fullPageDir, 'style.css'), finalCss, 'utf8');
    fs.writeFileSync(path.join(fullPageDir, 'style.min.css'), finalMinifiedCss, 'utf8');
    fs.writeFileSync(path.join(fullPageDir, 'script.js'), transformedJs, 'utf8');
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
  $('link[rel="manifest"]').remove();
  $('script[src="./script.js"]').remove();
  $('base').remove();

  // Universal removal of obstructive locale modals
  $('.dx-mini-locale-selector__container, [class*="mini-locale-selector"], [class*="locale-selector__container"]').remove();

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
      src.includes('akamai') ||
      src.includes('_bm') ||
      src.includes('_sec') ||
      src.includes('chat-config') ||
      src.includes('help-me-charge') ||
      src.includes('cuaverse') ||
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
      href.includes('akamai') ||
      href.includes('_bm') ||
      href.includes('_sec') ||
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

  // Intercept CORS-restricted and internal API calls to prevent unhandled network exceptions
  (function() {
    const _origFetch = window.fetch;
    if (_origFetch) {
      window.fetch = function(url, options) {
        if (typeof url === 'string') {
          if (url.includes('apple.com/api-www/')) {
            url = url.replace(/^https?:\\/\\/[^\\/]+/, '');
          }
          if (
            url.includes('_sec/') ||
            url.includes('_bm/') ||
            url.includes('chat-config') ||
            url.includes('help-me-charge') ||
            url.includes('cuaverse') ||
            url.includes('datadog')
          ) {
            return Promise.resolve(new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }));
          }
        }
        return _origFetch.call(this, url, options).catch(function() {
          return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
        });
      };
    }

    if (window.XMLHttpRequest) {
      const _origOpen = XMLHttpRequest.prototype.open;
      const _origSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function(method, url) {
        this._reqUrl = typeof url === 'string' ? url : '';
        return _origOpen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function() {
        var u = (this._reqUrl || '').toLowerCase();
        if (
          u.includes('_sec/') ||
          u.includes('_bm/') ||
          u.includes('chat-config') ||
          u.includes('help-me-charge') ||
          u.includes('cuaverse')
        ) {
          var self = this;
          setTimeout(function() {
            try {
              Object.defineProperty(self, 'readyState', { value: 4, writable: true });
              Object.defineProperty(self, 'status', { value: 200, writable: true });
              Object.defineProperty(self, 'responseText', { value: '{}', writable: true });
              if (typeof self.onreadystatechange === 'function') self.onreadystatechange();
              if (typeof self.onload === 'function') self.onload();
            } catch(e) {}
          }, 10);
          return;
        }
        return _origSend.apply(this, arguments);
      };
    }
  })();

  // Universal Framework & React Safety Stub
  window.React = window.React || {};
  if (!window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
    window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
      ReactCurrentDispatcher: { current: null },
      ReactCurrentBatchConfig: { transition: null },
      ReactCurrentOwner: { current: null },
      assign: Object.assign
    };
  }
  window.ReactDOM = window.ReactDOM || {
    createRoot: function() { return { render: function() {}, unmount: function() {} }; },
    render: function() {},
    hydrate: function() {}
  };

  // Universal Cookie Banner & Modal Dismiss Handler (Runs in capture phase before frameworks mount)
  document.addEventListener('click', function(e) {
    var btn = e.target && e.target.closest ? e.target.closest(
      '.tds-btn--cookie, [class*="cookie"] button, button[class*="cookie"], [id*="cookie"] button, [data-cookie-action], .cookie-settings-url, .dx-mini-locale-selector__close-icon-button, [class*="locale-selector"] button, [class*="country-selector"] button, [class*="modal-close"], [aria-label*="close" i]'
    ) : null;
    if (btn) {
      var banner = btn.closest(
        '.cookie-banner, [class*="cookie-banner"]:not([class*="--"]), [class*="cookie-consent"], [id*="cookie-banner"], [class*="cookie-modal"], .dx-mini-locale-selector__container, [class*="locale-selector"], [class*="country-selector"], [class*="geo-selector"]'
      );
      if (banner) {
        banner.style.setProperty('display', 'none', 'important');
      }
    }
  }, true);
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
          var banner = cookieBtn.closest('.cookie-banner') || cookieBtn.closest('[class*="cookie-banner"]:not([class*="--"])') || cookieBtn.closest('[class*="cookie-consent"], [id*="cookie-banner"], [class*="cookie-modal"]');
          if (banner) {
            banner.style.setProperty('display', 'none', 'important');
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

  // Universal Media Gallery & Carousel Controller (Offline, Mobile & Universal Support)
  const carouselShim = `
  <script>
  (function() {
    function initUniversalCarousels() {
      // 1. Universal Stacked / Fade / Active-Class Carousels (e.g. Tesla Hero, Apple Media Gallery, Swiper Fade, Slick)
      const stackedCarousels = document.querySelectorAll(
        '.tcl-flex-module-carousel--homepage_hero_carousel, .tcl-flex-module-stacked-carousel, .media-gallery, [class*="gallery-container"], [class*="stacked-carousel"], [class*="carousel-fade"]'
      );

      stackedCarousels.forEach(function(carousel) {
        if (carousel.hasAttribute('data-rep-init')) return;
        carousel.setAttribute('data-rep-init', 'true');

        const slides = Array.from(
          carousel.querySelectorAll('.tcl-flex-module-carousel__slide, .media-gallery-item, [role="tabpanel"], [class*="__slide"]')
        ).filter(function(el) {
          return !el.closest('.tcl-freeflow-carousel') && !el.closest('[class*="freeflow"]');
        });

        if (slides.length <= 1) return;

        const isAppleGallery = carousel.classList.contains('media-gallery') || carousel.querySelector('.media-gallery-item');
        const allTabLists = Array.from(carousel.querySelectorAll('.tds-tab-list--dots, .tcl-carousel__tab-list, .media-gallery-dotnav, [role="tablist"], [class*="dot-list"]'));
        const nextBtns = Array.from(carousel.querySelectorAll('.tcl-carousel__nav--inline-end, [aria-label*="next" i], [class*="nav-next"], button[class*="next"]'));
        const prevBtns = Array.from(carousel.querySelectorAll('.tcl-carousel__nav--inline-start, [aria-label*="prev" i], [aria-label*="previous" i], [class*="nav-prev"], button[class*="prev"]'));

        let currentIndex = 0;
        slides.forEach(function(s, idx) {
          if (
            s.classList.contains('tcl-flex-module-carousel__slide--active') ||
            s.classList.contains('active') ||
            s.classList.contains('current-item')
          ) {
            currentIndex = idx;
          }
        });

        let autoPlayTimer = null;

        function updateStackedGallery(index) {
          currentIndex = (index + slides.length) % slides.length;
          slides.forEach(function(item, idx) {
            const offset = idx - currentIndex;
            const isActive = idx === currentIndex;

            item.classList.toggle('tcl-flex-module-carousel__slide--active', isActive);
            item.classList.toggle('current-item', isActive);
            item.classList.toggle('active', isActive);
            item.setAttribute('aria-hidden', isActive ? 'false' : 'true');

            if (isAppleGallery) {
              item.style.position = 'absolute';
              item.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.6s ease';
              item.style.transform = 'translate3d(' + (offset * 105) + '%, 0, 0)';
              item.style.opacity = Math.abs(offset) > 2 ? '0' : '1';
              item.style.pointerEvents = isActive ? 'auto' : 'none';
            } else {
              item.style.position = 'absolute';
              item.style.transition = 'opacity 0.6s ease, visibility 0.6s ease';
              item.style.opacity = isActive ? '1' : '0';
              item.style.visibility = isActive ? 'visible' : 'hidden';
              item.style.pointerEvents = isActive ? 'auto' : 'none';
              item.style.zIndex = isActive ? '2' : '1';
            }
          });

          allTabLists.forEach(function(tabList) {
            const dots = Array.from(tabList.querySelectorAll('.tds-tab, [role="tab"], .media-gallery-dotnav-link, .dotnav-link, button'));
            dots.forEach(function(trigger, idx) {
              const isSelected = idx === currentIndex;
              trigger.setAttribute('aria-selected', isSelected ? 'true' : 'false');
              trigger.classList.toggle('current', isSelected);
              trigger.classList.toggle('active', isSelected);
              trigger.classList.toggle('tds-tab--selected', isSelected);
              if (trigger.parentElement) {
                trigger.parentElement.classList.toggle('current', isSelected);
                trigger.parentElement.classList.toggle('active', isSelected);
              }
            });
          });
        }

        updateStackedGallery(currentIndex);

        nextBtns.forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            updateStackedGallery(currentIndex + 1);
            resetAutoPlay();
          });
        });

        prevBtns.forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            updateStackedGallery(currentIndex - 1);
            resetAutoPlay();
          });
        });

        allTabLists.forEach(function(tabList) {
          const dots = Array.from(tabList.querySelectorAll('.tds-tab, [role="tab"], .media-gallery-dotnav-link, .dotnav-link, button'));
          dots.forEach(function(trigger, idx) {
            trigger.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              updateStackedGallery(idx);
              resetAutoPlay();
            });
          });
        });

        function startAutoPlay() {
          autoPlayTimer = setInterval(function() {
            updateStackedGallery(currentIndex + 1);
          }, 5000);
        }
        function resetAutoPlay() {
          if (autoPlayTimer) clearInterval(autoPlayTimer);
          startAutoPlay();
        }

        carousel.addEventListener('mouseenter', function() {
          if (autoPlayTimer) clearInterval(autoPlayTimer);
        });
        carousel.addEventListener('mouseleave', function() {
          resetAutoPlay();
        });

        startAutoPlay();
      });

      // 2. Universal Horizontal Freeflow & Scroll-Snap Carousels (e.g. Tesla Product Grids, E-Commerce Rows)
      const freeflowContainers = document.querySelectorAll(
        '.tcl-freeflow-carousel__container, [class*="freeflow-carousel__container"], .tcl-freeflow-carousel, [class*="horizontal-carousel"]'
      );

      freeflowContainers.forEach(function(container) {
        if (container.hasAttribute('data-rep-ff-init')) return;
        container.setAttribute('data-rep-ff-init', 'true');

        const scrollEl = container.classList.contains('tcl-freeflow-carousel')
          ? container
          : (container.querySelector('.tcl-freeflow-carousel, [class*="freeflow-carousel"]:not([class*="__container"])') || container);

        const slides = Array.from(
          container.querySelectorAll('.tcl-freeflow-carousel-container__slide-container, [class*="slide-container"], [class*="carousel-card"]')
        );
        if (slides.length <= 1) return;

        const tabLists = Array.from(container.querySelectorAll('.tds-tab-list--dots, .tcl-carousel__tab-list, [role="tablist"], [class*="dot-list"]'));
        const nextBtns = Array.from(container.querySelectorAll('.tcl-carousel__nav--inline-end, [aria-label*="next" i], [class*="nav-next"], button[class*="next"]'));
        const prevBtns = Array.from(container.querySelectorAll('.tcl-carousel__nav--inline-start, [aria-label*="prev" i], [aria-label*="previous" i], [class*="nav-prev"], button[class*="prev"]'));

        let currentIndex = 0;
        slides.forEach(function(s, idx) {
          if (
            s.classList.contains('tcl-freeflow-carousel-container__slide-container--active') ||
            s.classList.contains('active')
          ) {
            currentIndex = idx;
          }
        });

        function scrollToSlide(index) {
          currentIndex = Math.max(0, Math.min(index, slides.length - 1));

          slides.forEach(function(slide, idx) {
            const isActive = idx === currentIndex;
            slide.classList.toggle('tcl-freeflow-carousel-container__slide-container--active', isActive);
            slide.classList.toggle('active', isActive);
          });

          const targetSlide = slides[currentIndex];
          if (targetSlide && scrollEl) {
            const targetLeft = targetSlide.offsetLeft - (scrollEl.clientWidth - targetSlide.clientWidth) / 2;
            if (typeof scrollEl.scrollTo === 'function') {
              scrollEl.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
            } else {
              scrollEl.scrollLeft = Math.max(0, targetLeft);
            }
          }

          tabLists.forEach(function(tabList) {
            const dots = Array.from(tabList.querySelectorAll('.tds-tab, [role="tab"], button'));
            dots.forEach(function(dot, idx) {
              const isSelected = idx === currentIndex;
              dot.setAttribute('aria-selected', isSelected ? 'true' : 'false');
              dot.classList.toggle('active', isSelected);
              dot.classList.toggle('current', isSelected);
              dot.classList.toggle('tds-tab--selected', isSelected);
              if (dot.parentElement) {
                dot.parentElement.classList.toggle('active', isSelected);
                dot.parentElement.classList.toggle('current', isSelected);
              }
            });
          });
        }

        scrollToSlide(currentIndex);

        nextBtns.forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            scrollToSlide((currentIndex + 1) % slides.length);
          });
        });

        prevBtns.forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            scrollToSlide((currentIndex - 1 + slides.length) % slides.length);
          });
        });

        tabLists.forEach(function(tabList) {
          const dots = Array.from(tabList.querySelectorAll('.tds-tab, [role="tab"], button'));
          dots.forEach(function(dot, idx) {
            dot.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              scrollToSlide(idx);
            });
          });
        });

        slides.forEach(function(slide, idx) {
          slide.addEventListener('click', function() {
            if (idx !== currentIndex) {
              scrollToSlide(idx);
            }
          });
        });

        // Sync active slide and dots on manual user swipe/scroll
        let scrollTimeout = null;
        scrollEl.addEventListener('scroll', function() {
          if (scrollTimeout) cancelAnimationFrame(scrollTimeout);
          scrollTimeout = requestAnimationFrame(function() {
            const containerCenter = scrollEl.scrollLeft + scrollEl.clientWidth / 2;
            let closestIdx = currentIndex;
            let minDiff = Infinity;

            slides.forEach(function(slide, idx) {
              const slideCenter = slide.offsetLeft + slide.clientWidth / 2;
              const diff = Math.abs(containerCenter - slideCenter);
              if (diff < minDiff) {
                minDiff = diff;
                closestIdx = idx;
              }
            });

            if (closestIdx !== currentIndex) {
              currentIndex = closestIdx;
              slides.forEach(function(slide, idx) {
                const isActive = idx === currentIndex;
                slide.classList.toggle('tcl-freeflow-carousel-container__slide-container--active', isActive);
                slide.classList.toggle('active', isActive);
              });
              tabLists.forEach(function(tabList) {
                const dots = Array.from(tabList.querySelectorAll('.tds-tab, [role="tab"], button'));
                dots.forEach(function(dot, idx) {
                  const isSelected = idx === currentIndex;
                  dot.setAttribute('aria-selected', isSelected ? 'true' : 'false');
                  dot.classList.toggle('active', isSelected);
                  dot.classList.toggle('current', isSelected);
                  dot.classList.toggle('tds-tab--selected', isSelected);
                });
              });
            }
          });
        }, { passive: true });
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initUniversalCarousels);
    } else {
      initUniversalCarousels();
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
