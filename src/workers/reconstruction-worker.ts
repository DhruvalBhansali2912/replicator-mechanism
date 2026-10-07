import { synthesisEngine } from '../synthesis/engine.js';
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

    if (segmentedSections.length === 1) {
      const sec = sectionsOutput[0];
      const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="no-referrer">
  <title>Synthesized Section</title>
  <style>
    body { display: block !important; place-items: unset !important; margin: 0; padding: 0; }
    body:has(> [data-theme="dark"]), body:has(> .section[data-theme="dark"]), body:has(> header[data-theme="dark"]), body:has(> nav[data-theme="dark"]), body[data-theme="dark"], body.theme-dark { background-color: #0f172a !important; color: #f8fafc; }
    header, nav, [role="banner"], .site-header, [class*="site-header"], [class*="navbar"], [class*="globalnav"] { width: 100% !important; align-self: flex-start !important; top: 0 !important; margin-top: 0 !important; }
${sec.css}
  </style>
</head>
<body>
${sec.html}
  <script>
${sec.js}
  </script>
</body>
</html>`.trim();

      return {
        fullHtml,
        fullCss: sec.css,
        fullMinCss: sec.css,
        fullJs: sec.js,
        sections: sectionsOutput,
        averageScore: sec.score,
        passed: sec.score >= 90,
      };
    }

    const sectionsHtml = segmentedSections.map((s) => s.html);
    const fullBundle = synthesisEngine.synthesizeFullPage(sectionsHtml, sourceUrl, rawCss);

    return {
      fullHtml: fullBundle.fullHtml,
      fullCss: fullBundle.fullCss,
      fullMinCss: fullBundle.fullCss,
      fullJs: fullBundle.fullJs,
      sections: sectionsOutput,
      averageScore: fullBundle.averageScore,
      passed: fullBundle.passed,
    };
  }
}
