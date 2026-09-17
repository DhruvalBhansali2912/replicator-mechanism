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

export interface ExtractionResult {
  fullPageScreenshot: Buffer;
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
      // 1. Visit URL
      onProgress?.('Navigating to target URL...', 20);
      try {
        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: options.timeoutMs || CONFIG.crawler.defaultTimeoutMs,
        });
      } catch {
        // Fallback to load state
        await page.goto(url, {
          waitUntil: 'load',
          timeout: options.timeoutMs || CONFIG.crawler.defaultTimeoutMs,
        });
      }

      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, { timeout: 10000 }).catch(() => {});
      }

      // 2. Trigger lazy loading and animations
      onProgress?.('Triggering animations & lazy-loaded assets...', 30);
      await this.scrollPage(page);
      await page.waitForTimeout(CONFIG.crawler.settleWaitMs);

      // 3. Capture full page screenshot
      onProgress?.('Capturing full page screenshot...', 40);
      const fullPageScreenshot = await page.screenshot({
        fullPage: true,
        type: 'png',
      });

      // 4. Extract rendered DOM and all CSS/JS
      onProgress?.('Extracting live DOM and stylesheets...', 50);
      const renderedHtml = await page.content();
      const extractedStylesheets = await page.evaluate(() => {
        const cssTexts: string[] = [];
        // Inline <style> tags
        document.querySelectorAll('style').forEach((st) => {
          if (st.textContent) cssTexts.push(st.textContent);
        });
        // Embedded stylesheets from rules if accessible
        for (let i = 0; i < document.styleSheets.length; i++) {
          try {
            const sheet = document.styleSheets[i];
            let sheetText = '';
            for (let j = 0; j < sheet.cssRules.length; j++) {
              sheetText += sheet.cssRules[j].cssText + '\n';
            }
            if (sheetText) cssTexts.push(sheetText);
          } catch {
            // Cross-origin stylesheet security restriction, will fallback to fetching links
          }
        }
        return cssTexts;
      });

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

      // Extract inline scripts
      const inlineScripts: string[] = [];
      $('script').each((_, el) => {
        const scriptText = $(el).html();
        if (scriptText && scriptText.trim()) {
          inlineScripts.push(scriptText);
        }
      });
      const combinedJs = inlineScripts.join('\n;\n');

      let combinedCss = extractedStylesheets.join('\n\n');

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

      // Cleaned full page HTML with rewritten internal links & semantic classes
      let transformedFullHtml = HtmlTransformer.rewriteInternalLinks(renderedHtml, url);
      const $full = cheerio.load(transformedFullHtml);

      // Apply section class transformations to full page DOM
      for (const [oldCls, newCls] of Object.entries(globalClassMapping)) {
        $full(`.${escapeSelector(oldCls)}`).each((_, el) => {
          const $el = $full(el);
          $el.removeClass(oldCls);
          $el.addClass(newCls);
        });
      }
      for (const [oldId, newId] of Object.entries(globalIdMapping)) {
        $full(`#${escapeSelector(oldId)}`).attr('id', newId);
      }

      transformedFullHtml = $full.html();

      // Transform global CSS
      const transformedGlobalCss = await CssTransformer.transformSelectors(
        combinedCss,
        globalClassMapping,
        globalIdMapping
      );
      const globalPurge = await this.cssPurger.purge(transformedGlobalCss, transformedFullHtml);

      // Transform global JS
      const transformedGlobalJs = JsTransformer.transformScript(
        combinedJs,
        globalClassMapping,
        globalIdMapping
      );
      const beautifiedGlobalJs = await JsTransformer.deminify(transformedGlobalJs);

      onProgress?.('Completing extraction...', 95);

      return {
        fullPageScreenshot,
        originalHtml: renderedHtml,
        transformedHtml: transformedFullHtml,
        originalCss: combinedCss,
        transformedCss: globalPurge.purgedCss,
        minifiedCss: globalPurge.minifiedCss,
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

  private async scrollPage(page: any): Promise<void> {
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 400;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight || totalHeight > 15000) {
            clearInterval(timer);
            window.scrollTo(0, 0); // Scroll back to top
            resolve();
          }
        }, 150);
      });
    });
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
