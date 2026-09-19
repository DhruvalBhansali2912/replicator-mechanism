import { BrowserManager } from './browser.js';
import { SectionClassifier } from '../classifier/section-classifier.js';
import { HtmlTransformer } from '../transformer/html-transformer.js';
import { CssTransformer } from '../transformer/css-transformer.js';
import { JsTransformer } from '../transformer/js-transformer.js';
import { CssPurger } from '../optimizer/css-purger.js';
import { AssetLocalizer } from '../localizer/asset-localizer.js';
import { ExtractionOptions, ExtractedSection, JobState } from '../types.js';
import { CONFIG } from '../config.js';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

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
}

export class PageExtractor {
  private classifier = new SectionClassifier();
  private htmlTransformer = new HtmlTransformer();
  private cssPurger = new CssPurger();

  public async extract(
    url: string,
    options: ExtractionOptions,
    onProgress?: (step: string, progress: number) => void
  ): Promise<ExtractionResult> {
    onProgress?.('Launching browser and opening page...', 10);
    const { context, page } = await BrowserManager.createPage({
      mobile: options.mobile,
      viewportWidth: options.viewportWidth,
      viewportHeight: options.viewportHeight,
    });

    try {
      // 1. Visit URL / Load Snapshot
      const hasSnapshot = !!(options.htmlSnapshot && options.htmlSnapshot.length > 500);

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
      await this.scrollAndSettlePage(page, hasSnapshot);
      await page.waitForTimeout(hasSnapshot ? 300 : CONFIG.crawler.settleWaitMs);

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
        const desktopNav = await page.$('header nav li button, header nav li a, ol.tds-align--center > li > button, ol.tds-align--center > li > a, [role="navigation"] button, [role="navigation"] a');
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
        const mobileToggle = await page.$('.tds-mobile-nav-toggle, [class*="mobile-nav-toggle"], [class*="hamburger"], [aria-label*="menu" i], [class*="menu-btn"]');
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
      const externalCssLinks: string[] = [];
      $('link[rel="stylesheet"]').each((_, el) => {
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
      const inlineScripts: string[] = [];
      $('script').each((_, el) => {
        const type = ($(el).attr('type') || '').toLowerCase().trim();
        const src = $(el).attr('src');
        if (src) return; // External script, kept in HTML or handled by localizer
        if (
          type === '' ||
          type === 'text/javascript' ||
          type === 'application/javascript' ||
          type === 'module'
        ) {
          const scriptText = $(el).html();
          if (scriptText && scriptText.trim()) {
            inlineScripts.push(`(function() {\n  try {\n${scriptText}\n  } catch (e) {\n    // Protected inline script execution\n  }\n})();`);
          }
        }
      });
      const combinedJs = inlineScripts.join('\n\n');

      let combinedCss = resolvedStylesheets.join('\n\n');

      // 5. Discover top-level sections
      onProgress?.('Detecting and analyzing page sections...', 60);
      const rawSections = await this.detectSections(page);

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
      };
    } finally {
      await page.close();
      await context.close();
    }
  }

  private async scrollAndSettlePage(page: any, isSnapshot: boolean = false): Promise<void> {
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
    // Wait until placeholders are replaced by real content (up to 4.5 seconds max)
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

    // 5. Pre-hover header navigation elements to trigger dynamic SPA hydration & render dropdown DOM
    try {
      const navHandles = await page.$$(
        'header nav li button, header nav li a, ol.tds-align--center > li > button, ol.tds-align--center > li > a, [role="navigation"] button, [role="navigation"] a'
      );
      for (let i = 0; i < Math.min(navHandles.length, 8); i++) {
        await navHandles[i].hover({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(150);
      }
      await page.mouse.move(0, 0);

      // Reset any dialogs, backdrops, and body scroll locks triggered during hover
      await page.evaluate(() => {
        document.body.classList.remove('tds-modal--is-open', 'tds-site-header-panel--is-open', 'overflow-hidden');
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        document.querySelectorAll('dialog[open]').forEach((d) => d.removeAttribute('open'));
        document.querySelectorAll('.open, .tds-modal--open, .mobile-open').forEach((el) => el.classList.remove('open', 'tds-modal--open', 'mobile-open'));
      });
    } catch {}
  }

  private async detectSections(page: any): Promise<
    Array<{
      selector: string;
      tagName: string;
      rect: { x: number; y: number; width: number; height: number };
      html: string;
    }>
  > {
    return await page.evaluate(() => {
      const results: Array<{
        selector: string;
        tagName: string;
        rect: { x: number; y: number; width: number; height: number };
        html: string;
      }> = [];

      // Look for semantic landmarks or containers
      const candidateElements: Element[] = [];

      // Check header / nav
      const header = document.querySelector('header, nav, [role="banner"], [role="navigation"]');
      if (header) candidateElements.push(header);

      // Check main wrapper children or direct body children
      const main = document.querySelector('main, #__next, #app, #root, #main, .main-content');
      const rootContainer = main || document.body;

      Array.from(rootContainer.children).forEach((child) => {
        const tag = child.tagName.toLowerCase();
        if (
          tag === 'script' ||
          tag === 'style' ||
          tag === 'noscript' ||
          tag === 'svg' ||
          tag === 'iframe'
        ) {
          return;
        }

        // If main has sections inside, prefer those
        if (child === main && child.children.length > 0) {
          Array.from(child.children).forEach((grandchild) => {
            candidateElements.push(grandchild);
          });
        } else {
          candidateElements.push(child);
        }
      });

      // Footer
      const footer = document.querySelector('footer, [role="contentinfo"]');
      if (footer && !candidateElements.includes(footer)) {
        candidateElements.push(footer);
      }

      // De-duplicate
      const uniqueElements = Array.from(new Set(candidateElements));

      // Filter and collect geometry
      uniqueElements.forEach((el, idx) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);

        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return;
        }

        // Must have reasonable visible size
        if (rect.height < 45 || rect.width < 250) {
          return;
        }

        // Generate a unique CSS selector
        let sel = '';
        if (el.id) {
          sel = `#${el.id}`;
        } else if (el.tagName.toLowerCase() === 'header' || el.tagName.toLowerCase() === 'nav' || el.tagName.toLowerCase() === 'footer') {
          sel = el.tagName.toLowerCase();
        } else {
          sel = `${el.tagName.toLowerCase()}:nth-of-type(${Array.from(el.parentElement?.children || []).indexOf(el) + 1})`;
        }

        results.push({
          selector: sel,
          tagName: el.tagName.toLowerCase(),
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
    });
  }
}

function escapeSelector(str: string): string {
  return str.replace(/([#.:>+~*[\]^$="()])/g, '\\$1');
}
