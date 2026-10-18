import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { ExtractionResult } from '../crawler/page-extractor.js';
import { AssetLocalizer } from '../localizer/asset-localizer.js';
import { ExtractionOptions, JobState, SectionMetadata } from '../types.js';
import { CONFIG } from '../config.js';
import { synthesisEngine } from '../synthesis/engine.js';
import { JsTransformer } from '../transformer/js-transformer.js';
import * as cheerio from 'cheerio';


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
          const candidateRegex = /,\s+(?=[^\s]+)|,(?=https?:\/\/|\/)/;
          const updated = srcset.split(candidateRegex).map(part => {
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

      // Rewrite embedded origin domains in inline JSON configurations to relative
      try {
        const u = new URL(origin);
        const hostRegex = new RegExp(`"(?:wwwDomain|apiDomain|host|domain)"\\s*:\\s*"${u.hostname.replace(/\\./g, '\\.')}"`, 'g');
        finalHtml = finalHtml.replace(hostRegex, `"domain":""`);
      } catch {}

      // Convert protocol relative URLs in url() to https
      finalCss = finalCss.replace(/url\(\s*(['"]?)\/\/([^'")]+)\1\s*\)/gi, 'url("https://$2")');
      finalHtml = finalHtml.replace(/url\(\s*(['"]?)\/\/([^'")]+)\1\s*\)/gi, 'url("https://$2")');

      // Canonicalize root-relative URLs in url() against base origin
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
          $p.append(`<img src="${firstUrl}" alt="">`);
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

    // Ensure all videos have muted and playsinline attributes so autoplay is universally supported
    $cleanup('video').each((_, el) => {
      const $el = $cleanup(el);
      $el.attr('muted', '');
      $el.attr('playsinline', '');
      if ($el.attr('autoplay') !== undefined) {
        $el.attr('loop', '');
      }
    });

    // Populate fallback labels if dynamic map component has empty text nodes
    const mapTitle = $cleanup('.charging-map-component__title, [class*="map-component__title"]');
    if (mapTitle.length && !mapTitle.text().trim()) mapTitle.text('Find Us');
    const mapSubtitle = $cleanup('.charging-map-component__subtitle, [class*="map-component__subtitle"]');
    if (mapSubtitle.length && !mapSubtitle.text().trim()) mapSubtitle.text('Find Superchargers, Destination Chargers and Service Centers.');
    const mapBtn1 = $cleanup('.charging-map-component__button-primary, [class*="map-component__button-primary"]');
    if (mapBtn1.length && !mapBtn1.text().trim()) mapBtn1.text('Find a Supercharger');
    const mapBtn2 = $cleanup('.charging-map-component__button-tertiary, [class*="map-component__button-tertiary"]');
    if (mapBtn2.length && !mapBtn2.text().trim()) mapBtn2.text('Learn More');

    $cleanup('[data-component-list*="InlineMedia"] .inline-media-wrapper').addClass('loaded playing');
    $cleanup(`
      .cookie-banner, [class*="cookie-banner"], [class*="cookie-consent"], [id*="cookie-consent"],
      [class*="country-picker-modal"], [class*="location-prompt"],
      [aria-label*="welcome" i], [class*="welcome-modal"], [class*="welcome-screen"], iframe[src*="welcome"],
      [data-base-ui-inert], [data-floating-ui-inert], [data-radix-focus-guard]
    `).closest('[data-base-ui-portal], [id*="headlessui-portal-root"], [id*="portal"], [role="dialog"], [class*="modal"], [class*="popup"]').remove();
    $cleanup(`
      .cookie-banner, [class*="cookie-banner"], [class*="cookie-consent"], [id*="cookie-consent"],
      [id*="truste"], [class*="truste"], [class*="trustarc"], [id*="trustarc"],
      [class*="country-picker-modal"], [class*="location-prompt"],
      [aria-label*="welcome" i], [class*="welcome-modal"], [class*="welcome-screen"], iframe[src*="welcome"],
      [id*="__replicator_"], [class*="__replicator_"], #__replicator_picker_bar__, #__replicator_picker_overlay__
    `).remove();

    // Universal DOM Sanitization: Remove body scroll locks and open state artifacts
    $cleanup('body').removeClass('overflow-hidden menu-open');
    const bodyStyle = $cleanup('body').attr('style');
    if (bodyStyle && bodyStyle.includes('overflow')) {
      $cleanup('body').attr('style', bodyStyle.replace(/overflow[^;]+;?/gi, ''));
    }

    $cleanup('dialog[open]').removeAttr('open');
    $cleanup('.open, .mobile-open, [class*="--show"], [class*="--layer-open"]').removeClass('open mobile-open srd19-gnb-search--show search--show');
    $cleanup('section[class*="gnb-search"], [role="dialog"][class*="search"]').css('display', 'none');
    finalHtml = $cleanup.html();

    // Embed links to style.css and script.js in full-page index.html, remove redundant external css links
    finalHtml = injectStylesAndScripts(finalHtml);

    // Dual-Engine Integration: Combine universal interactive resilience controller with authentic scripts
    let syntheticSectionControllers = (result.sections || [])
      .map((s) => {
        try {
          const syn = synthesisEngine.synthesizeSection(
            s.cleanedHtml || s.rawHtml,
            url,
            finalCss,
            s.meta?.id || 'main',
            s.meta?.archetype || 'section',
            finalHtml,
            result.recordedInteractions
          );
          return syn.js;
        } catch {
          return '';
        }
      })
      .filter(Boolean)
      .join('\n\n');

    if (!syntheticSectionControllers || !syntheticSectionControllers.trim()) {
      try {
        const fullSyn = synthesisEngine.synthesizeSection(
          finalHtml,
          url,
          finalCss,
          'full-page',
          'body',
          finalHtml,
          result.recordedInteractions
        );
        syntheticSectionControllers = fullSyn.js;
      } catch (err) {
        // Fallback gracefully
      }
    }

    let sanitizedAuthenticJs = JsTransformer.sanitizeModuleSyntax(result.transformedJs || '');
    if (sanitizedAuthenticJs && sanitizedAuthenticJs.trim()) {
      try {
        new Function(sanitizedAuthenticJs);
        if (!sanitizedAuthenticJs.startsWith('(function()')) {
          sanitizedAuthenticJs = `(function() {\n  try {\n${sanitizedAuthenticJs}\n  } catch (err) {\n    console.warn('Authentic script initialization caught:', err);\n  }\n})();`;
        }
      } catch (err) {
        sanitizedAuthenticJs = `/* [Authentic Origin JS Isolated Due to Syntax Errors] */\ntry {\n  new Function(${JSON.stringify(sanitizedAuthenticJs)})();\n} catch (e) {}\n`;
      }
    }

    let dualEngineJs = '';
    if (syntheticSectionControllers && syntheticSectionControllers.trim().length > 0) {
      dualEngineJs = `/* [Universal Interactive Resilience Controllers] */\n${syntheticSectionControllers}\n\n`;
    }
    if (sanitizedAuthenticJs && sanitizedAuthenticJs.trim().length > 0) {
      dualEngineJs += `/* [Authentic Harvested Scripts] */\n${sanitizedAuthenticJs}`;
    }

    // Save full page files
    fs.writeFileSync(path.join(fullPageDir, 'index.html'), finalHtml, 'utf8');
    fs.writeFileSync(path.join(fullPageDir, 'style.css'), finalCss, 'utf8');
    fs.writeFileSync(path.join(fullPageDir, 'style.min.css'), finalMinifiedCss, 'utf8');
    fs.writeFileSync(path.join(fullPageDir, 'script.js'), dualEngineJs, 'utf8');
    fs.writeFileSync(path.join(fullPageDir, 'full-page.png'), result.fullPageScreenshot);

    // 2. Save individual sections
    const updatedSectionsMeta: SectionMetadata[] = [];

    for (const sec of result.sections) {
      const secFolderName = `${sec.meta.id}-${sec.meta.archetype}`;
      const secDir = path.join(sectionsDir, secFolderName);
      fs.mkdirSync(secDir, { recursive: true });

      let secCss = sec.purgedCss;
      const secMinCss = sec.minifiedCss;

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
  $('[class*="mini-locale-selector"], [class*="locale-selector__container"]').remove();

  // Ensure header has a mobile menu button if not already present
  const headerEl = $('header:not(.section-header):not([class*="section-header"]):not([class*="section_header"]), nav, [role="banner"], [class*="site-header"], [class*="page-header"]').first();
  const hasNavContent = headerEl.find('nav, [role="navigation"], ul[class*="nav"], ul[class*="menu"], [class*="nav-item"], [class*="menu-item"], [class*="navbar"]').length > 0;
  if (headerEl.length > 0 && hasNavContent && headerEl.find('button[class*="hamburger"], [class*="hamburger"], button[aria-label*="menu" i], [class*="menu-trigger"], [class*="nav-toggle"], [class*="icon-bar"]').length === 0) {
    const endNav = headerEl.find('ol:last-child, ul:last-child, [class*="end"], [class*="right"]').first();
    if (endNav.length > 0 && endNav.is('ul, ol')) {
      endNav.append(`<li><button type="button" class="universal-nav-toggle mobile-menu-btn" aria-label="Menu" style="background:transparent;border:none;cursor:pointer;padding:8px;font-size:16px;">☰ Menu</button></li>`);
    } else {
      headerEl.append(`<button type="button" class="universal-nav-toggle mobile-menu-btn" aria-label="Menu" style="background:transparent;border:none;cursor:pointer;padding:8px;font-size:16px;">☰ Menu</button>`);
    }
  }

  // Ensure mobile close button exists on dialog / mobile drawer / mega-panel
  const panelEl = $('dialog, [role="dialog"], [class*="mega-menu-panel"], [class*="nav-drawer"]').first();
  if (panelEl.length > 0 && panelEl.find('[aria-label*="close" i], [class*="close"], .close-btn').length === 0) {
    panelEl.prepend(`
      <div class="universal-panel-mobile-header" style="display:flex;justify-content:flex-end;padding:8px 0;">
        <button type="button" class="mobile-menu-close close-btn" aria-label="Close menu" style="background:transparent;border:none;font-size:24px;line-height:1;cursor:pointer;padding:8px 12px;color:inherit;">✕</button>
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
          if (url.includes('/api-www/') || url.includes('/api/v1/flyouts')) {
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
  if (typeof window.React.createContext !== 'function') {
    window.React.createContext = function(def) {
      return {
        Provider: function() {},
        Consumer: function() {},
        _currentValue: def,
        _currentValue2: def,
        displayName: ''
      };
    };
  }
  if (typeof window.React.createElement !== 'function') {
    window.React.createElement = function(type, props) {
      return { $$typeof: Symbol.for('react.element'), type: type, props: props || {}, children: Array.prototype.slice.call(arguments, 2) };
    };
  }
  if (typeof window.React.forwardRef !== 'function') {
    window.React.forwardRef = function(render) { return render; };
  }
  if (typeof window.React.memo !== 'function') {
    window.React.memo = function(c) { return c; };
  }
  if (typeof window.React.useRef !== 'function') {
    window.React.useRef = function(init) { return { current: init }; };
  }
  if (typeof window.React.useState !== 'function') {
    window.React.useState = function(init) { return [typeof init === 'function' ? init() : init, function() {}]; };
  }
  if (typeof window.React.useEffect !== 'function') {
    window.React.useEffect = function() {};
  }
  if (typeof window.React.useLayoutEffect !== 'function') {
    window.React.useLayoutEffect = function() {};
  }
  if (typeof window.React.useMemo !== 'function') {
    window.React.useMemo = function(fn) { return fn(); };
  }
  if (typeof window.React.useCallback !== 'function') {
    window.React.useCallback = function(fn) { return fn; };
  }
  if (typeof window.React.useContext !== 'function') {
    window.React.useContext = function() { return {}; };
  }
  if (typeof window.React.Component !== 'function') {
    window.React.Component = function() {};
  }
  if (typeof window.React.PureComponent !== 'function') {
    window.React.PureComponent = function() {};
  }
  if (!window.React.Fragment) {
    window.React.Fragment = Symbol.for('react.fragment');
  }
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

  // Universal Google Maps & JSONP safety shim
  window.google = window.google || {};
  window.google.maps = window.google.maps || {
    Map: function() { return { setCenter: function() {}, setZoom: function() {}, addListener: function() {} }; },
    Marker: function() { return { setMap: function() {}, setPosition: function() {} }; },
    LatLng: function(lat, lng) { return { lat: function() { return lat; }, lng: function() { return lng; } }; },
    LatLngBounds: function() { return { extend: function() {}, getCenter: function() {} }; },
    InfoWindow: function() { return { open: function() {}, close: function() {} }; },
    OverlayView: function() {},
    event: { addListener: function() {}, removeListener: function() {} }
  };
  window._xdc_ = window._xdc_ || {};

  // Universal Cookie Banner & Modal Dismiss Handler (Runs in capture phase before frameworks mount)
  document.addEventListener('click', function(e) {
    var btn = e.target && e.target.closest ? e.target.closest(
      '[class*="cookie"] button, button[class*="cookie"], [id*="cookie"] button, [data-cookie-action], .cookie-settings-url, [class*="locale-selector"] button, [class*="country-selector"] button, [class*="modal-close"], [aria-label*="close" i]'
    ) : null;
    if (btn) {
      var banner = btn.closest(
        '.cookie-banner, [class*="cookie-banner"]:not([class*="--"]), [class*="cookie-consent"], [id*="cookie-banner"], [class*="cookie-modal"]'
      );
      if (banner) {
        banner.style.display = 'none';
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

  // Universal Header Navigation Controller (Desktop Hover Mega-Menu + Mobile Responsive Drawer)
  const mobileNavShim = `
  <script>
  (function() {
    function initHeaderNavigation() {
      const getElements = function(sel) { return Array.from(document.querySelectorAll(sel)); };
      const header = document.querySelector('header, [role="banner"], [class*="site-header"], [class*="navbar"]');
      const megaPanel = document.querySelector('dialog, [role="dialog"], [class*="mega-menu"], [class*="dropdown-menu"]');
      const backdrop = document.querySelector('[class*="backdrop"], [class*="overlay"]');

      // 1. Desktop Hover & Click Navigation Controller
      if (header && megaPanel) {
        const menuWrapper = header.closest('[class*="mega-menu"]') || header;

        const navItems = Array.from(header.querySelectorAll(
          'header nav > ul > li > a, header nav > ul > li > button, [role="navigation"] > ul > li > a, [role="navigation"] > ul > li > button, [role="navigation"] li > a, [role="navigation"] li > button'
        ));

        const contentWrapper = megaPanel.querySelector('[class*="panel-content"], [class*="content"]') || megaPanel;
        const categories = Array.from(contentWrapper.children).slice(0, navItems.length);

        let closeTimer = null;

        function openMegaCategory(index) {
          if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
          megaPanel.setAttribute('open', '');
          megaPanel.classList.add('open');
          megaPanel.style.display = 'block';
          megaPanel.style.opacity = '1';
          megaPanel.style.visibility = 'visible';
          megaPanel.style.pointerEvents = 'auto';

          if (backdrop) {
            backdrop.style.display = 'block';
            backdrop.style.opacity = '1';
            backdrop.style.pointerEvents = 'auto';
          }

          categories.forEach(function(cat, idx) {
            const isActive = idx === index;
            cat.classList.toggle('active', isActive);
            if (isActive) {
              cat.style.display = 'block';
              cat.style.opacity = '1';
              cat.style.visibility = 'visible';
              cat.style.pointerEvents = 'auto';
            } else {
              cat.style.display = 'none';
              cat.style.opacity = '0';
              cat.style.visibility = 'hidden';
              cat.style.pointerEvents = 'none';
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
              megaPanel.classList.remove('open');
              categories.forEach(function(cat) {
                cat.classList.remove('active');
                cat.style.display = 'none';
                cat.style.opacity = '0';
                cat.style.visibility = 'hidden';
                cat.style.pointerEvents = 'none';
              });
              if (backdrop) {
                backdrop.style.display = 'none';
                backdrop.style.opacity = '0';
                backdrop.style.pointerEvents = 'none';
              }
              navItems.forEach(function(btn) {
                btn.setAttribute('aria-expanded', 'false');
              });
            }
          }, 350);
        }

        navItems.forEach(function(btn, idx) {
          btn.addEventListener('mouseenter', function() {
            if (window.innerWidth >= 1024) openMegaCategory(idx);
          });
          btn.addEventListener('mouseover', function() {
            if (window.innerWidth >= 1024) openMegaCategory(idx);
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

      // 3. Universal Mobile Menu Drawer & Toggle Handlers (Runs in capture phase)
      var lastMobileToggleTime = 0;
      document.addEventListener('click', function(e) {
        var target = e.target;
        if (!target || !(target instanceof Element)) return;

        // A. Mobile Toggle Click (Universal)
        var toggleBtn = target.closest(
          '.mobile-menu-btn, button[class*="hamburger"], [class*="hamburger"], button[aria-label*="menu" i], button[aria-label*="navigation" i], [class*="menu-trigger"], [class*="nav-toggle"], [id*="menu-toggle"], [id*="nav-toggle"], [id*="mobile-menu"], [data-action="toggle-nav"], div[class*="button"][tabindex], [role="button"][class*="menu"]'
        );
        if (!toggleBtn && target.closest('.icon-bar, [class*="hamburger-bar"]')) {
          toggleBtn = target.closest('button, [role="button"], div[tabindex], div[class*="button"], a');
        }
        if (!toggleBtn && target.closest('header, nav, [class*="site-header"], [class*="page-header"]')) {
          var candidate = target.closest('button, a, [role="button"], div[tabindex]');
          if (candidate) {
            var txt = (candidate.textContent || '').trim().toLowerCase();
            if (txt === 'menu' || txt === 'toggle nav' || candidate.querySelector('.icon-bar, [class*="hamburger-bar"], svg')) {
              toggleBtn = candidate;
            }
          }
        }
        if (toggleBtn) {
          e.preventDefault();
          e.stopPropagation();

          var now = Date.now();
          if (now - lastMobileToggleTime < 400) return;
          lastMobileToggleTime = now;

          // Universal Mega / Portal Panels
          if (megaPanel) {
            var willOpenMega = !megaPanel.classList.contains('mobile-open');
            megaPanel.classList.toggle('mobile-open', willOpenMega);
            if (willOpenMega) {
              megaPanel.setAttribute('open', '');
              megaPanel.style.position = 'fixed';
              megaPanel.style.top = '0';
              megaPanel.style.left = '0';
              megaPanel.style.right = '0';
              megaPanel.style.bottom = '0';
              megaPanel.style.zIndex = '99999';
              megaPanel.style.display = 'flex';
              megaPanel.style.visibility = 'visible';
              megaPanel.style.opacity = '1';
              megaPanel.style.pointerEvents = 'auto';
              document.body.classList.add('menu-open');
              document.body.style.overflow = 'hidden';
            } else {
              megaPanel.removeAttribute('open');
              megaPanel.style.position = '';
              megaPanel.style.display = 'none';
              document.body.classList.remove('menu-open');
              document.body.style.overflow = '';
            }
          }

          // Universal mobile menus and drawers
          var menus = getElements('.mobile-menu, [class*="mobile-nav"], [class*="nav-drawer"], [class*="mobile-sidebar"], #nav-content, [class*="header_sidebar_menu"], [class*="nav-sections"]');
          var overlays = getElements('.mobile-overlay, [class*="menu-overlay"], [class*="backdrop"], .bg');
          var willOpen = !menus.some(function(m) {
            return m.classList.contains('mobile-menu-open') || m.classList.contains('open') || m.classList.contains('active');
          });

          menus.forEach(function(m) {
            m.classList.toggle('mobile-menu-open', willOpen);
            m.classList.toggle('open', willOpen);
            m.classList.toggle('active', willOpen);
            if (willOpen) {
              m.style.visibility = 'visible';
              m.style.opacity = '1';
              m.style.pointerEvents = 'auto';
            } else {
              m.style.visibility = '';
              m.style.opacity = '';
            }
          });
          overlays.forEach(function(o) {
            o.classList.toggle('show', willOpen);
            o.classList.toggle('open', willOpen);
            o.classList.toggle('active', willOpen);
            if (willOpen) {
              o.style.display = 'block';
              o.style.visibility = 'visible';
              o.style.opacity = '1';
            } else {
              o.style.display = '';
              o.style.visibility = '';
              o.style.opacity = '';
            }
          });
          document.body.classList.toggle('menu-open', willOpen || (megaPanel && megaPanel.classList.contains('mobile-open')));
          toggleBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
          return;
        }

        // B. Mobile Close Button or Overlay Click
        var closeBtn = target.closest('.mobile-menu-close, [aria-label*="close" i], [class*="close-menu"], [class*="menu_close"], [class*="nav-close"], [class*="closeButton" i], [class*="close-button" i], .close-btn');
        var overlay = target.closest('.mobile-overlay, [class*="menu-overlay"], [class*="backdrop"], .bg');
        if (closeBtn || (overlay && target === overlay)) {
          if (megaPanel) {
            megaPanel.classList.remove('mobile-open', 'open');
            megaPanel.removeAttribute('open');
            megaPanel.style.position = '';
            megaPanel.style.display = 'none';
          }
          getElements('.mobile-menu, [class*="mobile-nav"], [class*="nav-drawer"], [class*="mobile-sidebar"], #nav-content, [class*="header_sidebar_menu"], [class*="nav-sections"]').forEach(function(el) {
            el.classList.remove('mobile-menu-open', 'open', 'active', 'show');
          });
          getElements('.mobile-overlay, [class*="menu-overlay"], [class*="backdrop"], .bg').forEach(function(el) {
            el.classList.remove('show', 'open', 'active');
            el.style.display = '';
          });
          document.body.classList.remove('menu-open', 'mobile-menu-open', 'overflow-hidden');
          document.body.style.overflow = '';
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

        // D. Cookie Banner Dismiss Click
        var cookieBtn = target.closest(
          '[class*="cookie"] button, button[class*="cookie"], [id*="cookie"] button, [data-cookie-action]'
        );
        if (cookieBtn) {
          var banner = cookieBtn.closest('.cookie-banner, [class*="cookie-banner"], [class*="cookie-consent"], [id*="cookie-banner"]');
          if (banner) {
            banner.style.display = 'none';
          }
          return;
        }
      }, true);
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
      // 1. Universal Stacked / Fade / Active-Class Carousels
      const stackedCarousels = document.querySelectorAll(
        '[class*="carousel-fade"], [class*="stacked-carousel"], [class*="gallery-container"], [data-carousel="fade"]'
      );

      stackedCarousels.forEach(function(carousel) {
        if (carousel.hasAttribute('data-rep-init')) return;
        carousel.setAttribute('data-rep-init', 'true');

        const slides = Array.from(
          carousel.querySelectorAll('[role="tabpanel"], [class*="__slide"], [class*="slide-item"]')
        ).filter(function(el) {
          const cls = el.className || '';
          return !cls.includes('__slides') &&
                 !cls.includes('__track') &&
                 !cls.includes('carousel-container') &&
                 !el.closest('[class*="freeflow"]');
        });

        if (slides.length <= 1) return;

        const isMediaGallery = carousel.classList.contains('media-gallery') || carousel.querySelector('[class*="gallery-item"]');
        const allTabLists = Array.from(carousel.querySelectorAll('[role="tablist"], [class*="dot-list"], [class*="dots"]'));
        const nextBtns = Array.from(carousel.querySelectorAll('[aria-label*="next" i], [class*="nav-next"], button[class*="next"]'));
        const prevBtns = Array.from(carousel.querySelectorAll('[aria-label*="prev" i], [aria-label*="previous" i], [class*="nav-prev"], button[class*="prev"]'));

        let currentIndex = 0;
        slides.forEach(function(s, idx) {
          if (s.classList.contains('active') || s.classList.contains('current-item')) {
            currentIndex = idx;
          }
        });

        let autoPlayTimer = null;

        function updateStackedGallery(index) {
          currentIndex = (index + slides.length) % slides.length;
          slides.forEach(function(item, idx) {
            const offset = idx - currentIndex;
            const isActive = idx === currentIndex;

            item.classList.toggle('active', isActive);
            item.setAttribute('aria-hidden', isActive ? 'false' : 'true');

            if (isMediaGallery) {
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
            const dots = Array.from(tabList.querySelectorAll('[role="tab"], button'));
            dots.forEach(function(trigger, idx) {
              const isSelected = idx === currentIndex;
              trigger.setAttribute('aria-selected', isSelected ? 'true' : 'false');
              trigger.classList.toggle('current', isSelected);
              trigger.classList.toggle('active', isSelected);
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
          const dots = Array.from(tabList.querySelectorAll('[role="tab"], button'));
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

      // 2. Universal Horizontal Freeflow & Scroll-Snap Carousels
      const freeflowContainers = document.querySelectorAll(
        '[class*="freeflow-carousel"], [class*="horizontal-carousel"], [class*="scroll-snap"]'
      );

      freeflowContainers.forEach(function(container) {
        if (container.hasAttribute('data-rep-ff-init')) return;
        container.setAttribute('data-rep-ff-init', 'true');

        const scrollEl = container.querySelector('[class*="slides"], [class*="track"]') || container;
        const slides = Array.from(
          container.querySelectorAll('[class*="slide-container"], [class*="carousel-card"], [class*="__slide"]')
        );
        if (slides.length <= 1) return;

        const tabLists = Array.from(container.querySelectorAll('[role="tablist"], [class*="dot-list"], [class*="dots"]'));
        const nextBtns = Array.from(container.querySelectorAll('[aria-label*="next" i], [class*="nav-next"], button[class*="next"]'));
        const prevBtns = Array.from(container.querySelectorAll('[aria-label*="prev" i], [aria-label*="previous" i], [class*="nav-prev"], button[class*="prev"]'));

        let currentIndex = 0;
        slides.forEach(function(s, idx) {
          if (s.classList.contains('active')) {
            currentIndex = idx;
          }
        });

        function scrollToSlide(index) {
          currentIndex = Math.max(0, Math.min(index, slides.length - 1));

          slides.forEach(function(slide, idx) {
            const isActive = idx === currentIndex;
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
            const dots = Array.from(tabList.querySelectorAll('[role="tab"], button'));
            dots.forEach(function(dot, idx) {
              const isSelected = idx === currentIndex;
              dot.setAttribute('aria-selected', isSelected ? 'true' : 'false');
              dot.classList.toggle('active', isSelected);
              dot.classList.toggle('current', isSelected);
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
          const dots = Array.from(tabList.querySelectorAll('[role="tab"], button'));
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
                slide.classList.toggle('active', isActive);
              });
              tabLists.forEach(function(tabList) {
                const dots = Array.from(tabList.querySelectorAll('[role="tab"], button'));
                dots.forEach(function(dot, idx) {
                  const isSelected = idx === currentIndex;
                  dot.setAttribute('aria-selected', isSelected ? 'true' : 'false');
                  dot.classList.toggle('active', isSelected);
                  dot.classList.toggle('current', isSelected);
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

  const hasAuthenticScripts = $('script[src*="assets/"], script[src^="./assets/"], script[src^="assets/"]').length > 0;
  if (!hasAuthenticScripts) {
    if ($('body').length > 0) {
      $('body').append('\n  <script src="./script.js" defer></script>\n' + mobileNavShim + '\n' + carouselShim + '\n');
    } else {
      $.root().append('\n<script src="./script.js" defer></script>\n' + mobileNavShim + '\n' + carouselShim + '\n');
    }
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
  <meta name="referrer" content="no-referrer">
  <title>${title} - Standalone Section Preview</title>
  <style>
    /* Reset & Base */
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 0; }
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
