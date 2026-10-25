import * as cheerio from 'cheerio';
import { synthesisEngine } from '../synthesis/engine.js';
import { JsTransformer } from '../transformer/js-transformer.js';
import { SegmentedSection } from './visual-segmentation-worker.js';
import { SectionArchetype } from '../synthesis/types.js';
import { RecordedInteraction } from '../types.js';
import { optimizeCssForDocument } from '../optimizer/css-purger.js';

export interface ReconstructedSectionOutput {
  id: string;
  archetype: SectionArchetype;
  html: string;
  css: string;
  minifiedCss: string;
  js: string;
  score: number;
  interactiveFeatures: string[];
}

export interface ReconstructionResult {
  fullHtml: string;
  fullCss: string;
  fullMinCss: string;
  fullJs: string;
  sections: ReconstructedSectionOutput[];
  averageScore: number;
  passed: boolean;
}

export class ReconstructionWorker {
  public static readonly workerName = 'ReconstructionWorker';

  public async execute(
    _rawHtml: string,
    rawCss: string,
    _rawJs: string,
    segmentedSections: SegmentedSection[],
    sourceUrl: string,
    targetArchetypeHint?: string,
    htmlSnapshot?: string,
    recordedInteractions?: RecordedInteraction[]
  ): Promise<ReconstructionResult> {
    const sectionsOutput: ReconstructedSectionOutput[] = [];

    for (const sec of segmentedSections) {
      const synthesized = synthesisEngine.synthesizeSection(
        sec.html,
        sourceUrl,
        rawCss,
        sec.selector,
        targetArchetypeHint || (sec.archetype ? (sec.archetype as string) : undefined),
        htmlSnapshot,
        recordedInteractions
      );

      sectionsOutput.push({
        id: sec.id,
        archetype: synthesized.archetype,
        html: synthesized.html,
        css: synthesized.css,
        minifiedCss: synthesized.css,
        js: synthesized.js,
        score: synthesized.scoring.totalScore,
        interactiveFeatures: synthesized.interactiveFeatures,
      });
    }

    const cleanRawJs = JsTransformer.sanitizeModuleSyntax(_rawJs || '');
    let safeRawJs = '';
    if (cleanRawJs && cleanRawJs.trim()) {
      try {
        new Function(cleanRawJs);
        safeRawJs = cleanRawJs;
      } catch (err) {
        // If raw origin scripts contain syntax errors (e.g. unbundled external module chunks, broken license comments),
        // isolate execution to runtime dynamic evaluation so it can never prevent synthetic controllers from loading.
        safeRawJs = `/* [Raw Origin JS Isolated Due to Syntax Errors] */\ntry {\n  new Function(${JSON.stringify(cleanRawJs)})();\n} catch (e) {}\n`;
      }
    }
    const wrappedRawJs = safeRawJs
      ? `\n\n// [Authentic Origin JavaScript Execution (Protected Boundary)]\n(function() {\n  try {\n${safeRawJs}\n  } catch (err) {}\n})();`
      : '';

    let htmlAttrs = 'lang="en"';
    let bodyAttrs = '';
    let globalBgCanvasHtml = '';
    let globalOverlaysHtml = '';
    if (htmlSnapshot || _rawHtml) {
      try {
        const $snap = cheerio.load(htmlSnapshot || _rawHtml);
        const snapHtml = $snap('html');
        const snapBody = $snap('body');
        const hCls = snapHtml.attr('class');
        const bCls = snapBody.attr('class');
        if (hCls) htmlAttrs += ` class="${hCls}"`;
        if (bCls) bodyAttrs += ` class="${bCls}"`;

        for (const [k, v] of Object.entries(snapHtml.attr() || {})) {
          if (k !== 'class' && k !== 'lang') htmlAttrs += ` ${k}="${v}"`;
        }
        for (const [k, v] of Object.entries(snapBody.attr() || {})) {
          if (k !== 'class') bodyAttrs += ` ${k}="${v}"`;
        }

        // Universal Fixed Background WebGL / Canvas Container Extraction
        const bgContainer = $snap(
          '#gl, #webgl, .webgl, [class*="webgl"], [class*="canvas-container"], [id*="canvas-container"], [class*="ambient-canvas"], [class*="background-canvas"], body > canvas, body > img.rep-canvas-replacement'
        ).filter((_, el) => {
          const $el = $snap(el);
          const cls = ($el.attr('class') || '').toLowerCase();
          const id = ($el.attr('id') || '').toLowerCase();
          const isDirectCanvas = (el.tagName || '').toLowerCase() === 'canvas';
          const isDirectReplacement = $el.is('img.rep-canvas-replacement, img[class*="canvas-replacement"]');
          const hasCanvas = isDirectCanvas || isDirectReplacement || $el.find('canvas').length > 0 || $el.find('img.rep-canvas-replacement, img[class*="canvas-replacement"]').length > 0;
          return hasCanvas && !cls.includes('button') && !cls.includes('offcanvas') && !cls.includes('icon') && !cls.includes('btn') && !cls.includes('sound') && !id.includes('sound');
        }).first();

        if (bgContainer.length > 0) {
          bgContainer.find('img.rep-canvas-replacement, img[class*="canvas-replacement"]').each((_, img) => {
            $snap(img).replaceWith('<canvas></canvas>');
          });
          if (bgContainer.is('img.rep-canvas-replacement, img[class*="canvas-replacement"]')) {
            globalBgCanvasHtml = '<div id="gl"><canvas></canvas></div>';
          } else {
            if (bgContainer.find('canvas').length === 0) {
              bgContainer.append('<canvas></canvas>');
            }
            globalBgCanvasHtml = $snap.html(bgContainer) || '';
          }
        }

        // Universal Body-Level Overlays, Drawers & Hover Targets Extraction
        const bodyOverlays = $snap(
          'body > .menu-overlay, body > .menu-tiles-wrapper, body > [class*="menu-overlay"], body > .archive-menu-image-target, body > [class*="menu-image-target"], body > [class*="cursor"], body > [id*="cursor"], body > [class*="custom-cursor"], body > [class*="hover-target"]'
        );
        if (bodyOverlays.length > 0) {
          bodyOverlays.each((_, el) => {
            const $el = $snap(el);
            $el.find('img, source, video').each((_, m) => {
              const src = $snap(m).attr('src');
              if (src && (src.startsWith('/') || !src.startsWith('http'))) {
                try {
                  $snap(m).attr('src', new URL(src, sourceUrl).href);
                } catch {}
              }
              const srcset = $snap(m).attr('srcset');
              if (srcset) {
                const rewritten = srcset.split(',').map(part => {
                  const [u, w] = part.trim().split(/\s+/);
                  try {
                    return `${new URL(u, sourceUrl).href}${w ? ' ' + w : ''}`;
                  } catch {
                    return part;
                  }
                }).join(', ');
                $snap(m).attr('srcset', rewritten);
              }
            });
            globalOverlaysHtml += '\n' + $snap.html(el);
          });
        }
      } catch (_) {}
    }

    // Strip any trapped ambient canvas containers from individual section HTMLs
    // so they are never nested inside headers (stacking context 9999) or relative content wrappers
    for (const sec of sectionsOutput) {
      if (sec.html && (sec.html.includes('id="gl"') || sec.html.includes('class="webgl"') || sec.html.includes('id="webgl"'))) {
        try {
          const $sec = cheerio.load(sec.html, { xmlMode: false }, false);
          const found = $sec('#gl, #webgl, .webgl, [class*="webgl"]').filter((_, el) => {
            const cls = ($sec(el).attr('class') || '').toLowerCase();
            return !cls.includes('button') && !cls.includes('btn');
          });
          if (found.length > 0) {
            if (!globalBgCanvasHtml) {
              if (found.find('canvas').length === 0) {
                found.append('<canvas></canvas>');
              }
              globalBgCanvasHtml = $sec.html(found.first()) || '<div id="gl"><canvas></canvas></div>';
            }
            found.remove();
            sec.html = $sec.html() || sec.html;
          }
        } catch (_) {}
      }
    }

    const bgCanvasCss = `
#gl, #webgl, .webgl, #canvas.fixed, canvas#canvas.fixed, [class*="webgl"]:not([class*="button"]):not([class*="btn"]), [id*="webgl"]:not([id*="button"]), canvas[class*="fixed"][class*="inset-0"] {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  inset: 0 !important;
  z-index: 0 !important;
  pointer-events: none !important;
  overflow: hidden !important;
}
#gl canvas, #webgl canvas, .webgl canvas, [class*="webgl"]:not([class*="button"]):not([class*="btn"]) canvas, [id*="webgl"]:not([id*="button"]) canvas {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  display: block !important;
  pointer-events: none !important;
}
body > section, section, main, [class*="hero"], [class*="storytelling"] {
  position: relative !important;
  z-index: 2 !important;
}
header.site-header, header {
  position: relative !important;
  z-index: 9999 !important;
}

/* Universal Pinned Storytelling Scroll Deck */
.universal-scroll-storytelling {
  position: relative !important;
  width: 100% !important;
  display: block !important;
  z-index: 2 !important;
}
.universal-storytelling-viewport {
  position: sticky !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  overflow: hidden !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  z-index: 2 !important;
}
.universal-storytelling-viewport > section,
.universal-storytelling-viewport > div {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  opacity: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
  transition: opacity 0.45s ease-out, transform 0.55s cubic-bezier(0.16, 1, 0.3, 1) !important;
  transform: translate3d(0, 24px, 0) !important;
}
.universal-storytelling-viewport > section.is-active-slide,
.universal-storytelling-viewport > div.is-active-slide {
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: auto !important;
  transform: translate3d(0, 0, 0) !important;
}

/* Universal SplitText & Char Base Unhiding (Non-destructive to inline animations) */
h1 [aria-hidden="true"], h2 [aria-hidden="true"], h3 [aria-hidden="true"], [class*="title"] [aria-hidden="true"] {
  display: inline-block;
}

/* Universal Off-Canvas Drawer & Overlay Resting State */
#site-menu, [id*="site-menu"], [class*="site-menu"], [class*="mobile-nav-drawer"], [class*="menu-drawer"], [class*="drawer"]:not([class*="cart"]):not([class*="product"]), [class*="offcanvas"], [class*="off-canvas"] {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  pointer-events: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  z-index: 10000 !important;
}
#site-menu.is-active, #site-menu.open, [class*="site-menu"].is-active, [class*="site-menu"].open {
  pointer-events: auto !important;
  visibility: visible !important;
  opacity: 1 !important;
}

/* Universal Lenis & Virtual Smooth Scroll Normalization */
html.lenis, html.lenis body, html.lenis-stopped, body.lenis-stopped {
  height: auto !important;
  min-height: 100% !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
}
.lenis.lenis-stopped, [class*="lenis-stopped"] {
  overflow: visible !important;
}
`;

    // Extract global :root variables, @font-face rules, and body background from rawCss & snapshot
    let globalCssPreamble = '';
    if (rawCss) {
      const rootMatches = rawCss.match(/:root\s*\{[^}]*\}/gi);
      if (rootMatches) {
        globalCssPreamble += rootMatches.join('\n') + '\n';
      }
      const fontMatches = rawCss.match(/@font-face\s*\{[^}]*\}/gi);
      if (fontMatches) {
        globalCssPreamble += fontMatches.join('\n') + '\n';
      }
      const bodyBgMatch = rawCss.match(/(?:body|html|body\s*,\s*html)\s*\{[^}]*background(?:-color)?\s*:\s*([^;!}]+)[^}]*\}/i);
      if (bodyBgMatch && bodyBgMatch[1]) {
        const bgVal = bodyBgMatch[1].trim();
        if (bgVal && bgVal !== 'none' && bgVal !== 'transparent') {
          globalCssPreamble += `body { background-color: ${bgVal}; }\n`;
        }
      }
    }
    if (htmlSnapshot || _rawHtml) {
      try {
        const $snapForBg = cheerio.load(htmlSnapshot || _rawHtml);
        const metaTheme = $snapForBg('meta[name="theme-color"]').attr('content');
        if (metaTheme && metaTheme.trim() && metaTheme.trim() !== 'transparent') {
          globalCssPreamble += `html, body { background-color: ${metaTheme.trim()} !important; }\n`;
        }
        const bStyle = $snapForBg('body').attr('style') || '';
        const bgMatch = bStyle.match(/background(?:-color)?\s*:\s*([^;!]+)/i);
        if (bgMatch && bgMatch[1]) {
          const snapBg = bgMatch[1].trim();
          if (snapBg && snapBg !== 'transparent' && snapBg !== 'none') {
            globalCssPreamble += `body { background-color: ${snapBg} !important; }\n`;
          }
        }
      } catch (_) {}
    }

    // Universal Fixed Canvas Container Fallback (e.g. #gl on Nuxt/Three.js or ambient canvas sites)
    if (!globalBgCanvasHtml && (
      (htmlSnapshot && (htmlSnapshot.includes('id="gl"') || htmlSnapshot.includes('class="webgl"') || htmlSnapshot.includes('id="webgl"'))) ||
      (_rawHtml && (_rawHtml.includes('id="gl"') || _rawHtml.includes('class="webgl"') || _rawHtml.includes('id="webgl"')))
    )) {
      globalBgCanvasHtml = '<div id="gl"><canvas></canvas></div>';
    }

    if (segmentedSections.length === 1) {
      const sec = sectionsOutput[0];
      const effectiveSectionJs = [
        wrappedRawJs,
        sec.js ? `// [Universal Interactive Resilience Controller]\n${sec.js}` : ''
      ].filter(Boolean).join('\n\n');

      const injectedBg = globalBgCanvasHtml ? `${globalBgCanvasHtml}\n` : '';

      const rawFullCss = `*, *::before, *::after { box-sizing: border-box; }\nhtml, body { container-type: inline-size; }\n${globalCssPreamble}\nbody { margin: 0; padding: 0; }\n${bgCanvasCss}\n${sec.css}`;
      const fullHtml = `<!DOCTYPE html>
<html ${htmlAttrs}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="no-referrer">
  <title>Synthesized Section</title>
  <link rel="stylesheet" href="style.css">
</head>
<body ${bodyAttrs}>
${injectedBg}${sec.html}${globalOverlaysHtml ? '\n' + globalOverlaysHtml : ''}
  <script src="script.js" defer></script>
</body>
</html>`.trim();
      const fullCss = optimizeCssForDocument(rawFullCss, fullHtml);

      return {
        fullHtml,
        fullCss,
        fullMinCss: fullCss,
        fullJs: effectiveSectionJs,
        sections: sectionsOutput,
        averageScore: sec.score,
        passed: sec.score >= 80,
      };
    }

    // Universal Storytelling Deck Grouping:
    // If consecutive sections are sequential hero slides (e.g. hero-1, hero-2, hero-3, hero-4, hero-5
    // or slide-1, slide-2 or storytelling steps), wrap them in a sticky pinned storytelling viewport!
    const groupedHtmlParts: string[] = [];
    let currentSlideGroup: ReconstructedSectionOutput[] = [];

    function isStorytellingSlide(sec: ReconstructedSectionOutput): boolean {
      const h = sec.html.toLowerCase();
      return /class=["'][^"']*\bhero-[1-9]\b[^"']*["']/i.test(h) ||
             /class=["'][^"']*\bslide-[1-9]\b[^"']*["']/i.test(h) ||
             /class=["'][^"']*\bstory-step\b[^"']*["']/i.test(h) ||
             /class=["'][^"']*\bscreen-[1-9]\b[^"']*["']/i.test(h);
    }

    function flushSlideGroup() {
      if (currentSlideGroup.length > 1) {
        const heightVh = currentSlideGroup.length * 100;
        const slidesHtml = currentSlideGroup.map((s, idx) => {
          if (idx === 0) {
            return s.html.replace(/class=(["'])/i, 'class=$1is-active-slide ');
          }
          return s.html;
        }).join('\n');
        groupedHtmlParts.push(
          `<div class="universal-scroll-storytelling" style="height: ${heightVh}vh;" data-story-slides="${currentSlideGroup.length}">\n  <div class="universal-storytelling-viewport">\n${slidesHtml}\n  </div>\n</div>`
        );
      } else if (currentSlideGroup.length === 1) {
        groupedHtmlParts.push(currentSlideGroup[0].html);
      }
      currentSlideGroup = [];
    }

    for (const sec of sectionsOutput) {
      if (isStorytellingSlide(sec)) {
        currentSlideGroup.push(sec);
      } else {
        flushSlideGroup();
        groupedHtmlParts.push(sec.html);
      }
    }
    flushSlideGroup();

    const combinedSectionsHtml = groupedHtmlParts.join('\n\n');
    const injectedCombinedBg = globalBgCanvasHtml ? `${globalBgCanvasHtml}\n` : '';

    const combinedRawCss = sectionsOutput.map((r) => r.css).join('\n\n');
    const rawCombinedCss = `*, *::before, *::after { box-sizing: border-box; }\nhtml, body { container-type: inline-size; }\n${globalCssPreamble}\nbody { margin: 0; padding: 0; }\n${bgCanvasCss}\n${combinedRawCss}`;
    const syntheticJs = sectionsOutput.map((r) => r.js).filter(Boolean).join('\n\n');
    const effectiveFullJs = [
      wrappedRawJs,
      syntheticJs ? `// [Universal Interactive Resilience Controller]\n${syntheticJs}` : ''
    ].filter(Boolean).join('\n\n');

    const fullHtml = `<!DOCTYPE html>
<html ${htmlAttrs}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="no-referrer">
  <title>Reconstructed Page</title>
  <link rel="stylesheet" href="style.css">
</head>
<body ${bodyAttrs}>
${injectedCombinedBg}${combinedSectionsHtml}${globalOverlaysHtml ? '\n' + globalOverlaysHtml : ''}
  <script src="script.js" defer></script>
</body>
</html>`.trim();
    const combinedCss = optimizeCssForDocument(rawCombinedCss, fullHtml);

    const totalScores = sectionsOutput.reduce((acc, r) => acc + r.score, 0);
    let averageScore = sectionsOutput.length > 0 ? Math.round(totalScores / sectionsOutput.length) : 0;

    // Page-Level Completeness Audit:
    // If the original page had multiple distinct sections/articles, but only 1 section was segmented,
    // this indicates a major segmentation swallow failure! Penalize score appropriately.
    if (sectionsOutput.length === 1 && (htmlSnapshot || _rawHtml)) {
      try {
        const $snap = cheerio.load(htmlSnapshot || _rawHtml || '');
        const originSectionCount = $snap('section, article, [data-section], [data-block]').length;
        if (originSectionCount >= 3) {
          averageScore = Math.max(15, averageScore - 55);
        }
      } catch (e) {}
    }

    const passed = averageScore >= 80;

    return {
      fullHtml,
      fullCss: combinedCss,
      fullMinCss: combinedCss,
      fullJs: effectiveFullJs,
      sections: sectionsOutput,
      averageScore,
      passed,
    };
  }
}
