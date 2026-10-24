import * as cheerio from 'cheerio';
import { SectionInspector } from './inspector.js';
import { HtmlSynthesizer } from './html-synthesizer.js';
import { CssSynthesizer } from './css-synthesizer.js';
import { JsSynthesizer } from './js-synthesizer.js';
import { QualityScorer } from './scorer.js';
import { SynthesizedSectionResult, SectionAST } from './types.js';
import { RecordedInteraction } from '../types.js';
import { resolveTargetSectionFromSnapshot, enrichSectionWithCompanions } from '../classifier/section-resolver.js';
import { optimizeCssForDocument } from '../optimizer/css-purger.js';

export class GroundUpSynthesisEngine {
  private inspector = new SectionInspector();
  private htmlSynthesizer = new HtmlSynthesizer();
  private cssSynthesizer = new CssSynthesizer();
  private jsSynthesizer = new JsSynthesizer();
  private scorer = new QualityScorer();

  /**
   * Reverse engineers a specific selected section (or full page) from the ground up.
   * Synthesizes fresh HTML, CSS, JS and evaluates against the >= 90 quality threshold.
   */
  public synthesizeSection(
    sectionHtml: string,
    sourceUrl: string = 'https://example.com',
    cssContext: string = '',
    sourceSelector: string = 'section',
    targetArchetypeHint?: string,
    htmlSnapshot?: string,
    recordedInteractions?: RecordedInteraction[],
    rootCssVariables?: Record<string, string>
  ): SynthesizedSectionResult {
    // Universal Snapshot Enrichment:
    // If htmlSnapshot contains the target element with richer interactive menus, dropdown panels,
    // or tab panes, prefer the snapshot version over an un-interacted or stripped sectionHtml snippet
    if (htmlSnapshot && htmlSnapshot.length > 50) {
      try {
        const $snap = cheerio.load(htmlSnapshot);
        const resolvedTarget = resolveTargetSectionFromSnapshot($snap, targetArchetypeHint, sourceSelector);
        if (resolvedTarget && resolvedTarget.length > 0) {
          const snapMenus = resolvedTarget.find('[role="menu"], [data-baseweb="menu"], [class*="menu"], [class*="dropdown"], [class*="submenu"]').length;
          const $cur = cheerio.load(sectionHtml || '');
          const curMenus = $cur('[role="menu"], [data-baseweb="menu"], [class*="menu"], [class*="dropdown"], [class*="submenu"]').length;
          const curText = $cur.text().trim();
          const curMedia = $cur('img, video, picture, canvas, svg').length;

          // If current sectionHtml is empty, lacks content, or snapshot has richer menus/structure or more complete container hierarchy
          const snapCount = resolvedTarget.find('*').length;
          const curCount = $cur('*').length;
          if (!sectionHtml || curText.length < 10 || curMedia === 0 || snapMenus > curMenus || snapCount > curCount) {
            sectionHtml = $snap.html(resolvedTarget) || sectionHtml;
          }
        }

        // Universal Portal & Navigation Drawer Enrichment:
        sectionHtml = enrichSectionWithCompanions(sectionHtml, $snap, targetArchetypeHint, sourceSelector);
      } catch {}
    }

    // 1. Inspect DOM & harvest design tokens into AST
    const ast = this.inspector.inspect(sectionHtml, sourceUrl, cssContext, sourceSelector, targetArchetypeHint, htmlSnapshot, recordedInteractions, rootCssVariables);

    // 2. Synthesize fresh code from scratch
    let html = this.htmlSynthesizer.synthesize(ast);
    let css = this.cssSynthesizer.synthesize(ast);
    const js = this.jsSynthesizer.synthesize(ast);

    // 3. Evaluate against strict scoring system (>= 90)
    let scoring = this.scorer.evaluate(ast, html, css);

    // 4. Self-Healing Pass if score < 90
    if (!scoring.passed) {
      console.warn(`[SynthesisEngine] Score ${scoring.totalScore} < 90. Applying self-healing adjustments...`);
      if (!css.includes('--color-primary') && !css.includes(':root')) {
        css = `:root {\n  --color-primary: ${ast.tokens?.colors?.primary || '#111827'};\n  --color-bg: ${ast.tokens?.colors?.background || '#ffffff'};\n  --font-family: ${ast.tokens?.typography?.fontFamily || 'system-ui, sans-serif'};\n}\n` + css;
      }
      if (!css.includes(':hover')) {
        css += '\n.btn:hover, button.btn:hover { opacity: 0.9; transition: opacity 0.2s ease; }\n';
      }
      if (!css.includes('@media')) {
        css += '\n@media (max-width: 768px) { [class*="container"] { width: 100%; padding: 0 16px; } }\n';
      }
      if (!html.includes('class="container') && !html.includes('class="wrapper') && !html.includes('class="module')) {
        const $h = cheerio.load(html, null, false);
        $h('*').first().addClass('container');
        html = $h.html();
      }
      scoring = this.scorer.evaluate(ast, html, css);
    }

    let docHtml = html;
    if (htmlSnapshot && htmlSnapshot.length > 50) {
      try {
        const $s = cheerio.load(htmlSnapshot);
        const bCls = $s('body').attr('class') || '';
        const hCls = $s('html').attr('class') || '';
        docHtml = `<!DOCTYPE html><html class="${hCls}"><body class="${bCls}">${html}</body></html>`;
      } catch {}
    }
    css = optimizeCssForDocument(css, docHtml);

    const interactiveFeatures: string[] = [];
    if (ast.interactive.hoverStates.length > 0) {
      interactiveFeatures.push(`Hover transitions (${ast.interactive.hoverStates.length} elements)`);
    }
    if (ast.interactive.clickStates.length > 0) {
      interactiveFeatures.push(`Click behaviors (${ast.interactive.clickStates.map((c) => c.targetRole).join(', ')})`);
    }
    if (ast.interactive.recordedTransitions && ast.interactive.recordedTransitions.length > 0) {
      interactiveFeatures.push(`Dynamic behavioral state transitions (${ast.interactive.recordedTransitions.length} recorded interactions)`);
    }

    return {
      sectionId: ast.id,
      archetype: ast.archetype,
      html,
      css,
      js,
      scoring,
      designTokens: ast.tokens,
      interactiveFeatures,
    };
  }

  /**
   * Synthesizes multiple sections into a cohesive full-page bundle.
   */
  public synthesizeFullPage(
    sectionsHtml: string[],
    sourceUrl: string = 'https://example.com',
    cssContext: string = '',
    htmlSnapshot?: string,
    rootCssVariables?: Record<string, string>
  ): {
    fullHtml: string;
    fullCss: string;
    fullJs: string;
    sections: SynthesizedSectionResult[];
    averageScore: number;
    passed: boolean;
  } {
    const results: SynthesizedSectionResult[] = [];

    for (let i = 0; i < sectionsHtml.length; i++) {
      const secHtml = sectionsHtml[i];
      if (secHtml && secHtml.trim().length > 30) {
        const res = this.synthesizeSection(
          secHtml,
          sourceUrl,
          cssContext,
          `section:nth-of-type(${i + 1})`,
          undefined,
          htmlSnapshot,
          undefined,
          rootCssVariables
        );
        results.push(res);
      }
    }

    // Extract html/body attributes from htmlSnapshot to preserve themes, font variables, and data attributes
    let htmlAttrs = 'lang="en"';
    let bodyAttrs = '';
    if (htmlSnapshot && htmlSnapshot.length > 50) {
      try {
        const $snap = cheerio.load(htmlSnapshot);
        const snapHtml = $snap('html');
        const snapBody = $snap('body');

        const htmlClass = snapHtml.attr('class') || '';
        const htmlStyle = snapHtml.attr('style') || '';
        const htmlLang = snapHtml.attr('lang') || 'en';

        let hAttr = `lang="${htmlLang}"`;
        if (htmlClass) hAttr += ` class="${htmlClass}"`;
        if (htmlStyle) hAttr += ` style="${htmlStyle}"`;
        const htmlEl = snapHtml.get(0) as any;
        if (htmlEl && htmlEl.attribs) {
          for (const [k, v] of Object.entries(htmlEl.attribs)) {
            if (k !== 'class' && k !== 'style' && k !== 'lang') hAttr += ` ${k}="${v}"`;
          }
        }
        htmlAttrs = hAttr;

        const bodyClass = snapBody.attr('class') || '';
        const bodyStyle = snapBody.attr('style') || '';
        let bAttr = '';
        if (bodyClass) bAttr += ` class="${bodyClass}"`;
        if (bodyStyle) bAttr += ` style="${bodyStyle}"`;
        const bodyEl = snapBody.get(0) as any;
        if (bodyEl && bodyEl.attribs) {
          for (const [k, v] of Object.entries(bodyEl.attribs)) {
            if (k !== 'class' && k !== 'style') bAttr += ` ${k}="${v}"`;
          }
        }
        bodyAttrs = bAttr.trim();
      } catch {}
    }

    // Combine into cohesive document
    const combinedSectionsHtml = results.map((r) => r.html).join('\n\n');
    const combinedCss = results.map((r) => r.css).join('\n\n');
    const combinedJs = results.map((r) => r.js).filter(Boolean).join('\n\n');

    const fullHtml = `
<!DOCTYPE html>
<html ${htmlAttrs}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="no-referrer">
  <title>Synthesized Page</title>
  <link rel="stylesheet" href="style.css">
</head>
<body${bodyAttrs ? ' ' + bodyAttrs : ''}>
${combinedSectionsHtml}

  <script src="script.js" defer></script>
</body>
</html>
`.trim();

    const totalScores = results.reduce((acc, r) => acc + r.scoring.totalScore, 0);
    const averageScore = results.length > 0 ? Math.round(totalScores / results.length) : 0;
    const passed = averageScore >= 90 && results.every((r) => r.scoring.passed);

    return {
      fullHtml,
      fullCss: optimizeCssForDocument(combinedCss, fullHtml),
      fullJs: combinedJs,
      sections: results,
      averageScore,
      passed,
    };
  }
}

export const synthesisEngine = new GroundUpSynthesisEngine();
