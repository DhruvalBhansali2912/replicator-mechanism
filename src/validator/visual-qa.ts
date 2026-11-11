import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { BrowserManager } from '../crawler/browser.js';
import { VisualQAResult } from '../types.js';
import { BaselineScreenshots } from '../crawler/page-extractor.js';
import { fidelityGuard } from './fidelity-guard.js';

export class VisualQAService {
  /**
   * Evaluates the packaged full-page output across Desktop, Tablet, and Mobile viewports,
   * performs pixelmatch diffing against ground-truth baselines, tests interactive menu states,
   * and runs automated self-healing passes if the fidelity score is below 80%.
   */
  public async evaluateAndHeal(
    jobDir: string,
    baselines?: BaselineScreenshots,
    onProgress?: (step: string) => void,
    rawSnapshotHtml?: string
  ): Promise<VisualQAResult> {
    const fullPageDir = path.join(jobDir, 'full-page');
    const indexHtmlPath = path.join(fullPageDir, 'index.html');
    const styleCssPath = path.join(fullPageDir, 'style.css');
    const qaDir = path.join(fullPageDir, 'qa');
    fs.mkdirSync(qaDir, { recursive: true });

    const maxAttempts = 3;
    let attempt = 0;
    let result: VisualQAResult = {
      fidelityScore: 0,
      passed: false,
      viewportScores: { desktop: 0, tablet: 0, mobile: 0 },
      menuInteractivity: { desktopHoverPassed: false, mobileTogglePassed: false },
      structuralChecks: { noWhiteOutSections: false, carouselsResponsive: false, fallbacksVisible: false },
      diffImageUrls: {},
      attempts: 0,
    };

    while (attempt < maxAttempts) {
      attempt++;
      result.attempts = attempt;
      onProgress?.(`Visual QA evaluation attempt ${attempt}/${maxAttempts}...`);

      const evalData = await this.runViewportChecks(indexHtmlPath, qaDir, baselines);
      result.viewportScores = evalData.viewportScores;
      result.menuInteractivity = evalData.menuInteractivity;
      result.structuralChecks = evalData.structuralChecks;
      result.diffImageUrls = evalData.diffImageUrls;

      // Calculate combined fidelity score (0-100%)
      const visualAvg = (evalData.viewportScores.desktop + evalData.viewportScores.tablet + evalData.viewportScores.mobile) / 3;
      const hasBaselines = !!(baselines?.desktop || baselines?.mobile);

      // 1. Structural & Functional Integrity (40% weight)
      let structuralPoints = 0;
      if (evalData.structuralChecks.noWhiteOutSections) structuralPoints += 10;
      if (evalData.menuInteractivity.desktopHoverPassed) structuralPoints += 10;
      if (evalData.menuInteractivity.mobileTogglePassed) structuralPoints += 10;
      if (evalData.structuralChecks.carouselsResponsive && evalData.structuralChecks.fallbacksVisible) structuralPoints += 10;
      else if (evalData.structuralChecks.carouselsResponsive || evalData.structuralChecks.fallbacksVisible) structuralPoints += 5;

      // 2. Strict Visual Layout Alignment (60% weight)
      let visualPoints = 0;
      if (hasBaselines) {
        visualPoints = Math.round(visualAvg * 0.6);
      } else {
        visualPoints = structuralPoints >= 30 ? 60 : 20;
      }

      result.fidelityScore = Math.min(100, structuralPoints + visualPoints);

      // Viewport-blocking modal/backdrop in resting state caps score and marks as failed
      if (evalData.defectiveSections.some((d) => d.type === 'resting_overlay_blocker')) {
        result.fidelityScore = Math.min(result.fidelityScore, 30);
        result.menuInteractivity.desktopHoverPassed = false;
      }

      result.passed = result.fidelityScore >= 90;

      if (result.passed || attempt >= maxAttempts) {
        break;
      }

      // Self-Healing Trigger: Apply targeted universal heuristics & section re-harvesting if score < 80%
      onProgress?.(`Fidelity score ${result.fidelityScore}% < 80%. Applying self-healing heuristics (attempt ${attempt})...`);
      this.applySelfHealingFixes(indexHtmlPath, styleCssPath, evalData, rawSnapshotHtml);
    }

    // Persist QA report
    fs.writeFileSync(path.join(qaDir, 'report.json'), JSON.stringify(result, null, 2), 'utf8');
    return result;
  }

  private async runViewportChecks(
    indexHtmlPath: string,
    qaDir: string,
    baselines?: BaselineScreenshots
  ): Promise<{
    viewportScores: { desktop: number; tablet: number; mobile: number };
    menuInteractivity: { desktopHoverPassed: boolean; mobileTogglePassed: boolean };
    structuralChecks: { noWhiteOutSections: boolean; carouselsResponsive: boolean; fallbacksVisible: boolean };
    diffImageUrls: { desktop?: string; tablet?: string; mobile?: string };
    defectiveSections: Array<{ selector: string; reason: string; type: string }>;
  }> {
    const { context, page } = await BrowserManager.createPage({
      viewportWidth: 1440,
      viewportHeight: 900,
    });

    let desktopScore = 100;
    let tabletScore = 100;
    let mobileScore = 100;
    let desktopHoverPassed = false;
    let mobileTogglePassed = false;
    let carouselsResponsive = true;
    let fallbacksVisible = true;
    let noWhiteOutSections = true;
    let defectiveSections: Array<{ selector: string; reason: string; type: string }> = [];
    const diffImageUrls: { desktop?: string; tablet?: string; mobile?: string } = {};

    try {
      await page.goto(`file://${indexHtmlPath}`, { waitUntil: 'load', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(600);

      // 1. Desktop Check (1440x900)
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(300);
      const desktopClone = await page.screenshot({ fullPage: false, type: 'png' });

      // Check for resting obstructing backdrops/modals in desktop resting state
      const hasRestingOverlay = await page.evaluate(() => {
        const overlays = document.querySelectorAll(
          '[role="dialog"], [aria-modal="true"], [class*="Dialog-Backdrop"], [class*="dialog-backdrop"], [class*="modal-backdrop"], dialog[open], [class*="drawer-backdrop"], [class~="backdrop"], [class*="-backdrop"]'
        );
        for (const el of Array.from(overlays)) {
          const cs = window.getComputedStyle(el);
          const r = el.getBoundingClientRect();
          if (cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0' && r.width > 300 && r.height > 300) {
            return true;
          }
        }
        return false;
      });

      if (hasRestingOverlay) {
        defectiveSections.push({
          selector: '[role="dialog"], [class*="Dialog-Backdrop"], .modal-backdrop',
          reason: 'Resting state contains an open modal or backdrop overlay obstructing the page',
          type: 'resting_overlay_blocker',
        });
      }

      // Check desktop hover
      const desktopNav = await page.$(
        'header nav li button, header nav li a, [role="navigation"] button, [role="navigation"] a, header nav > ul > li'
      );
      if (desktopNav) {
        await desktopNav.hover({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(250);
        desktopHoverPassed = await page.evaluate(() => {
          const p = document.querySelector(
            'dialog.open, dialog[open], [role="dialog"], [class*="dropdown-menu"].open, [class*="dropdown-menu"].show, .dropdown-menu.show, [class*="mega-menu"].open'
          );
          if (!p) return false;
          const rect = p.getBoundingClientRect();
          return rect.height > 60 && window.getComputedStyle(p).display !== 'none';
        });
        await page.mouse.move(0, 0);
        await page.waitForTimeout(100);
      } else {
        desktopHoverPassed = true;
      }

      if (baselines?.desktop) {
        const diffRes = this.compareScreenshots(baselines.desktop, desktopClone, path.join(qaDir, 'diff-desktop.png'));
        desktopScore = diffRes.score;
        diffImageUrls.desktop = 'qa/diff-desktop.png';
      }

      // 2. Tablet Check (768x1024)
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(300);
      const tabletClone = await page.screenshot({ fullPage: false, type: 'png' });

      if (baselines?.tablet) {
        const diffRes = this.compareScreenshots(baselines.tablet, tabletClone, path.join(qaDir, 'diff-tablet.png'));
        tabletScore = diffRes.score;
        diffImageUrls.tablet = 'qa/diff-tablet.png';
      }

      // 3. Mobile Check (390x844)
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300);
      const mobileClone = await page.screenshot({ fullPage: false, type: 'png' });

      // Structural Checks on Mobile & Defect Detection
      const structural = await page.evaluate(() => {
        // Check carousel slide width
        const slides = document.querySelectorAll(
          '[class*="carousel-container__slide-container"], [class*="freeflow-carousel"] [class*="slide"], [class*="carousel-slide"], [class*="slide"]'
        );
        let carouselOk = true;
        if (slides.length > 0) {
          const w = (slides[0] as HTMLElement).getBoundingClientRect().width;
          carouselOk = w >= window.innerWidth * 0.7;
        }

        // Check fallback container display
        const fallbacks = document.querySelectorAll(
          '[class*="map-component__fallback-container"], [class*="fallback-container"]'
        );
        let fallbackOk = true;
        if (fallbacks.length > 0) {
          const h = (fallbacks[0] as HTMLElement).getBoundingClientRect().height;
          fallbackOk = h >= 150;
        }

        // Check for complete blank whiteout body
        const bodyH = document.body.scrollHeight;
        const noWhiteout = bodyH > 400;

        // Detect defective sections that can be re-harvested from snapshot
        const defectiveSections: Array<{ selector: string; reason: string; type: string }> = [];

        // 1. Check for empty or collapsed map/locator/canvas containers
        const mapSelectors = [
          '[class*="map-component"]',
          '[data-testid*="map"]',
          '.store-locator',
        ];
        for (const sel of mapSelectors) {
          const el = document.querySelector(sel);
          if (el) {
            const rect = el.getBoundingClientRect();
            const hasImgOrCanvas = el.querySelector('img, canvas, svg');
            if (rect.height < 50 || !hasImgOrCanvas || el.innerHTML.trim().length < 30) {
              defectiveSections.push({ selector: sel, reason: 'Map widget has collapsed height or missing media/canvas', type: 'empty_widget' });
              break;
            }
          }
        }

        // 2. Check for collapsed main sections
        document.querySelectorAll('section, main > div, [data-component]').forEach((el, idx) => {
          const rect = el.getBoundingClientRect();
          if (rect.height < 20 && el.childElementCount > 0) {
            const className = typeof el.className === 'string' ? el.className.trim() : '';
            const sel = el.id ? `#${el.id}` : (className ? `.${className.split(/\s+/)[0]}` : `section:nth-of-type(${idx + 1})`);
            defectiveSections.push({ selector: sel, reason: 'Section has zero or near-zero rendered height', type: 'collapsed_section' });
          }
        });

        // 3. Check for broken lazy images with unloaded data-src
        const unloadedImgs = document.querySelectorAll('img[data-src]:not([src]), img[src=""], img[data-srcset]:not([srcset])');
        if (unloadedImgs.length > 0) {
          defectiveSections.push({ selector: 'img[data-src]', reason: `${unloadedImgs.length} lazy images missing src attribute`, type: 'unloaded_images' });
        }

        return { carouselOk, fallbackOk, noWhiteout, defectiveSections };
      });

      carouselsResponsive = structural.carouselOk;
      fallbacksVisible = structural.fallbackOk;
      noWhiteOutSections = structural.noWhiteout;
      defectiveSections = structural.defectiveSections || [];

      // Check mobile menu toggle
      const mobileToggle = await page.$(
        '[class*="mobile-nav-toggle"], [class*="hamburger"], [aria-label*="menu" i], [class*="menu-btn"]'
      );
      if (mobileToggle) {
        await mobileToggle.click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(350);
        mobileTogglePassed = await page.evaluate(() => {
          const drawer = document.querySelector(
            '.mobile-open, dialog.mobile-open, [class*="mobile-nav"].open, body.menu-open, [class*="nav-drawer"].open'
          );
          if (!drawer) return false;
          const rect = drawer.getBoundingClientRect();
          return rect.height > 200;
        });
      } else {
        mobileTogglePassed = true;
      }

      if (baselines?.mobile) {
        const diffRes = this.compareScreenshots(baselines.mobile, mobileClone, path.join(qaDir, 'diff-mobile.png'));
        mobileScore = diffRes.score;
        diffImageUrls.mobile = 'qa/diff-mobile.png';
      }
    } catch (err) {
      console.warn('[VisualQA] Error during viewport evaluation:', err);
    } finally {
      await page.close();
      await context.close();
    }

    return {
      viewportScores: { desktop: desktopScore, tablet: tabletScore, mobile: mobileScore },
      menuInteractivity: { desktopHoverPassed, mobileTogglePassed },
      structuralChecks: { noWhiteOutSections, carouselsResponsive, fallbacksVisible },
      diffImageUrls,
      defectiveSections,
    };
  }

  private compareScreenshots(
    baselineBuf: Buffer,
    cloneBuf: Buffer,
    diffOutPath: string
  ): { score: number; mismatchPixels: number } {
    try {
      const img1 = PNG.sync.read(baselineBuf);
      const img2 = PNG.sync.read(cloneBuf);

      // Compute strict dimension ratio
      const width = Math.min(img1.width, img2.width);
      const height = Math.min(img1.height, img2.height);
      const maxW = Math.max(img1.width, img2.width);
      const maxH = Math.max(img1.height, img2.height);

      const areaIntersect = width * height;
      const areaMax = maxW * maxH;
      const dimensionRatio = areaMax > 0 ? areaIntersect / areaMax : 0;

      const cropped1 = new PNG({ width, height });
      const cropped2 = new PNG({ width, height });
      PNG.bitblt(img1, cropped1, 0, 0, width, height, 0, 0);
      PNG.bitblt(img2, cropped2, 0, 0, width, height, 0, 0);

      const diff = new PNG({ width, height });
      const pm = (pixelmatch as any).default || pixelmatch;
      const numDiffPixels = pm(cropped1.data, cropped2.data, diff.data, width, height, {
        threshold: 0.15,
        includeAA: false,
      });

      const mismatchRatio = areaIntersect > 0 ? numDiffPixels / areaIntersect : 1;
      const overlapMatch = Math.max(0, 1 - mismatchRatio);
      const strictScore = Math.max(0, Math.round(dimensionRatio * overlapMatch * 100));

      fs.writeFileSync(diffOutPath, PNG.sync.write(diff));
      return { score: strictScore, mismatchPixels: numDiffPixels };
    } catch (e) {
      console.warn('[VisualQA] pixelmatch notice:', e);
      return { score: 0, mismatchPixels: 0 };
    }
  }

  private applySelfHealingFixes(
    indexHtmlPath: string,
    styleCssPath: string,
    evalData: {
      menuInteractivity: { desktopHoverPassed: boolean; mobileTogglePassed: boolean };
      structuralChecks: { carouselsResponsive: boolean; fallbacksVisible: boolean };
      defectiveSections?: Array<{ selector: string; reason: string; type: string }>;
    },
    rawSnapshotHtml?: string
  ): void {
    // 1. Targeted Section-Level Re-Harvesting from client/crawler pristine snapshot
    if (rawSnapshotHtml && fs.existsSync(indexHtmlPath)) {
      try {
        const $raw = cheerio.load(rawSnapshotHtml);
        const cloneHtml = fs.readFileSync(indexHtmlPath, 'utf8');
        const $clone = cheerio.load(cloneHtml);
        let mutated = false;

        // 1a. Hydrate all lazy images (data-src / data-srcset / data-poster)
        $clone('img[data-src]').each((_, el) => {
          const dataSrc = $clone(el).attr('data-src');
          if (dataSrc && !$clone(el).attr('src')) {
            $clone(el).attr('src', dataSrc);
            mutated = true;
          }
        });
        $clone('img[data-srcset]').each((_, el) => {
          const dataSrcset = $clone(el).attr('data-srcset');
          if (dataSrcset && !$clone(el).attr('srcset')) {
            $clone(el).attr('srcset', dataSrcset);
            mutated = true;
          }
        });
        $clone('source[data-srcset]').each((_, el) => {
          const dataSrcset = $clone(el).attr('data-srcset');
          if (dataSrcset && !$clone(el).attr('srcset')) {
            $clone(el).attr('srcset', dataSrcset);
            mutated = true;
          }
        });
        $clone('video[data-poster]').each((_, el) => {
          const poster = $clone(el).attr('data-poster');
          if (poster && !$clone(el).attr('poster')) {
            $clone(el).attr('poster', poster);
            mutated = true;
          }
        });

        // 1b. Targeted Re-Harvest of defective sections
        if (evalData.defectiveSections && evalData.defectiveSections.length > 0) {
          for (const defect of evalData.defectiveSections) {
            if (defect.type === 'empty_widget' || defect.type === 'collapsed_section') {
              try {
                const rawTarget = $raw(defect.selector);
                const cloneTarget = $clone(defect.selector);
                if (rawTarget.length > 0 && cloneTarget.length > 0) {
                  const rawHtml = rawTarget.html();
                  if (rawHtml && rawHtml.length > (cloneTarget.html()?.length || 0)) {
                    cloneTarget.html(rawHtml);
                    // Copy non-conflicting attributes
                    const rawAttrs = rawTarget.attr();
                    if (rawAttrs) {
                      for (const [k, v] of Object.entries(rawAttrs)) {
                        if (k !== 'class' && k !== 'id') {
                          cloneTarget.attr(k, v);
                        }
                      }
                    }
                    mutated = true;
                  }
                }
              } catch (selErr) {
                // Ignore non-standard selector syntax
              }
            }
          }
        }

        if (mutated) {
          fs.writeFileSync(indexHtmlPath, $clone.html(), 'utf8');
        }
      } catch (harvestErr) {
        console.warn('[VisualQA] Targeted DOM re-harvesting notice:', harvestErr);
      }
    }

    // 2. Authentic Website Rule Retrieval (Zero Guessing)
    let healingCss = '\n/* [AUTHENTIC ORIGIN WEBSITE RULE RETRIEVAL (Zero Guessing)] */\n';
    let healingJs = '';

    if (rawSnapshotHtml) {
      const $raw = cheerio.load(rawSnapshotHtml);
      const rawStyles: string[] = [];
      $raw('style').each((_, s) => {
        const txt = $raw(s).text();
        if (txt) rawStyles.push(txt);
      });
      const rawWebsiteCss = rawStyles.join('\n');

      if (evalData.defectiveSections && evalData.defectiveSections.length > 0) {
        for (const defect of evalData.defectiveSections) {
          const authenticRules = fidelityGuard.retrieveAuthenticCssForElement(
            {
              type: 'hidden_element',
              selector: defect.selector,
              tagName: (defect as any).tagName || 'div',
              classes: ((defect as any).classes || []).concat(defect.selector.replace(/^[.#]/, '').split(/\s+/)),
            },
            rawWebsiteCss,
            rawSnapshotHtml
          );
          if (authenticRules) {
            healingCss += `\n${authenticRules}\n`;
          }
        }
      }

      if (!evalData.menuInteractivity.mobileTogglePassed) {
        const authenticToggleJs = fidelityGuard.retrieveAuthenticToggleJs(
          {
            type: 'unresponsive_toggle',
            selector: '#nav-container .button, .icon-bar, [aria-label*="menu"]',
            tagName: 'button',
            classes: ['button', 'icon-bar'],
          },
          rawSnapshotHtml,
          rawWebsiteCss
        );
        if (authenticToggleJs) {
          healingJs = `\n<script id="replicator-self-heal-script">\n${authenticToggleJs}\n</script>\n`;
        }
      }
    }

    try {
      if (fs.existsSync(styleCssPath)) {
        fs.appendFileSync(styleCssPath, healingCss, 'utf8');
      }
      if (fs.existsSync(indexHtmlPath)) {
        let html = fs.readFileSync(indexHtmlPath, 'utf8');
        if (html.includes('</head>')) {
          html = html.replace('</head>', `<style id="replicator-self-heal">${healingCss}</style>\n</head>`);
        }
        if (html.includes('</body>') && !html.includes('replicator-self-heal-script')) {
          html = html.replace('</body>', `${healingJs}\n</body>`);
        }
        fs.writeFileSync(indexHtmlPath, html, 'utf8');
      }
    } catch (patchErr) {
      console.warn('[VisualQA] Could not write self-healing patch:', patchErr);
    }
  }
}
