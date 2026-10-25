import { BrowserManager } from './browser.js';
import { SectionClassifier } from '../classifier/section-classifier.js';
import { HtmlTransformer } from '../transformer/html-transformer.js';
import { CssTransformer } from '../transformer/css-transformer.js';
import { JsTransformer } from '../transformer/js-transformer.js';
import { CssPurger } from '../optimizer/css-purger.js';
import { AssetLocalizer, isTrackingOrAnalytics } from '../localizer/asset-localizer.js';
import { ExtractionOptions, ExtractedSection, JobState, RecordedInteraction } from '../types.js';
import { CONFIG } from '../config.js';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { synthesisEngine } from '../synthesis/engine.js';

export interface BaselineScreenshots {
  desktop?: Buffer;
  desktopMenu?: Buffer;
  tablet?: Buffer;
  mobile?: Buffer;
  mobileMenu?: Buffer;
}

export interface ExtractionResult {
  fullPageScreenshot: Buffer;
  baselineScreenshots?: BaselineScreenshots;
  originalHtml: string;
  transformedHtml: string;
  originalCss: string;
  transformedCss: string;
  minifiedCss: string;
  originalJs: string;
  transformedJs: string;
  sections: ExtractedSection[];
  assetCount: number;
  recordedInteractions?: RecordedInteraction[];
}

export class PageExtractor {
  private classifier = new SectionClassifier();
  private htmlTransformer = new HtmlTransformer();
  private cssPurger = new CssPurger();

  public extractFromSnapshotPure(
    url: string,
    options: ExtractionOptions,
    onProgress?: (step: string, progress: number) => void
  ): ExtractionResult {
    onProgress?.('Extracting from client snapshot in-memory...', 30);
    const rawHtml = options.htmlSnapshot || '';
    const $ = cheerio.load(rawHtml);

    const baselineScreenshots: BaselineScreenshots = {};
    if (options.clientScreenshot) {
      try {
        const base64Data = options.clientScreenshot.replace(/^data:image\/\w+;base64,/, '');
        baselineScreenshots.desktop = Buffer.from(base64Data, 'base64');
      } catch {}
    }

    let combinedCss = (options.clientStylesheets || []).join('\n');
    $('style').each((_i, el) => {
      combinedCss += '\n' + $(el).text();
    });

    // Normalize inline SVGs in snapshot, but preserve logo and brand dimensions
    $('svg').each((_, el) => {
      const $svg = $(el);
      const isLogo = $svg.is('.logo, [class*="logo"], [class*="brand"], [id*="logo"], [id*="brand"]') ||
                     $svg.closest('[class*="logo"], [class*="brand"], [id*="logo"], [id*="brand"], [class*="header__logo"], [class*="nav__logo"]').length > 0;

      if (isLogo) {
        $svg.removeAttr('width').removeAttr('height');
        const style = $svg.attr('style') || '';
        const cleanStyle = style.replace(/(?:^|;)\s*(?:width|height)\s*:\s*\d+px;?/gi, '').trim();
        if (cleanStyle) $svg.attr('style', cleanStyle);
        else $svg.removeAttr('style');
        return;
      }

      const vb = $svg.attr('viewBox');
      const w = $svg.attr('width');
      const h = $svg.attr('height');
      if (!w || !h || w === '100%' || h === '100%') {
        if (vb) {
          const parts = vb.trim().split(/[\s,]+/).map(Number);
          if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
            const isIcon = $svg.closest('a, button, li, [class*="icon"], [class*="item"]').length > 0;
            const targetW = isIcon ? Math.min(parts[2], 24) : parts[2];
            const targetH = isIcon ? Math.min(parts[3], 24) : parts[3];
            $svg.attr('width', String(targetW));
            $svg.attr('height', String(targetH));
            $svg.css('width', `${targetW}px`);
            $svg.css('height', `${targetH}px`);
          }
        } else {
          $svg.attr('width', '24');
          $svg.attr('height', '24');
          $svg.css('width', '24px');
          $svg.css('height', '24px');
        }
      }
    });

    const isNavbarTarget = options.targetArchetype === 'navbar';
    const candidateElements = isNavbarTarget
      ? $('header, nav, [role="banner"], [role="navigation"]')
      : $('header, nav, main > section, main > div, body > section, body > div, footer');
    const sections: ExtractedSection[] = [];
    const totalCandidates = candidateElements.length;

    candidateElements.each((i, el) => {
      let secHtml = $.html(el);
      if (isNavbarTarget && i === 0) {
        const associatedDrawers = $(
          '[data-testid*="drawer"], [role="dialog"], [data-baseweb="drawer"], [data-baseweb="modal"], [aria-modal="true"]'
        );
        if (associatedDrawers.length > 0) {
          associatedDrawers.each((_, drw) => {
            const drwHtml = $.html(drw);
            if (drwHtml && !secHtml.includes(drwHtml)) {
              secHtml += '\n' + drwHtml;
            }
          });
        }
      }
      if (secHtml && secHtml.length > 80) {
        const tag = (el as any).tagName ? (el as any).tagName.toLowerCase() : 'section';
        const meta = this.classifier.classify({
          id: `s${i + 1}`,
          index: i,
          totalSections: totalCandidates,
          selector: `${tag}:nth-of-type(${i + 1})`,
          tagName: tag,
          rect: { x: 0, y: i * 400, width: 1440, height: 400 },
          html: secHtml,
        });

        const synSec = synthesisEngine.synthesizeSection(
          secHtml,
          url,
          combinedCss,
          `${tag}:nth-of-type(${i + 1})`,
          options.targetArchetype,
          options.htmlSnapshot,
          options.recordedInteractions
        );

        sections.push({
          meta,
          rawHtml: secHtml,
          cleanedHtml: synSec.html,
          purgedCss: synSec.css,
          minifiedCss: synSec.css,
          scopedJs: synSec.js,
          classMapping: {},
          idMapping: {},
        });
      }
    });

    onProgress?.('Snapshot extraction completed', 100);

    const fullJs = sections.map((s) => s.scopedJs).filter(Boolean).join('\n\n');

    return {
      fullPageScreenshot: baselineScreenshots.desktop || Buffer.alloc(0),
      baselineScreenshots,
      originalHtml: rawHtml,
      transformedHtml: rawHtml,
      originalCss: combinedCss,
      transformedCss: combinedCss,
      minifiedCss: combinedCss,
      originalJs: fullJs,
      transformedJs: fullJs,
      sections,
      assetCount: $('img, svg, picture, video').length,
      recordedInteractions: options.recordedInteractions,
    };
  }

  public async extract(
    url: string,
    options: ExtractionOptions,
    onProgress?: (step: string, progress: number) => void
  ): Promise<ExtractionResult> {
    const hasSnapshot = !!(options.htmlSnapshot && options.htmlSnapshot.length > 200);
    if (hasSnapshot) {
      return this.extractFromSnapshotPure(url, options, onProgress);
    }

    let pageObj: { context: any; page: any } | null = null;
    try {
      onProgress?.('Launching browser and opening page...', 10);
      pageObj = await BrowserManager.createPage({
        mobile: options.mobile,
        viewportWidth: options.viewportWidth,
        viewportHeight: options.viewportHeight,
      }).catch((err) => {
        console.warn(`[PageExtractor] Browser launch failed (${err.message}). Using pure snapshot parser fallback.`);
        return null;
      });
    } catch (launchErr: any) {
      console.warn(`[PageExtractor] Browser launch exception: ${launchErr.message}`);
    }

    if (!pageObj) {
      return this.extractFromSnapshotPure(url, options, onProgress);
    }

    const { context, page } = pageObj;
    const networkCapturedCss = new Map<string, string>();
    try {
      // 1. Visit URL / Load Snapshot
      const hasSnapshot = !!(options.htmlSnapshot && options.htmlSnapshot.length > 500);
      console.log(`[Crawler] Extraction start: ${url} | hasSnapshot: ${hasSnapshot} (${options.htmlSnapshot?.length || 0} bytes) | clientScreenshot: ${!!options.clientScreenshot} | stylesheets: ${options.clientStylesheets?.length || 0}`);

      // Capture all external CSS stylesheets at the network layer to bypass CORS restrictions
      page.on('response', async (res: any) => {
        try {
          const ct = (res.headers()['content-type'] || '').toLowerCase();
          const reqUrl = res.url();
          if (ct.includes('text/css') || reqUrl.endsWith('.css') || reqUrl.includes('.css?')) {
            const text = await res.text();
            if (text && text.trim()) networkCapturedCss.set(reqUrl, text);
          }
        } catch {}
      });

      if (hasSnapshot) {
        onProgress?.('Loading client-authenticated snapshot & styles...', 20);
        let snapshotHtml = options.htmlSnapshot!;
        if (!/<base\s/i.test(snapshotHtml)) {
          if (/<head[^>]*>/i.test(snapshotHtml)) {
            snapshotHtml = snapshotHtml.replace(/<head[^>]*>/i, (m) => `${m}\n<base href="${url}">`);
          } else {
            snapshotHtml = `<base href="${url}">\n` + snapshotHtml;
          }
        }
        if (options.clientStylesheets && options.clientStylesheets.length > 0) {
          const clientStyles = options.clientStylesheets
            .filter(Boolean)
            .map((css) => `<style data-client-snapshot="true">${css}</style>`)
            .join('\n');
          if (/<head[^>]*>/i.test(snapshotHtml)) {
            snapshotHtml = snapshotHtml.replace(/<head[^>]*>/i, (m) => `${m}\n${clientStyles}`);
          } else {
            snapshotHtml = clientStyles + '\n' + snapshotHtml;
          }
        }
        await page.setContent(snapshotHtml, { waitUntil: 'load' });
      } else {
        onProgress?.('Navigating to target URL...', 20);
        let response: any = null;
        try {
          response = await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: options.timeoutMs || CONFIG.crawler.defaultTimeoutMs,
          });
        } catch {
          // Fallback to load state
          response = await page.goto(url, {
            waitUntil: 'load',
            timeout: options.timeoutMs || CONFIG.crawler.defaultTimeoutMs,
          }).catch(() => null);
        }

        const isBlocked = !response || (response.status() === 403 || response.status() === 429 || response.status() === 503);
        if (isBlocked) {
          throw new Error(`Target website blocked server crawler with HTTP ${response ? response.status() : 'ERROR'}.`);
        }

        if (options.waitForSelector) {
          await page.waitForSelector(options.waitForSelector, { timeout: 10000 }).catch(() => {});
        } else {
          // Wait for SPA client containers (React / Next.js / Vue) to mount into DOM
          await page.waitForSelector('#root > *, #app > *, #__next > *, main, [role="main"], body > div', { timeout: 8000 }).catch(() => {});
        }
      }

      // 2. Trigger lazy loading, dynamic hydration, and animations
      onProgress?.('Triggering animations & lazy-loaded assets...', 30);
      await this.scrollAndSettlePage(page, hasSnapshot, (options as any).animationDelayMs || (options as any).settleWaitMs);
      await page.waitForTimeout(hasSnapshot ? 300 : CONFIG.crawler.settleWaitMs);

      // Dismiss cookie/GDPR banners on live page before capturing baselines
      await page.evaluate(() => {
        const cookieSelectors = [
          '[id*="onetrust-accept"]',
          '[class*="cookie"] button[class*="accept"]',
          '[class*="cookie"] button[class*="agree"]',
          'button[aria-label*="accept" i]',
          'button[aria-label*="agree" i]',
          '#truste-consent-button',
          '.cc-btn.cc-allow',
          '[id*="cookie-banner"] button',
          '[class*="cookie-banner"] button',
          '.cookie-banner button'
        ];
        for (const sel of cookieSelectors) {
          try {
            const btn = document.querySelector(sel) as HTMLElement;
            if (btn) btn.click();
          } catch {}
        }
      });
      await page.waitForTimeout(300);

      // Universal Navigation Blocker: Prevent link clicks, form submits, and redirects from destroying the page during exploration
      await page.evaluate(() => {
        window.addEventListener('beforeunload', (e) => {
          e.preventDefault();
          e.returnValue = '';
          return '';
        }, true);
        document.addEventListener('click', (e) => {
          const a = (e.target as HTMLElement)?.closest?.('a');
          if (a && a.getAttribute('href') && !a.getAttribute('href')?.startsWith('#')) {
            e.preventDefault();
          }
        }, true);
        document.addEventListener('submit', (e) => {
          e.preventDefault();
        }, true);
        try {
          window.history.pushState = function() {};
          window.history.replaceState = function() {};
        } catch {}
      });

      // 2b. Capture multi-viewport baselines for Visual QA
      onProgress?.('Capturing multi-viewport visual baselines...', 35);
      const baselineScreenshots: BaselineScreenshots = {};
      try {
        if (options.clientScreenshot) {
          try {
            const base64Data = options.clientScreenshot.replace(/^data:image\/\w+;base64,/, '');
            baselineScreenshots.desktop = Buffer.from(base64Data, 'base64');
          } catch (e) {
            console.warn('Failed to parse clientScreenshot buffer:', e);
          }
        }

        // Desktop baseline (1440x900) if not provided by client
        if (!baselineScreenshots.desktop) {
          await page.setViewportSize({ width: 1440, height: 900 });
          await page.waitForTimeout(200);
          baselineScreenshots.desktop = await page.screenshot({ fullPage: false, type: 'png' });
        }

        // Desktop menu hover baseline
        const desktopNav = await page.$('header nav li button, header nav li a, [class*="nav-items"] > li > button, [class*="nav-items"] > li > a, [role="navigation"] button, [role="navigation"] a');
        if (desktopNav) {
          await desktopNav.hover({ timeout: 1500 }).catch(() => {});
          await page.waitForTimeout(250);
          baselineScreenshots.desktopMenu = await page.screenshot({ fullPage: false, type: 'png' });
          await page.mouse.move(0, 0);
          await page.waitForTimeout(100);
        }

        // Tablet baseline (768x1024)
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.waitForTimeout(250);
        baselineScreenshots.tablet = await page.screenshot({ fullPage: false, type: 'png' });

        // Mobile baseline (390x844)
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(250);
        baselineScreenshots.mobile = await page.screenshot({ fullPage: false, type: 'png' });

        // Mobile menu toggle baseline
        const mobileToggle = await page.$('[class*="mobile-nav-toggle"], [class*="hamburger"], [aria-label*="menu" i], [class*="menu-btn"]');
        if (mobileToggle) {
          await mobileToggle.click({ timeout: 1500 }).catch(() => {});
          await page.waitForTimeout(300);
          baselineScreenshots.mobileMenu = await page.screenshot({ fullPage: false, type: 'png' });
        }

        // Reset to desktop viewport for full page screenshot and DOM extraction
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.waitForTimeout(200);
      } catch (baselineErr) {
        console.warn('Baseline screenshot capture skipped:', baselineErr);
      }

      // 2c. Reveal dynamic/hidden sections & sub-panels via interaction pass
      await this.revealDynamicSections(page);

      // 3. Capture full page screenshot
      onProgress?.('Capturing full page screenshot...', 40);
      const fullPageScreenshot = await page.screenshot({
        fullPage: true,
        type: 'png',
      });

      // Convert HTML5 canvas elements (used by WebGL / dynamic maps / charts) into data URLs so they persist offline
      await page.evaluate(() => {
        document.querySelectorAll('canvas').forEach((canvas) => {
          try {
            const dataUrl = canvas.toDataURL('image/png');
            if (dataUrl && dataUrl.length > 100) {
              const img = document.createElement('img');
              img.src = dataUrl;
              img.className = (canvas.className || '') + ' rep-canvas-replacement';
              img.style.cssText = canvas.style.cssText;
              img.setAttribute('width', String(canvas.width));
              img.setAttribute('height', String(canvas.height));
              canvas.parentNode?.replaceChild(img, canvas);
            }
          } catch {}
        });

        // Automatically hydrate lazy images and picture elements
        document.querySelectorAll('img').forEach((img) => {
          const dataSrc = img.getAttribute('data-desktop-src') ||
                          img.getAttribute('data-src') ||
                          img.getAttribute('data-original') ||
                          img.getAttribute('data-lazy-src') ||
                          img.getAttribute('data-mobile-src');
          if (dataSrc && (!img.src || img.src.startsWith('data:image/gif') || img.src.includes('base64,R0lG') || img.src === window.location.href)) {
            img.src = dataSrc.startsWith('//') ? 'https:' + dataSrc : dataSrc;
          }
        });
        document.querySelectorAll('source').forEach((source) => {
          const dataSrcset = source.getAttribute('data-srcset');
          if (dataSrcset && (!source.srcset || source.srcset.startsWith('data:image/gif') || source.srcset.includes('base64,R0lG'))) {
            source.srcset = dataSrcset.startsWith('//') ? 'https:' + dataSrcset : dataSrcset;
          }
        });

        // Normalize inline SVGs by stamping real computed dimensions
        document.querySelectorAll('svg').forEach((svg) => {
          try {
            const rect = svg.getBoundingClientRect();
            const comp = window.getComputedStyle(svg);
            const w = rect.width || parseFloat(comp.width) || parseFloat(svg.getAttribute('width') || '0');
            const h = rect.height || parseFloat(comp.height) || parseFloat(svg.getAttribute('height') || '0');
            const curW = svg.getAttribute('width');
            const curH = svg.getAttribute('height');

            if (w > 0 && h > 0 && (!curW || !curH || curW === '100%' || curH === '100%' || isNaN(Number(curW)))) {
              const roundedW = Math.round(w);
              const roundedH = Math.round(h);
              svg.setAttribute('width', String(roundedW));
              svg.setAttribute('height', String(roundedH));
              svg.style.width = `${roundedW}px`;
              svg.style.height = `${roundedH}px`;
              svg.style.maxWidth = '100%';
              svg.style.flexShrink = '0';
              if (!svg.getAttribute('viewBox')) {
                svg.setAttribute('viewBox', `0 0 ${roundedW} ${roundedH}`);
              }
            }
          } catch {}
        });
      });

      // 4. Extract rendered DOM and all CSS/JS
      onProgress?.('Extracting live DOM and stylesheets...', 50);
      const renderedHtml = await page.content();
      const extractedStylesheets = await page.evaluate(async () => {
        const results: { text: string; baseHref: string }[] = [];

        // Inline <style> tags
        document.querySelectorAll('style').forEach((st) => {
          if (st.textContent) {
            results.push({
              text: st.textContent,
              baseHref: document.baseURI || window.location.href,
            });
          }
        });

        // Embedded stylesheets from rules if accessible, or fetch in page context if cross-origin
        for (let i = 0; i < document.styleSheets.length; i++) {
          const sheet = document.styleSheets[i];
          const media = sheet.media ? sheet.media.mediaText.trim().toLowerCase() : '';
          if (media === 'print') continue;
          const baseHref = sheet.href || document.baseURI || window.location.href;
          let sheetText = '';
          try {
            if (sheet.cssRules && sheet.cssRules.length > 0) {
              for (let j = 0; j < sheet.cssRules.length; j++) {
                sheetText += sheet.cssRules[j].cssText + '\n';
              }
            }
          } catch {
            // Cross-origin stylesheet security restriction
          }

          if (!sheetText && sheet.href && !sheet.href.startsWith('chrome-extension://')) {
            try {
              const resp = await fetch(sheet.href);
              if (resp.ok) {
                sheetText = await resp.text();
              }
            } catch {}
          }

          if (sheetText) {
            results.push({ text: sheetText, baseHref });
          }
        }
        return results;
      });

      // Helper to resolve relative CSS URLs to canonical absolute URLs
      const resolveCssUrls = (cssText: string, base: string) => {
        return cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (fullMatch, quote, rawUrl) => {
          const trimmed = (rawUrl || '').trim();
          if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            return fullMatch;
          }
          try {
            return `url("${new URL(trimmed, base).href}")`;
          } catch {
            return fullMatch;
          }
        });
      };

      const resolvedStylesheets: string[] = [];
      // Merge network-intercepted stylesheets from CDN domains (CORS bypass)
      for (const [netUrl, netText] of networkCapturedCss.entries()) {
        resolvedStylesheets.push(resolveCssUrls(netText, netUrl));
      }

      if (options.clientStylesheets && options.clientStylesheets.length > 0) {
        for (const item of options.clientStylesheets) {
          if (item && item.trim()) {
            resolvedStylesheets.push(resolveCssUrls(item, url));
          }
        }
      }
      for (const item of extractedStylesheets) {
        resolvedStylesheets.push(resolveCssUrls(item.text, item.baseHref));
      }

      // Also gather external CSS links
      const $ = cheerio.load(renderedHtml);

      // Universal protocol-relative URL normalization
      $('[src], [href], [srcset], [poster], [data-src], [data-desktop-src], [data-original]').each((_, el) => {
        const $el = $(el);
        ['src', 'href', 'srcset', 'poster', 'data-src', 'data-desktop-src', 'data-original'].forEach((attr) => {
          let v = $el.attr(attr);
          if (v && typeof v === 'string') {
            if (v.startsWith('//')) {
              v = 'https:' + v;
              $el.attr(attr, v);
            }
          }
        });
      });

      // Ensure all images have their src populated from lazy attributes
      $('img').each((_, el) => {
        const $el = $(el);
        const curSrc = $el.attr('src');
        const dataSrc = $el.attr('data-desktop-src') || $el.attr('data-src') || $el.attr('data-original') || $el.attr('data-mobile-src');
        if ((!curSrc || curSrc.startsWith('data:image/gif') || curSrc.includes('base64,R0lG') || curSrc === '') && dataSrc) {
          $el.attr('src', dataSrc.startsWith('//') ? 'https:' + dataSrc : dataSrc);
        }
      });

      const externalCssLinks: string[] = [];
      $('link[rel="stylesheet"]').each((_, el) => {
        const media = $(el).attr('media');
        if (media && media.toLowerCase().trim() === 'print') return;
        const href = $(el).attr('href');
        if (href) {
          try {
            externalCssLinks.push(new URL(href, url).href);
          } catch {}
        }
      });

      // Fallback: fetch external stylesheets that could not be read via document.styleSheets
      for (const extHref of externalCssLinks) {
        try {
          const resp = await axios.get(extHref, {
            timeout: 8000,
            headers: {
              'User-Agent': CONFIG.crawler.userAgent,
              'Referer': url,
            },
          });
          if (typeof resp.data === 'string' && resp.data.trim()) {
            resolvedStylesheets.push(resolveCssUrls(resp.data, extHref));
          }
        } catch {
          // Ignore external stylesheet fetch failures
        }
      }

      // Extract inline scripts (ONLY executable JavaScript, ignore JSON data scripts)
      // Note: External <script src="..."> tags are preserved in HTML and downloaded by AssetLocalizer
      const inlineScripts: string[] = [];
      $('script:not([src])').each((_, el) => {
        const type = ($(el).attr('type') || '').toLowerCase().trim();
        if (
          type === '' ||
          type === 'text/javascript' ||
          type === 'application/javascript' ||
          type === 'module'
        ) {
          const scriptText = $(el).html();
          if (scriptText && scriptText.trim() && !isTrackingOrAnalytics(scriptText)) {
            inlineScripts.push(`/* [Authentic Inline Script] */\n(function() {\n  try {\n${scriptText}\n  } catch (e) {\n    // Protected inline script execution\n  }\n})();`);
          }
        }
      });
      const combinedJs = inlineScripts.join('\n\n');

      let combinedCss = resolvedStylesheets.join('\n\n');

      // 5. Discover top-level sections
      onProgress?.('Detecting and analyzing page sections...', 60);
      let rawSections = await this.detectSections(page, options.targetArchetype);

      if (options.sectionSelector && options.sectionSelector.trim() && options.sectionSelector !== 'section') {
        const matchedSection = rawSections.find((s) => s.selector === options.sectionSelector);
        if (matchedSection) {
          rawSections = [matchedSection];
        }
      } else if (options.targetArchetype === 'navbar') {
        const navSection = rawSections.find((s) => s.tagName === 'header' || s.tagName === 'nav' || s.selector.includes('header') || s.selector.includes('nav'));
        if (navSection) {
          rawSections = [navSection];
        }
      } else if (options.targetArchetype === 'hero') {
        // Universal Hero Isolation:
        // Score candidate sections using classifier heuristics (H1, hero classes, CTA, media, top position)
        let bestHeroCandidate = rawSections.find((s, idx) => {
          if (s.tagName === 'header' || s.tagName === 'nav' || s.selector.includes('header') || s.selector.includes('nav')) return false;
          const meta = this.classifier.classify({
            id: `s${idx + 1}`,
            index: idx,
            totalSections: rawSections.length,
            selector: s.selector,
            tagName: s.tagName,
            rect: { x: s.rect.x, y: s.rect.y, width: s.rect.width, height: s.rect.height },
            html: s.html,
          });
          return meta.archetype === 'hero';
        });

        if (!bestHeroCandidate) {
          // Fallback: first non-nav section with height >= 200 and top <= 800
          bestHeroCandidate = rawSections.find((s) => {
            const isNav = s.tagName === 'header' || s.tagName === 'nav' || s.selector.includes('header') || s.selector.includes('nav');
            return !isNav && s.rect.height >= 200 && s.rect.y <= 800;
          });
        }

        if (bestHeroCandidate) {
          rawSections = [bestHeroCandidate];
        }
      }

      // 6. Process each section: screenshot, classify, transform, purge
      onProgress?.('Classifying sections and transforming code...', 70);
      const extractedSections: ExtractedSection[] = [];
      const globalClassMapping: Record<string, string> = {};
      const globalIdMapping: Record<string, string> = {};

      for (let i = 0; i < rawSections.length; i++) {
        const raw = rawSections[i];
        const sectionId = `s${i + 1}`;

        // Classify section against master archetypes
        const meta = this.classifier.classify({
          id: sectionId,
          index: i,
          totalSections: rawSections.length,
          selector: raw.selector,
          tagName: raw.tagName,
          rect: raw.rect,
          html: raw.html,
        });

        // Take element screenshot if visible
        let screenshotBuffer: Buffer | undefined;
        try {
          const el = await page.$(raw.selector);
          if (el) {
            screenshotBuffer = await el.screenshot({ type: 'png' });
          }
        } catch {
          // If screenshot of element fails, continue
        }

        // Semantic transformation of HTML
        const transformed = this.htmlTransformer.transformSection(
          raw.html,
          sectionId,
          meta.archetype,
          url
        );

        // Record mappings
        Object.assign(globalClassMapping, transformed.classMapping);
        Object.assign(globalIdMapping, transformed.idMapping);

        // Transform CSS for this section
        const sectionTransformedCss = await CssTransformer.transformSelectors(
          combinedCss,
          transformed.classMapping,
          transformed.idMapping
        );

        // Purge and minify CSS for this section
        const purgeRes = await this.cssPurger.purge(sectionTransformedCss, transformed.cleanedHtml);

        // Transform and deminify JS relevant to this section
        const scopedJs = JsTransformer.transformScript(
          combinedJs,
          transformed.classMapping,
          transformed.idMapping
        );
        const beautifiedJs = await JsTransformer.deminify(scopedJs);

        extractedSections.push({
          meta,
          rawHtml: raw.html,
          cleanedHtml: transformed.cleanedHtml,
          purgedCss: purgeRes.purgedCss,
          minifiedCss: purgeRes.minifiedCss,
          scopedJs: beautifiedJs,
          classMapping: transformed.classMapping,
          idMapping: transformed.idMapping,
          screenshotBuffer,
        });
      }

      // 7. Full page transformation
      onProgress?.('Optimizing full page assets and links...', 85);

      // Cleaned full page HTML with rewritten internal links
      let transformedFullHtml = HtmlTransformer.rewriteInternalLinks(renderedHtml, url);

      // Preserve original clean classes on full page HTML to guarantee 100% layout fidelity without cross-section contamination

      // For full page CSS:
      // Preserve complete combined CSS to guarantee 100% offline visual fidelity
      const fullPageCss = options.deminify !== false
        ? await CssTransformer.beautify(combinedCss)
        : combinedCss;

      let fullPageMinCss = combinedCss;
      if (options.purgeCss !== false) {
        const globalPurge = await this.cssPurger.purge(combinedCss, transformedFullHtml);
        fullPageMinCss = globalPurge.minifiedCss || combinedCss;
      }

      // Transform global JS
      const beautifiedGlobalJs = await JsTransformer.deminify(combinedJs);

      onProgress?.('Completing extraction...', 95);

      return {
        fullPageScreenshot,
        baselineScreenshots,
        originalHtml: renderedHtml,
        transformedHtml: transformedFullHtml,
        originalCss: combinedCss,
        transformedCss: fullPageCss,
        minifiedCss: fullPageMinCss,
        originalJs: combinedJs,
        transformedJs: beautifiedGlobalJs,
        sections: extractedSections,
        assetCount: $('img, svg, picture, video').length,
        recordedInteractions: options.recordedInteractions,
      };
    } finally {
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
    }
  }

  private async scrollAndSettlePage(page: any, isSnapshot: boolean = false, customDelayMs?: number): Promise<void> {
    if (isSnapshot) {
      // For client-provided DOM snapshots, DOM is already fully hydrated and animated
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(300);
      return;
    }

    // 1. Scroll through page smoothly in steps with pauses so IntersectionObservers fire
    await page.evaluate(async () => {
      const scrollStep = Math.max(350, Math.floor(window.innerHeight * 0.7));
      const maxScroll = Math.min(document.body.scrollHeight, 25000);

      // Scroll down step-by-step
      for (let y = 0; y < maxScroll; y += scrollStep) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 180));
      }

      // Settle at the bottom of the page where talent / footer / async sections are
      window.scrollTo(0, maxScroll);
      await new Promise((r) => setTimeout(r, 1200));

      // Scroll back up step-by-step
      for (let y = maxScroll; y > 0; y -= scrollStep * 2) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 100));
      }
      window.scrollTo(0, 0);
    });

    // 2. Wait for network requests to settle
    await page.waitForLoadState('networkidle', { timeout: 3500 }).catch(() => {});

    // 3. Monitor dynamic skeleton loaders / pulse animations / placeholders
    const settleStart = Date.now();
    while (Date.now() - settleStart < 4500) {
      const hasActiveSkeletons = await page.evaluate(() => {
        const skeletons = document.querySelectorAll(
          '.animate-pulse, [class*="skeleton"], [class*="loading-placeholder"], .exclusive-offers-empty'
        );
        return skeletons.length > 0;
      });
      if (!hasActiveSkeletons) break;
      await page.waitForTimeout(400);
    }

    // 4. Ensure dynamic maps, webgl, and async widgets are triggered into view for hydration
    await page.evaluate(async () => {
      const widgets = document.querySelectorAll(
        '[data-component-status], [class*="map-component"], [id*="map"], [class*="charging-map"], [data-testid*="map"], [class*="store-locator"]'
      );
      for (const w of Array.from(widgets)) {
        w.scrollIntoView({ behavior: 'auto', block: 'center' });
      }
    });
    await page.waitForTimeout(600);

    // 5. Expand catalog / products "View More" if present to capture full product catalog
    try {
      await page.evaluate(async () => {
        const isCatalogViewMore = (el: Element) => {
          if (!el || el.closest('[class*="filter"]') || el.closest('[class*="sidebar"]') || el.closest('[class*="selector-item"]')) return false;
          const txt = (el.textContent || '').trim().toLowerCase();
          const cls = (el.className || '').toLowerCase();
          const anLa = (el.getAttribute('an-la') || '').toLowerCase();
          return (txt.includes('view more') || txt.includes('load more') || txt.includes('show more') ||
                 cls.includes('view-more') || cls.includes('load-more') ||
                 anLa.includes('view more') || anLa.includes('load more')) &&
                 !cls.includes('close') && !cls.includes('cancel');
        };

        const cardCandidates = Array.from(document.querySelectorAll(
          'article, [role="listitem"], [class*="product-card"], [class*="product-item"], [class*="catalog-item"], [class*="card"]'
        )).filter(el => {
          const cls = (el.className || '').toLowerCase();
          return !cls.includes('filter') && !cls.includes('nav') && !cls.includes('header') && !el.closest('[class*="filter"]');
        });

        if (cardCandidates.length > 0) {
          cardCandidates.forEach((c, idx) => {
            c.setAttribute('data-card-index', String(idx));
            c.setAttribute('data-initial-batch', 'true');
          });

          let clicks = 0;
          let lastCount = cardCandidates.length;
          while (clicks < 6) {
            const btn = Array.from(document.querySelectorAll('button, a, [role="button"]')).find(isCatalogViewMore);
            if (!btn || (btn as HTMLElement).offsetParent === null || (btn as HTMLButtonElement).disabled) break;
            (btn as HTMLElement).click();
            await new Promise(r => setTimeout(r, 800));

            const currentCards = Array.from(document.querySelectorAll(
              'article, [role="listitem"], [class*="product-card"], [class*="product-item"], [class*="catalog-item"], [class*="card"]'
            )).filter(el => {
              const cls = (el.className || '').toLowerCase();
              return !cls.includes('filter') && !cls.includes('nav') && !cls.includes('header') && !el.closest('[class*="filter"]');
            });

            if (currentCards.length > lastCount) {
              for (let i = lastCount; i < currentCards.length; i++) {
                currentCards[i].setAttribute('data-card-index', String(i));
                currentCards[i].setAttribute('data-dynamic-batch', 'true');
                currentCards[i].setAttribute('data-batch-page', String(clicks + 2));
              }
              lastCount = currentCards.length;
              clicks++;
            } else {
              break;
            }
          }
        }
      });
    } catch {}

    // 6. Pre-hover header navigation elements (including Samsung GNB, BEM l0-menu, and aria-haspopup items)
    try {
      const navHandles = await page.$$(
        'header nav li button, header nav li a, [class*="nav-items"] > li > button, [class*="nav-items"] > li > a, [role="navigation"] button, [role="navigation"] a, [class*="l0-menu"] button, [class*="l0-menu"] a, [class*="gnb"] button, [class*="gnb"] a, button[aria-haspopup="true"], [role="button"][aria-haspopup="true"]'
      );
      for (let i = 0; i < Math.min(navHandles.length, 12); i++) {
        await navHandles[i].hover({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(300); // Allow full CSS transition & DOM render
      }
      await page.mouse.move(0, 0);

      // Reset any dialogs, backdrops, and body scroll locks triggered during hover
      await page.evaluate(() => {
        document.body.classList.remove('overflow-hidden', 'menu-open');
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        document.querySelectorAll('dialog[open]').forEach((d) => d.removeAttribute('open'));
        document.querySelectorAll('.open, .mobile-open, [class*="modal--open"]').forEach((el) => el.classList.remove('open', 'mobile-open'));
      });
    } catch {}

    // 7. Active Carousel Discovery & Cycling (Hydrates all slides & lazy images across carousels)
    try {
      await page.evaluate(async () => {
        const carouselContainers = Array.from(document.querySelectorAll(
          '[class*="carousel"], [class*="slider"], [class*="swiper"], [class*="slick"], [role="region"][aria-roledescription="carousel"]'
        )).filter(el => {
          const cls = (el.className || '').toLowerCase();
          return !cls.includes('nav') && !cls.includes('header') && !cls.includes('menu');
        });

        for (const container of carouselContainers.slice(0, 5)) {
          const nextBtn = container.querySelector(
            'button[class*="next"], [class*="navigator__button--next"], .swiper-button-next, .slick-next, [class*="arrow-next"], [aria-label*="next" i], [class*="indicator--next"], [class*="indicator__arrow"][class*="next"], button[data-testid*="next" i]'
          );
          if (nextBtn && (nextBtn as HTMLElement).offsetParent !== null) {
            container.scrollIntoView({ behavior: 'auto', block: 'center' });
            await new Promise(r => setTimeout(r, 200));

            // Cycle next slides to trigger dynamic slide DOM and lazy images
            for (let c = 0; c < 3; c++) {
              (nextBtn as HTMLElement).click();
              await new Promise(r => setTimeout(r, 350));
            }

            // Cycle back to initial slide
            const prevBtn = container.querySelector(
              'button[class*="prev"], [class*="navigator__button--prev"], .swiper-button-prev, .slick-prev, [class*="arrow-prev"], [aria-label*="prev" i], [class*="indicator--prev"], [class*="indicator__arrow"][class*="prev"]'
            );
            if (prevBtn && (prevBtn as HTMLElement).offsetParent !== null) {
              for (let c = 0; c < 3; c++) {
                (prevBtn as HTMLElement).click();
                await new Promise(r => setTimeout(r, 150));
              }
            }
          }
        }
      });
    } catch {}

    // 8. Universal Lazy Media Promotion in live DOM
    await page.evaluate(() => {
      document.querySelectorAll('img').forEach((img) => {
        const lazySrc = img.getAttribute('data-desktop-src') || img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('data-lazy-src');
        if (lazySrc && (!img.src || img.src.startsWith('data:image/gif') || img.src.startsWith('data:image/svg'))) {
          img.src = lazySrc;
        }
        const lazySrcset = img.getAttribute('data-srcset');
        if (lazySrcset && !img.srcset) {
          img.srcset = lazySrcset;
        }
      });
      document.querySelectorAll('picture source').forEach((s) => {
        const dSet = s.getAttribute('data-srcset');
        if (dSet && !s.getAttribute('srcset')) {
          s.setAttribute('srcset', dSet);
        }
      });
    });

    // 9. Animation Settling Window (Allow page animations to play; supports user delay up to 120s / 2 mins)
    const settleDelay = Math.min(customDelayMs || 2000, 120000);
    await page.waitForTimeout(settleDelay);
  }

  private async detectSections(page: any, targetArchetype?: string): Promise<
    Array<{
      selector: string;
      tagName: string;
      rect: { x: number; y: number; width: number; height: number };
      html: string;
    }>
  > {
    return await page.evaluate((targetArch: string | undefined) => {
      const results: Array<{
        selector: string;
        tagName: string;
        rect: { x: number; y: number; width: number; height: number };
        html: string;
      }> = [];

      const isElementVisible = (el: Element) => {
        if (!el || el.nodeType !== 1) return false;
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        // Modern award-winning sites have resting animation states before scroll trigger (opacity: 0, visibility: hidden).
        // Never discard valid content sections solely because their initial resting opacity is 0!
        const hasContent = (el.textContent && el.textContent.trim().length > 0) || el.querySelector('img, video, canvas, svg') !== null;
        return (
          s.display !== 'none' &&
          (r.height > 0 || (el as HTMLElement).scrollHeight > 20 || hasContent)
        );
      };

      const ignoredTags = new Set([
        'script',
        'style',
        'noscript',
        'svg',
        'iframe',
        'template',
        'link',
        'meta',
      ]);

      // 1. Locate Header / Nav landmarks
      const candidateElements: Element[] = [];
      const allHeaders = Array.from(document.querySelectorAll('header, [role="banner"], nav, [role="navigation"], [class*="header"]'));
      const header = allHeaders.find((el) => {
        const r = el.getBoundingClientRect();
        return isElementVisible(el) && r.top <= 80 && (r.height >= 20 || (el as HTMLElement).scrollHeight >= 20);
      });

      if (header) {
        candidateElements.push(header);
      }

      if (targetArch === 'navbar') {
        const otherNavs = document.querySelectorAll('header, nav, [role="banner"], [role="navigation"]');
        otherNavs.forEach((n) => {
          if (!candidateElements.includes(n) && isElementVisible(n)) {
            candidateElements.push(n);
          }
        });
      } else {
        // 2. Locate Footer landmark
        const footer = document.querySelector('footer, [role="contentinfo"], [class*="page-footer"]:not([class*="section"])');

        // 3. Recursive unrolling of wrapper containers (Magento, Elementor, Shopify, Webflow, React root)
        const unwrapToSections = (container: Element, depth = 0): Element[] => {
          if (!container || depth > 8) return [];
          const visibleChildren = Array.from(container.children).filter((c) => {
            const tag = c.tagName.toLowerCase();
            if (ignoredTags.has(tag)) return false;
            if (c === header || c === footer) return false;
            return isElementVisible(c);
          });

          if (visibleChildren.length === 0) return [];

          // If single visible child and it's a wrapper tag, drill down
          if (visibleChildren.length === 1) {
            const only = visibleChildren[0];
            const tag = only.tagName.toLowerCase();
            if (['div', 'main', 'section', 'article'].includes(tag)) {
              return unwrapToSections(only, depth + 1);
            }
            return [only];
          }

          // Multiple visible children. Check if any child is an abnormally tall wrapper (> 1200px) or contains sub-sections
          const result: Element[] = [];
          for (const child of visibleChildren) {
            const r = child.getBoundingClientRect();
            const tag = child.tagName.toLowerCase();
            const scrollH = (child as HTMLElement).scrollHeight || 0;
            const hasSubSections = child.querySelectorAll('section, article, [class*="section"], [class*="hero-"]').length > 1;
            if (r.height > 1200 || scrollH > 1200 || hasSubSections || tag === 'main') {
              const sub = unwrapToSections(child, depth + 1);
              if (sub.length > 1) {
                result.push(...sub);
                continue;
              }
            }
            result.push(child);
          }
          return result;
        };

        const mainContainer =
          document.querySelector('main, #__next, #app, #root, #main, .main-content, .page-wrapper') ||
          document.body;

        const bodySections = unwrapToSections(mainContainer);
        bodySections.forEach((s) => {
          if (!candidateElements.includes(s) && s !== footer) {
            candidateElements.push(s);
          }
        });

        if (footer && isElementVisible(footer) && !candidateElements.includes(footer)) {
          candidateElements.push(footer);
        }
      }

      // De-duplicate and filter nested candidates so top-level containers own their subcomponents
      const rawCandidates = Array.from(new Set(candidateElements));
      const uniqueElements = rawCandidates.filter((el) => {
        return !rawCandidates.some((other) => other !== el && other.contains(el));
      });

      // Filter and collect geometry
      let validSectionIndex = 0;
      uniqueElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const tag = el.tagName.toLowerCase();
        const isHeaderOrNav = tag === 'header' || tag === 'nav';

        // Must have reasonable visible size: headers/nav can be as thin as 20px, body sections >= 45px
        if (
          (isHeaderOrNav && (rect.height < 20 || rect.width < 200)) ||
          (!isHeaderOrNav && (rect.height < 45 || rect.width < 200))
        ) {
          return;
        }

        // Stamp deterministic tracking attribute to ensure 100% selector fidelity
        el.setAttribute('data-rep-section', String(validSectionIndex));
        const sel = `[data-rep-section="${validSectionIndex}"]`;
        validSectionIndex++;

        results.push({
          selector: sel,
          tagName: tag,
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y + window.scrollY),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          html: el.outerHTML,
        });
      });

      return results;
    }, targetArchetype);
  }

  /**
   * Universally hovers and focuses interactive triggers to reveal dynamic submenus and portals.
   * Explicitly waits for CSS animations, Framer Motion, and React portal mounts (300ms).
   */
  private async revealDynamicSections(page: any): Promise<void> {
    try {
      const handles = await page.$$(
        'header button, header a, nav button, nav a, [role="navigation"] button, [role="navigation"] a, [aria-haspopup], [aria-expanded], [data-dropdown], [data-toggle], [class*="nav-item"] button, [class*="nav-item"] a, [class*="filter"] button, [role="tab"]'
      );
      for (const h of handles.slice(0, 16)) {
        try {
          if (await h.isVisible().catch(() => false)) {
            const box = await h.boundingBox().catch(() => null);
            if (box && box.width > 0 && box.height > 0) {
              await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
              await page.waitForTimeout(200);
            }
          }
        } catch {}
      }
      await page.mouse.move(0, 0);
      await page.waitForTimeout(200);
    } catch (e) {
      console.warn('[PageExtractor] Dynamic section reveal pass skipped:', e);
    }
  }
}

function escapeSelector(str: string): string {
  return str.replace(/([#.:>+~*[\]^$="()])/g, '\\$1');
}
