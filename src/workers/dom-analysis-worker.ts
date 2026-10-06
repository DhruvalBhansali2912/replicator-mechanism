import * as cheerio from 'cheerio';

export interface DOMAnalysisResult {
  totalNodes: number;
  maxDepth: number;
  semanticTagsCount: Record<string, number>;
  cleanedHtml: string;
  detectedLandmarks: {
    tag: string;
    role?: string;
    id?: string;
    classes: string[];
    childCount: number;
  }[];
}

export class DOMAnalysisWorker {
  public static readonly workerName = 'DOMAnalysisWorker';

  public async execute(html: string): Promise<DOMAnalysisResult> {
    const $ = cheerio.load(html);

    // Remove tracking, telemetry, ad scripts and empty comments
    $('script[src*="analytics"], script[src*="googletagmanager"], script[src*="facebook"], noscript, iframe').remove();

    let totalNodes = 0;
    let maxDepth = 0;
    const semanticTagsCount: Record<string, number> = {};
    const detectedLandmarks: DOMAnalysisResult['detectedLandmarks'] = [];

    const traverse = (node: any, depth: number) => {
      if (node.type === 'tag') {
        totalNodes++;
        if (depth > maxDepth) maxDepth = depth;

        const tag = node.name.toLowerCase();
        semanticTagsCount[tag] = (semanticTagsCount[tag] || 0) + 1;

        if (
          ['header', 'nav', 'main', 'section', 'article', 'aside', 'footer'].includes(tag) ||
          $(node).attr('role') ||
          $(node).hasClass('hero') ||
          $(node).hasClass('navbar') ||
          $(node).hasClass('pricing')
        ) {
          detectedLandmarks.push({
            tag,
            role: $(node).attr('role') || undefined,
            id: $(node).attr('id') || undefined,
            classes: ($(node).attr('class') || '').split(/\s+/).filter(Boolean),
            childCount: $(node).children().length,
          });
        }
      }

      if (node.children) {
        for (const child of node.children) {
          traverse(child, depth + 1);
        }
      }
    };

    traverse($.root()[0], 0);

    return {
      totalNodes,
      maxDepth,
      semanticTagsCount,
      cleanedHtml: $.html(),
      detectedLandmarks,
    };
  }
}
