import * as cheerio from 'cheerio';
import { synthesisEngine } from '../synthesis/engine.js';
import { JsTransformer } from '../transformer/js-transformer.js';
import { SegmentedSection } from './visual-segmentation-worker.js';
import { SectionArchetype } from '../synthesis/types.js';
import { RecordedInteraction } from '../types.js';

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
      } catch (_) {}
    }

    if (segmentedSections.length === 1) {
      const sec = sectionsOutput[0];
      const effectiveSectionJs = `// [Universal Interactive Resilience Controller]\n${sec.js}${wrappedRawJs}`;

      const fullCss = `*, *::before, *::after { box-sizing: border-box; }\nbody { margin: 0; padding: 0; }\n${sec.css}`;
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
${sec.html}
  <script src="script.js" defer></script>
</body>
</html>`.trim();

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

    const combinedSectionsHtml = sectionsOutput.map((r) => r.html).join('\n\n');
    const combinedRawCss = sectionsOutput.map((r) => r.css).join('\n\n');
    const combinedCss = `*, *::before, *::after { box-sizing: border-box; }\nbody { margin: 0; padding: 0; }\n${combinedRawCss}`;
    const syntheticJs = sectionsOutput.map((r) => r.js).filter(Boolean).join('\n\n');
    const effectiveFullJs = `// [Universal Interactive Resilience Controller]\n${syntheticJs}${wrappedRawJs}`;

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
${combinedSectionsHtml}
  <script src="script.js" defer></script>
</body>
</html>`.trim();

    const totalScores = sectionsOutput.reduce((acc, r) => acc + r.score, 0);
    const averageScore = sectionsOutput.length > 0 ? Math.round(totalScores / sectionsOutput.length) : 0;
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
