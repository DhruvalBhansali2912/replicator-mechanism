import * as cheerio from 'cheerio';
import { SectionClassifier } from '../classifier/section-classifier.js';
import { SectionArchetype } from '../types.js';

export interface SegmentedSection {
  id: string;
  index: number;
  selector: string;
  tagName: string;
  archetype: SectionArchetype;
  confidence: number;
  html: string;
  rect: { x: number; y: number; width: number; height: number };
}

export interface VisualSegmentationResult {
  sections: SegmentedSection[];
  totalSections: number;
}

export class VisualSegmentationWorker {
  public static readonly workerName = 'VisualSegmentationWorker';
  private classifier = new SectionClassifier();

  public async execute(html: string): Promise<VisualSegmentationResult> {
    const $ = cheerio.load(html);
    const candidateNodes: { selector: string; tagName: string; html: string; rect: any }[] = [];

    // Identify candidate root sections
    const targetSelectors = [
      'header',
      'nav',
      'main > section',
      'main > div',
      'body > section',
      'body > div > section',
      '[role="banner"]',
      '[role="navigation"]',
      '[role="main"]',
      '[role="contentinfo"]',
      'footer',
    ];

    const seenElements = new Set<any>();

    for (const sel of targetSelectors) {
      $(sel).each((_, el) => {
        if (!seenElements.has(el)) {
          const elHtml = $(el).html() || '';
          if (elHtml.trim().length > 30) {
            seenElements.add(el);
            const tag = (el as any).tagName ? (el as any).tagName.toLowerCase() : 'section';
            candidateNodes.push({
              selector: sel,
              tagName: tag,
              html: $.html(el),
              rect: { x: 0, y: candidateNodes.length * 400, width: 1440, height: 400 },
            });
          }
        }
      });
    }

    // Fallback: If no distinct sections were discovered, treat body children as sections
    if (candidateNodes.length === 0) {
      $('body > *').each((i, el) => {
        const text = $(el).text()?.trim() || '';
        if (text.length > 10) {
          const tag = (el as any).tagName ? (el as any).tagName.toLowerCase() : 'div';
          candidateNodes.push({
            selector: `body > :nth-child(${i + 1})`,
            tagName: tag,
            html: $.html(el),
            rect: { x: 0, y: i * 350, width: 1440, height: 350 },
          });
        }
      });
    }

    const sections: SegmentedSection[] = candidateNodes.map((item, index) => {
      const sectionId = `sec_${index + 1}`;
      const classification = this.classifier.classify({
        id: sectionId,
        index,
        totalSections: candidateNodes.length,
        selector: item.selector,
        tagName: item.tagName,
        rect: item.rect,
        html: item.html,
      });

      return {
        id: sectionId,
        index,
        selector: item.selector,
        tagName: item.tagName,
        archetype: classification.archetype,
        confidence: classification.confidence,
        html: item.html,
        rect: item.rect,
      };
    });

    return {
      sections,
      totalSections: sections.length,
    };
  }
}
