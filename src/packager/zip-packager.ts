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
/* Universal page scroll restoration across desktop and mobile */
html, body {
  overflow-x: hidden !important;
  overflow-y: auto !important;
  height: auto !important;
  min-height: 100% !important;
}

body.tds-modal--is-open,
body.tds-site-header-panel--is-open {
  overflow-y: auto !important;
}

body.menu-open {
  overflow: hidden !important;
}

/* Universal cleanup of obstructive cookie consent banners, geo/locale modals, and promotional overlays */
.cookie-banner, [class*="cookie-banner"], [class*="cookie-consent"], [id*="cookie-consent"], #onetrust-banner-sdk, #truste-consent-track,
.dx-mini-locale-selector__container, [class*="mini-locale-selector"], [class*="locale-selector__container"],
[class*="country-selector__container"], [class*="region-selector__container"], [class*="geo-selector"],
[id*="locale-selector"], [id*="country-selector"], [class*="country-picker-modal"], [class*="location-prompt"],
.tds-locale-selector-country, .tds-locale-selector-region, .tds-locale-selector-superregion {
  display: none !important;
}

/* Ensure Header and Nav Items stay above any background dialogs */
header, #tds-site-header, .tds-site-header, .tds-site-nav-items {
  position: relative !important;
  z-index: 600 !important;
}

/* Universal Desktop Mega-Menu: Hide completely when closed */
dialog.tds-site-header-panel:not([open]):not(.open):not(.mobile-open),
dialog.dx-mega-menu-panel:not([open]):not(.open):not(.mobile-open) {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
  z-index: -1 !important;
}

/* Universal Desktop Mega-Menu: Show ONLY when open */
dialog.tds-site-header-panel[open],
dialog.dx-mega-menu-panel[open],
dialog.tds-site-header-panel.open,
dialog.dx-mega-menu-panel.open {
  transform: translateY(0px) !important;
  display: block !important;
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
  z-index: 500 !important;
  position: absolute !important;
  top: 0px !important;
  left: 0px !important;
  right: 0px !important;
  width: 100% !important;
  max-width: 100% !important;
  height: auto !important;
  max-height: none !important;
  overflow: visible !important;
  background-color: #ffffff !important;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important;
}

/* Hide mobile-specific header/close elements on desktop */
@media (min-width: 1024px) {
  .tds-panel-mobile-header,
  .tds-panel-mobile-close {
    display: none !important;
    pointer-events: none !important;
  }
}

/* Neutralize the slide-out transform on the header wrapper when menu is active or hovered */
.dx-mega-menu,
.dx-mega-menu.dx-mega-menu__slide-out,
.dx-mega-menu.dx-mega-menu__slide-top {
  top: 0px !important;
}

/* Remove blocking white pseudo-element overlay on mega-menu */
.dx-mega-menu::after,
.dx-mega-menu.dx-mega-menu__slide-in::after,
.dx-mega-menu.dx-mega-menu__slide-out::after,
.tds-menu-header-sticky .dx-mega-menu::after,
.tds-theme--replicant .tds-modal::after,
.tds-theme--replicant .tds-modal::before {
  display: none !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

/* Ensure mega-menu panel container fits content naturally without inner scrollbars */
.dx-mega-menu .tds-site-header-panel-content,
.tds-site-header-panel-content {
  height: auto !important;
  min-height: fit-content !important;
  max-height: none !important;
  overflow: visible !important;
  transform: translateY(0px) !important;
  padding-top: 64px !important;
  padding-bottom: 24px !important;
}

.dx-mega-menu-panel-content {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

.dx-mega-menu-panel-content.active {
  margin-top: 0px !important;
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
  position: relative !important;
  display: grid !important;
  z-index: 10 !important;
}

/* Ensure product links, cards, titles and thumbnails in mega-menu are crisp, visible, and interactive */
.dx-mega-menu-product,
.tds-site-header-panel[open] .dx-mega-menu-product,
.tds-site-header-panel.open .dx-mega-menu-product {
  opacity: 1 !important;
  visibility: visible !important;
  transform: none !important;
}

.dx-mega-menu-product-title,
.dx-mega-menu .dx-mega-menu-link-group-title,
.dx-mega-menu-products a,
.dx-mega-menu-product-links a,
.dx-mega-menu-secondary-links a,
.dx-mega-menu-link-groups a,
.dx-mega-menu a,
.dx-mega-menu button {
  color: #171a20 !important;
  visibility: visible !important;
}

.dx-mega-menu-product-asset img {
  opacity: 1 !important;
  visibility: visible !important;
}

.tds-site-header-panel[open] + .tds-modal-backdrop,
.dx-mega-menu-panel[open] + .tds-modal-backdrop {
  display: block !important;
  opacity: 1 !important;
  z-index: 480 !important;
}

/* Hero & Carousel Image/Animation Fallback Fix */
.tcl-react-media-slide-in-animation,
[class*="slide-in-animation"] {
  opacity: 1 !important;
  transform: none !important;
  visibility: visible !important;
}

.tcl-flex-module-carousel__slide--active,
.tcl-flex-module-carousel__slide--active picture,
.tcl-flex-module-carousel__slide--active img {
  opacity: 1 !important;
  visibility: visible !important;
}

/* Universal Mobile Responsiveness (< 1024px and < 768px) */
@media (max-width: 1024px) {
  /* Prevent horizontal overflow across page shell */
  html, body, .tds-shell, .tcl-page__shell, main, #main-content, .layout-content {
    max-width: 100vw !important;
    width: 100% !important;
    overflow-x: hidden !important;
    box-sizing: border-box !important;
  }

  /* Universal Section and Dynamic Container Constraints */
  section,
  .tcl-section,
  .tcl-section--constrained,
  .tds-layout-item,
  .tcl-layout__main,
  .tcl-layout__child {
    max-width: 100vw !important;
    box-sizing: border-box !important;
  }

  /* Responsive Multi-column Grids (collapse gracefully to single column) */
  .tds-layout-2col.tds-layout-2col,
  .tds-layout-2col-has_main,
  .tds-layout-2col-spacious,
  [class*="tds-layout-2col"] {
    grid-template: 1fr / 1fr !important;
    display: flex !important;
    flex-direction: column !important;
    max-width: 100vw !important;
    box-sizing: border-box !important;
  }

  /* Dynamic Section and Flex Module Sizing Override on Mobile */
  [style*="--tcl-dynamic-section--width"] {
    --tcl-dynamic-section--width: 100% !important;
  }

  [style*="--tcl-flex-module__container--computed-max-inline-size"] {
    --tcl-flex-module__container--computed-max-inline-size: 100% !important;
  }

  .tcl-dynamic-section,
  [class*="dynamic-section"] {
    --tcl-dynamic-section--width: 100% !important;
    --tcl-dynamic-section--max-width: 100% !important;
    max-width: 100vw !important;
    inline-size: 100% !important;
    box-sizing: border-box !important;
  }

  .tcl-flex-module,
  .tcl-flex-module .tcl-flex-module__container,
  .tcl-flex-module__content {
    --tcl-flex-module__container--computed-max-inline-size: 100% !important;
    --tcl-flex-module__container--max-inline-size: 100% !important;
    max-width: 100vw !important;
    max-inline-size: 100% !important;
    inline-size: 100% !important;
    box-sizing: border-box !important;
  }

  /* Expand flex module grid items to full viewport width on mobile */
  .tcl-flex-module__content,
  [class*="flex-module__content"] {
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    max-width: 100vw !important;
  }

  .tcl-flex-module__container,
  [class*="flex-module__container"] {
    grid-column: 1 / -1 !important;
    grid-row: auto !important;
    width: 100% !important;
    max-width: 100vw !important;
    padding-inline: 16px !important;
  }

  .tcl-text-line {
    word-break: normal !important;
    overflow-wrap: break-word !important;
    white-space: normal !important;
  }

  /* Neutralize backdrop interception when drawer is closed on mobile */
  .tds-modal-backdrop:not(.mobile-open):not(.open) {
    display: none !important;
    pointer-events: none !important;
  }

  /* Responsive Freeflow Carousel Slides on mobile */
  .tcl-freeflow-carousel__container,
  [class*="freeflow-carousel__container"] {
    --tcl-freeflow-carousel-container__slide--max-inline-size: 85vw !important;
    --tcl-freeflow-carousel-container__slide--inline-size: 85vw !important;
    max-width: 100vw !important;
    inline-size: 100vw !important;
    box-sizing: border-box !important;
  }

  .tcl-freeflow-carousel-container__slides {
    padding-inline: 16px !important;
    gap: 16px !important;
    max-width: 100vw !important;
    box-sizing: border-box !important;
  }

  .tcl-freeflow-carousel-container__slide-container,
  .tcl-freeflow-carousel-container__slide-container .tcl-dynamic-section {
    --tcl-dynamic-section--width: 85vw !important;
    --tcl-freeflow-carousel-container__slide--inline-size: 85vw !important;
    max-width: 85vw !important;
    inline-size: 85vw !important;
    box-sizing: border-box !important;
  }

  .tcl-freeflow-carousel,
  [class*="freeflow-carousel"]:not([class*="__container"]),
  [class*="scroll-snap"] {
    max-width: 100vw !important;
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch !important;
    scroll-snap-type: x mandatory !important;
  }

  /* Sticky Bar Mobile Containment */
  .tcl-sticky-bar,
  [class*="sticky-bar"] {
    max-width: 100vw !important;
    width: 100% !important;
    box-sizing: border-box !important;
    overflow-x: hidden !important;
  }

  .tcl-sticky-bar .chat-container,
  .tcl-sticky-bar__drive-cta {
    max-width: 100% !important;
    min-width: 0 !important;
  }

  /* Footer Links Wrap on Mobile */
  .tds-list--horizontal,
  .tcl-site-footer,
  footer ul {
    flex-wrap: wrap !important;
    justify-content: center !important;
    max-width: 100vw !important;
    box-sizing: border-box !important;
  }

  /* Mobile Header Layout */
  #tds-site-header, .tds-site-header {
    padding-inline: 16px !important;
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    flex-wrap: nowrap !important;
    height: 56px !important;
    min-height: 56px !important;
  }

  /* Hide overflowing desktop center nav on mobile */
  #tds-site-header ol.tds-site-nav-items.tds-align--center,
  .tds-site-header .tds-align--center {
    display: none !important;
  }

  /* Style mobile menu toggle button */
  .tds-mobile-nav-toggle {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: rgba(0, 0, 0, 0.06) !important;
    backdrop-filter: blur(8px) !important;
    -webkit-backdrop-filter: blur(8px) !important;
    border-radius: 4px !important;
    padding: 6px 14px !important;
    font-size: 14px !important;
    font-weight: 500 !important;
    color: currentColor !important;
    border: none !important;
    cursor: pointer !important;
  }

  /* Mobile Navigation Drawer Sheet */
  .tds-site-header-panel.mobile-open,
  .dx-mega-menu-panel.mobile-open,
  dialog.tds-modal.mobile-open {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100dvh !important;
    max-height: 100dvh !important;
    background: #ffffff !important;
    color: #111111 !important;
    z-index: 99999 !important;
    display: flex !important;
    flex-direction: column !important;
    overflow-y: auto !important;
    padding: 20px 24px 40px !important;
    transform: none !important;
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
  }

  .tds-site-header-panel.mobile-open .tds-site-header-panel-content,
  .dx-mega-menu-panel.mobile-open .tds-site-header-panel-content {
    margin-block-start: 12px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 20px !important;
    transform: none !important;
    overflow: visible !important;
    height: auto !important;
    max-height: none !important;
    padding-top: 0 !important;
  }

  .tds-site-header-panel.mobile-open .dx-mega-menu-panel-content,
  .dx-mega-menu-panel.mobile-open .dx-mega-menu-panel-content {
    position: relative !important;
    inset: auto !important;
    transform: none !important;
    margin: 0 !important;
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 16px !important;
    width: 100% !important;
    max-width: 100% !important;
  }

  .tds-site-header-panel.mobile-open .dx-mega-menu-products {
    display: grid !important;
    grid-template-columns: repeat(2, 1fr) !important;
    gap: 12px !important;
    width: 100% !important;
    max-width: 100% !important;
    padding: 0 !important;
  }

  .tds-site-header-panel.mobile-open .dx-mega-menu-panel-content:nth-child(n+5) {
    display: none !important;
  }

  /* Hero & Flex Module Responsive Tweaks */
  .dx-hero__content, .tcl-flex-module__content {
    width: 100% !important;
    max-width: 100% !important;
    padding-inline: 16px !important;
    box-sizing: border-box !important;
  }

  .dx-hero__cta, .tcl-flex-module__cta {
    flex-direction: column !important;
    align-items: center !important;
    width: 100% !important;
    gap: 10px !important;
  }

  .dx-hero__cta button,
  .dx-hero__cta a,
  .tcl-flex-module__cta button,
  .tcl-flex-module__cta a,
  .permanent-cta---button-link {
    width: 100% !important;
    max-width: 320px !important;
    min-width: 0 !important;
  }
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
      [id*="locale-selector"], [id*="country-selector"], [class*="country-picker-modal"], [class*="location-prompt"],
      .tds-locale-selector-country, .tds-locale-selector-region, .tds-locale-selector-superregion
    `).remove();

    // Universal DOM Sanitization: Remove modal classes, body scroll locks, open dialogs, and frozen inline panel heights
    $cleanup('body').removeClass('tds-modal--is-open tds-site-header-panel--is-open overflow-hidden menu-open');
    const bodyStyle = $cleanup('body').attr('style');
    if (bodyStyle && bodyStyle.includes('overflow')) {
      $cleanup('body').attr('style', bodyStyle.replace(/overflow[^;]+;?/gi, ''));
    }

    $cleanup('dialog[open]').removeAttr('open');
    $cleanup('.open, .tds-modal--open, .mobile-open').removeClass('open tds-modal--open mobile-open');

    // Remove frozen inline --active-panel-height from hover captures
    $cleanup('[style*="--active-panel-height"]').each((_, el) => {
      const $el = $cleanup(el);
      const s = $el.attr('style') || '';
      $el.attr('style', s.replace(/--active-panel-height:\s*[^;]+;?/gi, ''));
    });

    // Normalize fixed 1024px inline style variables to responsive equivalents
    $cleanup('[style*="--tcl-dynamic-section--width"]').each((_, el) => {
      const $el = $cleanup(el);
      const s = $el.attr('style') || '';
      $el.attr('style', s.replace(/--tcl-dynamic-section--width:\s*1024px;?/gi, '--tcl-dynamic-section--width: min(1024px, 100vw);'));
    });
    $cleanup('[style*="--tcl-flex-module__container--computed-max-inline-size"]').each((_, el) => {
      const $el = $cleanup(el);
      const s = $el.attr('style') || '';
      $el.attr('style', s.replace(/--tcl-flex-module__container--computed-max-inline-size:\s*1024px;?/gi, '--tcl-flex-module__container--computed-max-inline-size: min(1024px, 100%);'));
    });
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

  // Ensure header has a mobile menu button if not already present
  if ($('#tds-site-header, .tds-site-header').length > 0 && $('.tds-mobile-nav-toggle').length === 0) {
    const endNav = $('#tds-site-header ol.tds-align--end, .tds-site-header ol.tds-align--end');
    if (endNav.length > 0) {
      endNav.prepend(`<li><button type="button" class="tds-site-nav-item tds--product-name tds-mobile-nav-toggle" aria-label="Menu"><span>Menu</span></button></li>`);
    } else {
      $('#tds-site-header, .tds-site-header').append(`<button type="button" class="tds-site-nav-item tds--product-name tds-mobile-nav-toggle" aria-label="Menu"><span>Menu</span></button>`);
    }
  }

  // Ensure mobile close button exists on mega-panel
  if ($('.tds-site-header-panel, .dx-mega-menu-panel').length > 0 && $('.tds-panel-mobile-close').length === 0) {
    $('.tds-site-header-panel, .dx-mega-menu-panel').prepend(`
      <div class="tds-panel-mobile-header" style="display:flex;justify-content:flex-end;padding:8px 0;">
        <button type="button" class="tds-panel-mobile-close" aria-label="Close menu" style="background:transparent;border:none;font-size:24px;line-height:1;cursor:pointer;padding:8px 12px;color:inherit;">✕</button>
      </div>
    `);
  }

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
    $('head').append(`\n  <style id="replicator-universal-patches">\n${REPLICATOR_GLOBAL_PATCH_CSS}\n  </style>\n`);
  } else {
    $.root().prepend(requireShim);
    $.root().prepend('\n<link rel="stylesheet" href="./style.css">\n');
    $.root().append(`\n<style id="replicator-universal-patches">\n${REPLICATOR_GLOBAL_PATCH_CSS}\n</style>\n`);
  }

  // Universal Header Navigation Controller (Desktop Hover Mega-Menu + Mobile Responsive Drawer)
  const mobileNavShim = `
  <script>
  (function() {
    function initHeaderNavigation() {
      const getElements = function(sel) { return Array.from(document.querySelectorAll(sel)); };
      const header = document.querySelector('#tds-site-header, .tds-site-header, header, [class*="site-header"]');
      const megaPanel = document.querySelector('.tds-site-header-panel, .dx-mega-menu-panel, [class*="mega-menu-panel"]');
      const backdrop = document.querySelector('.tds-modal-backdrop, [class*="menu-backdrop"]');

      // 1. Desktop Hover & Click Mega-Menu Controller
      if (header && megaPanel) {
        const menuWrapper = header.closest('#mega-menu, .dx-mega-menu') || header;

        // Target only the top-level nav items in center navigation
        const navItems = Array.from(header.querySelectorAll(
          'ol.tds-align--center > li > button, ol.tds-align--center > li > a, header nav > ul > li > a, header nav > ul > li > button, [role="navigation"] > ul > li > a, [role="navigation"] > ul > li > button'
        ));

        // Target top-level category containers (Vehicles, Energy, Charging, Discover, Shop)
        const contentWrapper = megaPanel.querySelector('.tds-site-header-panel-content') || megaPanel;
        const categories = Array.from(contentWrapper.children).filter(function(el) {
          return el.classList.contains('dx-mega-menu-panel-content') || el.hasAttribute('data-category');
        }).slice(0, navItems.length);

        let closeTimer = null;

        function openMegaCategory(index) {
          if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
          megaPanel.setAttribute('open', '');
          megaPanel.classList.add('open', 'tds-modal--open');
          megaPanel.style.setProperty('display', 'block', 'important');
          megaPanel.style.setProperty('opacity', '1', 'important');
          megaPanel.style.setProperty('visibility', 'visible', 'important');
          megaPanel.style.setProperty('pointer-events', 'auto', 'important');
          megaPanel.style.setProperty('height', 'auto', 'important');
          megaPanel.style.setProperty('max-height', 'none', 'important');
          megaPanel.style.setProperty('overflow', 'visible', 'important');

          if (backdrop) {
            backdrop.style.setProperty('display', 'block', 'important');
            backdrop.style.setProperty('opacity', '1', 'important');
            backdrop.style.setProperty('pointer-events', 'auto', 'important');
          }

          categories.forEach(function(cat, idx) {
            const isActive = idx === index;
            cat.classList.toggle('active', isActive);
            if (isActive) {
              cat.style.setProperty('display', 'grid', 'important');
              cat.style.setProperty('opacity', '1', 'important');
              cat.style.setProperty('visibility', 'visible', 'important');
              cat.style.setProperty('pointer-events', 'auto', 'important');
              cat.style.setProperty('margin-top', '0px', 'important');

              const catH = cat.scrollHeight || cat.offsetHeight;
              if (catH > 0) {
                contentWrapper.style.setProperty('height', (catH + 40) + 'px', 'important');
                contentWrapper.style.setProperty('max-height', 'none', 'important');
                contentWrapper.style.setProperty('overflow', 'visible', 'important');
              }
            } else {
              cat.style.setProperty('display', 'none', 'important');
              cat.style.setProperty('opacity', '0', 'important');
              cat.style.setProperty('visibility', 'hidden', 'important');
              cat.style.setProperty('pointer-events', 'none', 'important');
            }
          });

          navItems.forEach(function(btn, idx) {
            btn.setAttribute('aria-expanded', idx === index ? 'true' : 'false');
          });
        }

        function closeMegaMenu() {
          closeTimer = setTimeout(function() {
            if (!megaPanel.classList.contains('mobile-open')) {
              megaPanel.removeAttribute('open');
              megaPanel.classList.remove('open', 'tds-modal--open');
              categories.forEach(function(cat) {
                cat.classList.remove('active');
                cat.style.setProperty('display', 'none', 'important');
                cat.style.setProperty('opacity', '0', 'important');
                cat.style.setProperty('visibility', 'hidden', 'important');
                cat.style.setProperty('pointer-events', 'none', 'important');
              });
              if (backdrop) {
                backdrop.style.setProperty('display', 'none', 'important');
                backdrop.style.setProperty('opacity', '0', 'important');
                backdrop.style.setProperty('pointer-events', 'none', 'important');
              }
              navItems.forEach(function(btn) {
                btn.setAttribute('aria-expanded', 'false');
              });
            }
          }, 350);
        }

        navItems.forEach(function(btn, idx) {
          btn.addEventListener('mouseenter', function() {
            if (window.innerWidth >= 1024) {
              openMegaCategory(idx);
            }
          });
          btn.addEventListener('mouseover', function() {
            if (window.innerWidth >= 1024) {
              openMegaCategory(idx);
            }
          });
          btn.addEventListener('click', function(e) {
            if (window.innerWidth >= 1024) {
              if (btn.tagName === 'BUTTON') {
                e.preventDefault();
                if (megaPanel.hasAttribute('open') && btn.getAttribute('aria-expanded') === 'true') {
                  closeMegaMenu();
                } else {
                  openMegaCategory(idx);
                }
              }
            }
          });
        });

        megaPanel.addEventListener('mouseenter', function() {
          if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
        });
        megaPanel.addEventListener('mouseleave', function(e) {
          if (window.innerWidth >= 1024) {
            if (e.relatedTarget && (header.contains(e.relatedTarget) || (menuWrapper && menuWrapper.contains(e.relatedTarget)))) return;
            closeMegaMenu();
          }
        });

        header.addEventListener('mouseleave', function(e) {
          if (window.innerWidth >= 1024) {
            if (e.relatedTarget && (megaPanel.contains(e.relatedTarget) || (menuWrapper && menuWrapper.contains(e.relatedTarget)))) return;
            closeMegaMenu();
          }
        });
      }

      // 2. Generic Dropdown Menus on Other Websites (Hover & Click)
      document.querySelectorAll('header nav li, [class*="nav-item"], [class*="menu-item"]').forEach(function(item) {
        const submenu = item.querySelector('.dropdown-menu, .submenu, [class*="flyout"], [class*="sub-menu"], [class*="dropdown-content"], [role="menu"]');
        if (!submenu) return;

        item.addEventListener('mouseenter', function() {
          if (window.innerWidth >= 1024) {
            submenu.classList.add('open', 'show', 'active');
            item.setAttribute('aria-expanded', 'true');
          }
        });
        item.addEventListener('mouseleave', function() {
          if (window.innerWidth >= 1024) {
            submenu.classList.remove('open', 'show', 'active');
            item.setAttribute('aria-expanded', 'false');
          }
        });
      });

      // 3. Universal Mobile Menu Drawer & Toggle Handlers
      document.addEventListener('click', function(e) {
        var target = e.target;
        if (!target || !(target instanceof Element)) return;

        // A. Mobile Toggle Click (Tesla & Universal)
        var toggleBtn = target.closest(
          '.tds-mobile-nav-toggle, .mobile-menu-btn, button[class*="hamburger"], button[aria-label*="menu" i], button[aria-label*="navigation" i], [class*="menu-trigger"], [class*="nav-toggle"]'
        );
        if (toggleBtn) {
          e.preventDefault();
          e.stopPropagation();

          // Tesla specific panel
          if (megaPanel) {
            var willOpenMega = !megaPanel.classList.contains('mobile-open');
            megaPanel.classList.toggle('mobile-open', willOpenMega);
            if (willOpenMega) {
              megaPanel.setAttribute('open', '');
              megaPanel.style.display = 'flex';
              megaPanel.style.visibility = 'visible';
              megaPanel.style.opacity = '1';
              const categories = Array.from(megaPanel.querySelectorAll('.tds-site-header-panel-content > .dx-mega-menu-panel-content'));
              const catNames = ['Vehicles', 'Energy', 'Charging', 'Discover'];
              categories.slice(0, 4).forEach(function(cat, idx) {
                cat.classList.add('active');
                cat.style.display = 'flex';
                cat.style.opacity = '1';
                cat.style.visibility = 'visible';
                cat.style.pointerEvents = 'auto';
                cat.style.marginTop = '0px';

                if (!cat.querySelector('.rep-mobile-cat-header')) {
                  const hdr = document.createElement('div');
                  hdr.className = 'rep-mobile-cat-header';
                  hdr.style.cssText = 'grid-column: 1 / -1; font-weight: 700; font-size: 18px; margin: 16px 0 8px 0; color: #171a20; text-transform: uppercase; letter-spacing: 0.5px;';
                  hdr.textContent = catNames[idx] || ('Section ' + (idx + 1));
                  cat.prepend(hdr);
                }
              });
            } else {
              megaPanel.removeAttribute('open');
              megaPanel.style.display = 'none';
            }
          }

          // Universal mobile menus
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
          document.body.classList.toggle('menu-open', willOpen || (megaPanel && megaPanel.classList.contains('mobile-open')));
          toggleBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
          return;
        }

        // B. Mobile Close Button or Overlay Click
        var closeBtn = target.closest('.tds-panel-mobile-close, .mobile-menu-close, [aria-label*="close" i], [class*="close-menu"], .tds-modal-close');
        var overlay = target.closest('.mobile-overlay, [class*="menu-overlay"], .tds-modal-backdrop, [class*="backdrop"]');
        if (closeBtn || (overlay && target === overlay)) {
          if (megaPanel) {
            megaPanel.classList.remove('mobile-open', 'open', 'tds-modal--open');
            megaPanel.removeAttribute('open');
            megaPanel.style.display = 'none';
          }
          getElements('.mobile-menu, [class*="mobile-nav"], [class*="nav-drawer"], [class*="mobile-sidebar"]').forEach(function(el) {
            el.classList.remove('mobile-menu-open', 'open', 'active', 'show');
          });
          getElements('.mobile-overlay, [class*="menu-overlay"], [class*="backdrop"]').forEach(function(el) {
            el.classList.remove('show', 'open', 'active');
          });
          document.body.classList.remove('menu-open', 'mobile-menu-open', 'overflow-hidden');
          return;
        }

        // C. Mobile Navigation Accordion Sub-links
        var subNavBtn = target.closest('.mobile-nav-item > button, .mobile-nav-link');
        if (subNavBtn && subNavBtn.tagName === 'BUTTON') {
          var next = subNavBtn.nextElementSibling;
          if (next) {
            e.preventDefault();
            next.classList.toggle('hidden');
            next.classList.toggle('open');
          }
        }

        // D. Cookie Banner & Consent Dismiss Click
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
      document.addEventListener('DOMContentLoaded', initHeaderNavigation);
    } else {
      initHeaderNavigation();
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
          const cls = el.className || '';
          return !el.classList.contains('tcl-flex-module-carousel__slides') &&
                 !cls.includes('__slides') &&
                 !cls.includes('__track') &&
                 !cls.includes('carousel-container') &&
                 !el.closest('.tcl-freeflow-carousel') &&
                 !el.closest('[class*="freeflow"]');
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
